import {phoneVariants} from './riderTripAccess.js';
import {CHAT_ACTIVE_STATUSES} from '../shared/tripChat.js';
export const callError=(message,status=403,code='CALL_FORBIDDEN')=>Object.assign(new Error(message),{status,code});
export const recordingNotice='Cuộc gọi được ghi âm để GoViet247 hỗ trợ và xử lý phản ánh. Chỉ bộ phận quản trị được nghe lại.';
export async function tripCallParties(db, trip) {
 if (!trip?.driverId || !CHAT_ACTIVE_STATUSES.includes(trip.status)) throw callError('Chuyến chưa có tài xế hoặc đã kết thúc.');
 const driver=await db.driverProfile.findUnique({where:{userId:trip.driverId},select:{status:true}});
 if (driver?.status!=='VERIFIED') throw callError('Tài xế hiện không thể nhận cuộc gọi.');
 let receiver;
 if (trip.partnerCompanyId) {
  const member=trip.partnerAssignedToId ? await db.partnerMember.findUnique({where:{id:trip.partnerAssignedToId},include:{company:true}}):null;
  if (!member?.isActive || !member.company?.isActive || member.companyId!==trip.partnerCompanyId || member.mustChangePassword) throw callError('Chuyến chưa có điều phối viên có thể nhận cuộc gọi.',409,'CALL_RECIPIENT_UNAVAILABLE');
  const phones=phoneVariants(member.phone);
  const users=await db.phone.findMany({where:{e164:{in:phones},isVerified:true,userId:{not:null}},select:{userId:true}});
  receiver={id:`partner-${member.id}`,label:'Điều phối viên',aliases:[`partner-${member.id}`,...users.map(p=>p.userId)]};
 } else {
  // riderPhone identifies the passenger, including bookings made on behalf of someone else.
  // Never fall back to riderId: that can be the booker rather than the passenger.
  const phones=phoneVariants(trip.riderPhone);
  const users=phones.length ? await db.phone.findMany({where:{e164:{in:phones},isVerified:true,userId:{not:null}},select:{userId:true}}):[];
  const ids=[...new Set(users.map(p=>p.userId).filter(Boolean))];
  if (ids.length!==1) throw callError('Hành khách chưa có tài khoản ứng dụng có thể nhận cuộc gọi.',409,'CALL_RECIPIENT_UNAVAILABLE');
  receiver={id:ids[0],label:'Hành khách',aliases:ids};
 }
 receiver.aliases=[...new Set(receiver.aliases)];
 if (receiver.aliases.includes(trip.driverId)) throw callError('Không thể gọi cho chính tài khoản của mình.',409);
 return {driver:{id:trip.driverId,label:'Tài xế',aliases:[trip.driverId]},receiver};
}
export async function callActorIdentity(db, actor, parties) {
 if (actor.role==='ADMIN') throw callError('Admin chỉ xem lịch sử và nghe ghi âm sau cuộc gọi.');
 if (parties.driver.aliases.includes(actor.id)) return parties.driver;
 if (parties.receiver.aliases.includes(actor.id)) return parties.receiver;
 // Resolve using verified phones only; the caller cannot choose a destination account.
 if (actor.role==='PARTNER' && actor.memberId && parties.receiver.id===`partner-${actor.memberId}`) return parties.receiver;
 throw callError('Chỉ tài xế và hành khách hoặc điều phối viên phụ trách được gọi.');
}
export function validCallDevice(value) {
 if(typeof value!=='string'|| !/^[a-zA-Z0-9_-]{16,100}$/.test(value)) throw callError('Thiết bị gọi không hợp lệ.',400);
 return value;
}
export function callView(call) {
 return {id:call.id,tripId:call.tripId,status:call.status,callerLabel:call.callerLabel,calleeLabel:call.calleeLabel,
  createdAt:call.createdAt,answeredAt:call.answeredAt,startedAt:call.startedAt,endedAt:call.endedAt,
  recordingNotice,recordingConsentRequired:true};
}

export async function unavailableCallAction(db, trip, actor) {
 if(!trip || !CHAT_ACTIVE_STATUSES.includes(trip.status) || actor.role==='ADMIN')return {};
 if(actor.role==='DRIVER' && trip.driverId===actor.id)return {showUnavailable:true,label:trip.partnerCompanyId?'Điều phối viên':'Hành khách'};
 let phone=trip.riderPhone;
 if(trip.partnerCompanyId){
  if(!trip.partnerAssignedToId)return {};
  if(actor.role==='PARTNER')return actor.memberId===trip.partnerAssignedToId?{showUnavailable:true,label:'Tài xế'}:{};
  const member=await db.partnerMember.findUnique({where:{id:trip.partnerAssignedToId}});
  if(!member?.isActive || member.companyId!==trip.partnerCompanyId)return {};
  phone=member.phone;
 }
 const variants=phoneVariants(phone);if(!variants.length)return {};
 const users=await db.phone.findMany({where:{e164:{in:variants},isVerified:true,userId:{not:null}},select:{userId:true}});
 const ids=[...new Set(users.map(user=>user.userId).filter(Boolean))];
 return ids.length===1&&ids[0]===actor.id?{showUnavailable:true,label:'Tài xế'}:{};
}
