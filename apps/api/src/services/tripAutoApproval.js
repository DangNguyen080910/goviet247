import {canVehicleServeTrip} from './tripVehiclePolicy.js';
import {createNotificationOutbox,AUTO_APPROVAL_JOB_KINDS} from './notificationOutbox.js';
import {randomUUID} from 'node:crypto';
import {prisma} from '../utils/db.js';
import {bookingQuotes} from './bookingQuotes.js';
import {assessAutoApproval, autoApprovalField, approvalRegion} from './tripAutoApprovalPolicy.js';
import {recordTripEvent} from './tripHistory.js';
import {emitRiderTripUpdate} from './riderTripAccess.js';

const includeStops = {stops:{orderBy:{seq:'asc'}}};
const pending = trip => trip && trip.status === 'PENDING' && !trip.isVerified && !trip.verifiedAt && !trip.driverId && !trip.cancelledAt;
const sameRequest = (trip, job) => trip.version === job.version && new Date(trip.updatedAt).getTime() === new Date(job.updatedAt).getTime();
const json = value => JSON.parse(JSON.stringify(value));
async function queue(tx, kind, args) {
  return tx.notificationJob.create({data:{id:randomUUID(),kind,payload:json(args),expiresAt:new Date(Date.now()+86400000)}});
}

// Enqueued in the same transaction as booking/release. No map, push or network
// calls hold the booking/financial locks. Existing pending trips are not swept.
export async function enqueueTripAutoApproval(tx, trip, source) {
  const field = autoApprovalField(source);
  if (!field) throw new Error('INVALID_AUTO_APPROVAL_SOURCE');
  const config = await tx.tripConfig.findFirst({orderBy:{id:'asc'}});
  if (config?.[field] !== true) return false;
  await queue(tx, 'tripAutoApprove', [{id:trip.id,source,version:trip.version,updatedAt:trip.updatedAt}]);
  Object.defineProperty(trip,'__autoApprovalQueued',{value:true,configurable:true});
  return true;
}

export function createTripAutoApprovalProcessor({db=prisma,resolveAddresses=addresses=>bookingQuotes.verifiedAddresses(addresses),clock=()=>new Date()}={}) {
  return async function process(job) {
    const field = autoApprovalField(job?.source);
    if (!field || !job.id) throw new Error('INVALID_AUTO_APPROVAL_JOB');
    const trip = await db.trip.findUnique({where:{id:job.id},include:includeStops});
    if (!pending(trip)) return;
    const config = await db.tripConfig.findFirst({orderBy:{id:'asc'}});
    let decision = {ok:false,reason:'Đã tắt duyệt tự động; chuyến được giữ để duyệt tay.'};
    if (!sameRequest(trip,job)) decision = {ok:false,reason:'Thông tin chuyến đã thay đổi sau khi tạo yêu cầu; cần duyệt tay.'};
    else if (config?.[field] === true) {
      const addresses = [trip.pickupAddress,...(trip.stops.length ? trip.stops.map(stop=>stop.address) : [trip.dropoffAddress])];
      try { decision = assessAutoApproval(trip,await resolveAddresses(addresses),clock()); }
      catch { decision = {ok:false,reason:'Chưa xác minh được địa chỉ từ bản đồ. Vui lòng kiểm tra và duyệt tay.'}; }
    }
    return db.$transaction(async tx=>{
      await tx.$queryRawUnsafe('SELECT "id" FROM "Trip" WHERE "id"=$1 FOR UPDATE',job.id);
      const current = await tx.trip.findUnique({where:{id:job.id},include:includeStops});
      if (!pending(current)) return;
      const currentConfig = await tx.tripConfig.findFirst({orderBy:{id:'asc'}});
      if (currentConfig) await tx.$queryRawUnsafe('SELECT "id" FROM "TripConfig" WHERE "id"=$1 FOR SHARE',currentConfig.id);
      const latestConfig = await tx.tripConfig.findFirst({orderBy:{id:'asc'}});
      if (!sameRequest(current,job)) decision = {ok:false,reason:'Thông tin chuyến đã thay đổi; cần điều hành kiểm tra và duyệt tay.'};
      else if (latestConfig?.[field] !== true) decision = {ok:false,reason:'Đã tắt duyệt tự động; chuyến được giữ để duyệt tay.'};
      else if (new Date(current.pickupTime) <= clock()) decision = {ok:false,reason:'Giờ đón đã tới; cần điều hành kiểm tra.'};
      let driverIds = [];
      if (decision.ok) {
        const region = approvalRegion(decision.provinceCode);
        const drivers = await tx.driverProfile.findMany({where:{status:'VERIFIED',tripAcceptBlocked:false,
          operatingProvinceConfirmedAt:{not:null},operatingProvinceCode:{in:region.provinceCodes}},select:{userId:true,vehicleType:true,vehicleFuelType:true}});
        driverIds = [...new Set(drivers.filter(driver=>canVehicleServeTrip(current,driver)).map(driver=>driver.userId))];
        // [] means PUBLIC in the existing visibility policy. Never approve an
        // empty region, or an address lookup failure, to the public room.
        if (!driverIds.length) decision = {ok:false,reason:'Chưa có tài xế đã xác nhận khu vực trong miền điểm đón đáp ứng số chỗ và nhiên liệu khách yêu cầu. Cần duyệt tay.'};
      }
      if (!decision.ok) {
        // Re-delivery of a finished review must not spam notifications/history.
        if (current.autoApprovalReviewReason) return;
        const changed = await tx.trip.update({where:{id:current.id},data:{autoApprovalReviewReason:decision.reason}});
        await recordTripEvent(tx,changed,{kind:'TRIP_UPDATED',fromStatus:current.status,toStatus:current.status,
          actorRole:'SYSTEM',actorName:'Duyệt tự động',reason:'Giữ chờ duyệt: '+decision.reason});
        await queue(tx,'sendAdminPushNotification',[{title:job.source === 'NEW' ? '🚨 Có chuyến mới chờ duyệt' : '⚠️ Chuyến cần duyệt lại',
          body:decision.reason,data:{source:'create_trip',type:'ADMIN_NEW_TRIP',tripId:current.id,status:'PENDING'}}]);
        const realtimeJob=await queue(tx,'tripAutoApprovalRealtime',[{id:current.id,review:true}]);
        return {approved:false,trip:changed,realtimeJobId:realtimeJob.id};
      }
      const driverConfig = await tx.driverConfig.findFirst({orderBy:{id:'asc'}});
      const configuredDelay = Number(driverConfig?.newTripAcceptDelaySeconds ?? 10);
      const delay = Number.isFinite(configuredDelay) && configuredDelay >= 0 ? configuredDelay : 10;
      const verifiedAt = clock();
      const reason = `${job.source === 'NEW' ? 'Tự duyệt chuyến mới' : 'Tự duyệt lại sau tài xế huỷ'}: phát cho tài xế ${approvalRegion(decision.provinceCode).label} theo điểm đón, đúng số chỗ và nhiên liệu khách yêu cầu.`;
      const changed = await tx.trip.update({where:{id:current.id,status:'PENDING',driverId:null,isVerified:false,cancelledAt:null},data:{
        audienceDriverIds:driverIds,audienceRegions:[decision.region],isVerified:true,verifiedAt,verifiedById:null,verifiedNote:reason,
        autoApprovalReviewReason:null,driverAcceptOpenAt:new Date(verifiedAt.getTime()+delay*1000),
      }});
      await recordTripEvent(tx,changed,{kind:'APPROVED',fromStatus:current.status,toStatus:changed.status,
        actorRole:'SYSTEM',actorName:'Duyệt tự động',reason,changes:[{label:'Miền nhận chuyến',before:current.audienceRegions || [],after:[decision.region]}]});
      if (changed.riderId) await tx.systemNotification.create({data:{audience:'RIDER',targetType:'USER',targetUserId:changed.riderId,
        title:'Chuyến đang tìm tài xế',message:`Chuyến #${changed.id.slice(-8).toUpperCase()} đã được duyệt và đang tìm tài xế.`,isActive:true}});
      await queue(tx,'sendNewTripToDrivers',[changed]);
      await queue(tx,'sendAdminPushNotification',[{title:job.source === 'NEW' ? '✅ Đã tự duyệt chuyến mới' : '🔄 Đã tự duyệt lại chuyến',
        body:`Chuyến #${changed.id.slice(-8).toUpperCase()} đang tìm tài xế ${approvalRegion(decision.provinceCode).label}.`,
        data:{type:'ADMIN_TRIP_STATUS_CHANGED',source:'auto_verify_trip',tripId:changed.id,status:changed.status,isVerified:true,verifiedAt:changed.verifiedAt,autoApprovalSource:job.source}}]);
      await queue(tx,'sendTripStatusChangedToRider',[changed,{reason:'admin_verify_trip'}]);
      const realtimeJob=await queue(tx,'tripAutoApprovalRealtime',[{id:changed.id,verifiedAt:changed.verifiedAt,autoApprovalSource:job.source}]);
      return {approved:true,trip:changed,realtimeJobId:realtimeJob.id};
    });
  };
}

export const processTripAutoApproval = createTripAutoApprovalProcessor();
export async function publishTripAutoApproval(io, job, db=prisma) {
  if (!io) throw new Error('AUTO_APPROVAL_SOCKET_UNAVAILABLE');
  const trip = await db.trip.findUnique({where:{id:job.id}});
  if (!trip) return;
  if (job.review ? !pending(trip) : trip.status !== 'PENDING' || !trip.isVerified || trip.driverId || trip.cancelledAt || new Date(trip.verifiedAt).getTime() !== new Date(job.verifiedAt).getTime()) return;
  const payload = {tripId:trip.id,status:trip.status,isVerified:trip.isVerified,updatedAt:trip.updatedAt,autoApprovalSource:job.autoApprovalSource,audienceRegions:trip.audienceRegions,source:job.review ? 'create_trip' : 'auto_verify_trip'};
  io.to('admins').emit(job.review ? 'admin:new_trip' : 'admin:trip_status_changed',payload);
  io.to('admins').emit('admin:dashboard_changed',payload);
  if (!job.review && trip.audienceDriverIds.length) {
    const mask = value => { const parts=String(value || '').split(',').map(part=>part.trim()).filter(Boolean); return parts.length >= 3 ? parts.slice(-2).join(', ') : parts.length === 2 ? parts[1] : 'Địa điểm đã xác nhận'; };
    io.to(trip.audienceDriverIds.map(id=>'driver:'+id)).emit('trip:new',{id:trip.id,pickupAddressMasked:mask(trip.pickupAddress),
      dropoffAddressMasked:mask(trip.dropoffAddress),pickupTime:trip.pickupTime,carType:trip.carType,direction:trip.direction,
      totalPrice:trip.totalPrice,distanceKm:trip.distanceKm,createdAt:trip.createdAt,driverAcceptOpenAt:trip.driverAcceptOpenAt});
    await emitRiderTripUpdate(io,db,trip,{reason:'admin_verify_trip'});
  }
}

// Address checks have their own queue drain, so slow Expo delivery cannot stall
// approvals. Persisted realtime jobs recover a crash after the business commit.
export function startTripAutoApprovalWorker(io) {
  const outbox=createNotificationOutbox({kinds:AUTO_APPROVAL_JOB_KINDS});
  const timer=setInterval(()=>{void outbox.drain(async(kind,args)=>{
    if(kind === 'tripAutoApprovalRealtime')return publishTripAutoApproval(io,args[0]);
    if(kind !== 'tripAutoApprove')throw new Error('INVALID_AUTO_APPROVAL_JOB');
    const result=await processTripAutoApproval(args[0]);
    if(!result)return;
    try {
      await publishTripAutoApproval(io,{id:result.trip.id,review:!result.approved,verifiedAt:result.trip.verifiedAt,autoApprovalSource:args[0].source});
      await prisma.notificationJob.updateMany({where:{id:result.realtimeJobId,completedAt:null,lockedUntil:null},data:{completedAt:new Date()}});
    }catch(error){console.error('[AutoApproval] realtime recovery queued',error.code || error.name);}
  });},1000);
  timer.unref();return()=>clearInterval(timer);
}
