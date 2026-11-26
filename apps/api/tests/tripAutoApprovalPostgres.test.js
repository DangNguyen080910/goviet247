import test from 'node:test';
import assert from 'node:assert/strict';
import pkg from '@prisma/client';
import {pathToFileURL} from 'node:url';
import {createBookableTrip} from '../src/services/carAvailability.js';
import {createTripAutoApprovalProcessor} from '../src/services/tripAutoApproval.js';
import {createNotificationOutbox,AUTO_APPROVAL_JOB_KINDS} from '../src/services/notificationOutbox.js';

const url=process.env.AUTO_APPROVAL_TEST_DB_URL;
test('PostgreSQL: default-off migration, atomic booking queue, concurrent approval and separate workers',{skip:!url},async()=>{
 const parsed=new URL(url);
 assert.ok(['127.0.0.1','localhost'].includes(parsed.hostname));assert.match(parsed.pathname,/^\/goviet247_auto_approval_test_[a-z0-9_]+$/);
 const client=process.env.AUTO_APPROVAL_TEST_CLIENT ? await import(pathToFileURL(process.env.AUTO_APPROVAL_TEST_CLIENT).href) : pkg;
 const db=new client.PrismaClient({datasources:{db:{url}}});
 try{
  // Requires the full schema in a DISPOSABLE database. Never point this at dev/prod.
  await db.$executeRawUnsafe('TRUNCATE TABLE "Trip", "User", "TripConfig", "PricingConfig", "NotificationJob" CASCADE');
  const config=await db.tripConfig.create({data:{}});assert.equal(config.autoApproveNewTrips,false);assert.equal(config.autoApproveRequeuedTrips,false);
  await db.pricingConfig.create({data:{carType:'CAR_5',isActive:true,baseFare:50000,pricePerKm:10000,pricePerHour:10000,minFare:100000,overnightFee:200000}});
  const input={pickupAddress:'123 Nguyễn Huệ, Phường Sài Gòn, Thành phố Hồ Chí Minh',dropoffAddress:'Ấp Bình An, Xã Bình An, Tỉnh Đồng Nai',bookingStops:['Ấp Bình An, Xã Bình An, Tỉnh Đồng Nai'],
   carType:'CAR_5',direction:'ONE_WAY',status:'PENDING',pickupTime:new Date('2099-01-01T08:00:00+07:00'),distanceKm:50,basePricePerKm:10000,totalPrice:500000};
  const old=await createBookableTrip(db,{...input,bookingRequestKey:'before-toggle'});assert.equal(await db.notificationJob.count(),0);
  await db.tripConfig.update({where:{id:config.id},data:{autoApproveNewTrips:true}});
  for(const [id,province] of [['south','79'],['north','01']])await db.user.create({data:{id,primaryRole:'DRIVER',driverProfile:{create:{status:'VERIFIED',operatingProvinceCode:province,operatingProvinceConfirmedAt:new Date(),vehicleType:'CAR_5'}}}});
  const booked=await createBookableTrip(db,{...input,bookingRequestKey:'after-toggle'});
  assert.equal(booked.__autoApprovalQueued,true);const job=await db.notificationJob.findFirst({where:{kind:'tripAutoApprove'}});assert.ok(job);
  const replay=await createBookableTrip(db,{...input,bookingRequestKey:'after-toggle'});assert.equal(replay.__bookingReplay,true);assert.equal(await db.notificationJob.count(),1);
  const processor=createTripAutoApprovalProcessor({db,resolveAddresses:async addresses=>addresses.map(address=>({address,provinceCode:'79',lat:10.8,lng:106.7,name:address.split(',')[0]}))});
  await Promise.all([processor(job.payload[0]),processor(job.payload[0])]);
  const approved=await db.trip.findUnique({where:{id:booked.id}});assert.equal(approved.isVerified,true);assert.deepEqual(approved.audienceDriverIds,['south']);assert.equal(approved.totalPrice,500000);
  assert.equal(await db.adminTripActionLog.count({where:{tripId:booked.id,actorRole:'SYSTEM'}}),1);
  const queued=await db.notificationJob.findMany({where:{kind:'sendAdminPushNotification'}});assert.equal(queued.length,1);assert.equal(queued[0].payload[0].data.source,'auto_verify_trip');
  assert.equal((await db.trip.findUnique({where:{id:old.id}})).isVerified,false,'toggling on must not approve old backlog');
  const deliveries=[],logger={error(){}};
  await createNotificationOutbox({db,logger,excludeKinds:AUTO_APPROVAL_JOB_KINDS}).drain(async kind=>deliveries.push(kind));
  assert.ok(deliveries.includes('sendNewTripToDrivers'));assert.equal(deliveries.some(kind=>AUTO_APPROVAL_JOB_KINDS.includes(kind)),false);
  const auto=[];await createNotificationOutbox({db,logger,kinds:AUTO_APPROVAL_JOB_KINDS}).drain(async kind=>auto.push(kind));assert.ok(auto.length);assert.ok(auto.every(kind=>AUTO_APPROVAL_JOB_KINDS.includes(kind)));
 }finally{await db.$disconnect();}
});
