import {createBookingQuoteService} from '../src/services/bookingQuotes.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {addressSpecificity,assessAutoApproval,approvalRegion} from '../src/services/tripAutoApprovalPolicy.js';
import {createTripAutoApprovalProcessor,enqueueTripAutoApproval,publishTripAutoApproval} from '../src/services/tripAutoApproval.js';
import {createTripAutoApprovalConfigController} from '../src/controllers/tripAutoApprovalConfigController.js';
import {provinceCodeForPricing} from '../src/services/regionalPricing.js';

const now=new Date('2099-01-01T00:00:00Z');
const pickup='123 Lạc Long Quân, Phường Tân Định, Thành phố Hồ Chí Minh';
const dropoff='Ấp Tân Hoà, Xã Tân Hoà, Tỉnh Vĩnh Long';
const proof=(address,provinceCode='79',name=address.split(',')[0])=>({address,provinceCode,name,lat:10.8,lng:106.7});
const base={id:'auto-trip',version:0,status:'PENDING',isVerified:false,verifiedAt:null,driverId:null,cancelledAt:null,
 updatedAt:new Date('2098-12-31T23:00:00Z'),pickupTime:new Date('2099-01-02T01:00:00Z'),createdAt:new Date('2098-12-31T23:00:00Z'),
 pickupAddress:pickup,dropoffAddress:dropoff,stops:[{seq:1,address:dropoff}],carType:'CAR_5',fuelPreference:'ANY',riderId:'rider',totalPrice:500000,
 audienceDriverIds:['old-private-driver'],audienceRegions:[],autoApprovalReviewReason:null};
const evidence=[proof(pickup),proof(dropoff,'86')];

for(const address of ['123 Nguyễn Huệ, Phường Sài Gòn, TP.HCM','12/3A Nguyễn Trãi, Phường Bến Thành, TP.HCM','Ấp 3, Xã Tân Phú, Tỉnh Đồng Nai','Thôn Bình An, Xã Bình An, Tỉnh Lâm Đồng','Bệnh viện Chợ Rẫy, Phường Chợ Lớn, TP.HCM','Timo Cafe & Camping, Xã Phước Hải, TP.HCM'])test('specific address accepted: '+address,()=>assert.equal(addressSpecificity(address,proof(address)).ok,true));
for(const address of ['TP.HCM, Việt Nam','Phường Tân Định, Thành phố Hồ Chí Minh','Xã Tân Hoà, Tỉnh Vĩnh Long','Đường Nguyễn Huệ, Phường Sài Gòn, TP.HCM','Quốc lộ 1, Tỉnh Đồng Nai','Ấp 3, Phường Sài Gòn, TP.HCM','Tây Ninh, Việt Nam','3 Tháng 2, Phường Sài Gòn, TP.HCM'])test('broad or ambiguous address held for review: '+address,()=>assert.equal(addressSpecificity(address,proof(address)).ok,false));
for(const bad of [{...proof(pickup),address:'different'},{...proof(pickup),provinceCode:null},{...proof(pickup),lat:null},{...proof(pickup),lng:Infinity}])test('untrusted/incomplete evidence cannot auto-approve: '+JSON.stringify(bad),()=>assert.equal(addressSpecificity(pickup,bad).ok,false));
test('every stop must be specific and region always follows pickup, not destination',()=>{
 assert.equal(assessAutoApproval(base,evidence,now).region,'SOUTH');
 assert.equal(assessAutoApproval({...base,pickupAddress:'123 Tràng Tiền, Phường Hoàn Kiếm, Hà Nội'},[proof('123 Tràng Tiền, Phường Hoàn Kiếm, Hà Nội','01'),evidence[1]],now).region,'NORTH');
 const trip={...base,stops:[{address:dropoff},{address:'Phường Sài Gòn, TP.HCM'}]};
 const result=assessAutoApproval(trip,[...evidence,proof(trip.stops[1].address)],now);assert.equal(result.ok,false);assert.match(result.reason,/Điểm đến 2/);
 assert.equal(assessAutoApproval({...base,pickupTime:now},evidence,now).ok,false);
 assert.equal(approvalRegion(provinceCodeForPricing('Bình Dương')).value,'SOUTH');
});


test('auto-approval review reasons independently number pickups and destinations', () => {
 const imprecise = 'W9CH+R35, Xã Hậu Nghĩa, Tỉnh Tây Ninh';
 const extra = '15 Nguyễn Huệ, Phường Sài Gòn, TP.HCM';
 const trip = {...base, stops:[{seq:-1,address:imprecise},{seq:1,address:dropoff}]};
 assert.match(assessAutoApproval(trip,[proof(pickup),proof(imprecise),proof(dropoff)],now).reason,/^Điểm đón 2:/);
 const badDestination = {...trip, stops:[{seq:-1,address:extra},{seq:1,address:imprecise}]};
 assert.match(assessAutoApproval(badDestination,[proof(pickup),proof(extra),proof(imprecise)],now).reason,/^Điểm đến 1:/);
 assert.equal(assessAutoApproval({...trip,stops:[{seq:-1,address:extra},{seq:1,address:dropoff}]},
   [proof(pickup),proof(extra),proof(dropoff)],now).ok,true);
});

function fixture(options={}) {
 let state=structuredClone({...base,...options.trip}),jobs=[],logs=[],notices=[],serial=Promise.resolve();
 const flags={id:1,autoApproveNewTrips:true,autoApproveRequeuedTrips:true,...options.flags};
 const profiles=[{userId:'south-5',vehicleType:'CAR_5',vehicleFuelType:'ELECTRIC',operatingProvinceCode:'79',operatingProvinceConfirmedAt:now,status:'VERIFIED',tripAcceptBlocked:false},
  {userId:'south-7',vehicleType:'CAR_7',vehicleFuelType:'GASOLINE',operatingProvinceCode:'86',operatingProvinceConfirmedAt:now,status:'VERIFIED',tripAcceptBlocked:false},
  {userId:'south-16',vehicleType:'CAR_16',vehicleFuelType:'ELECTRIC',operatingProvinceCode:'79',operatingProvinceConfirmedAt:now,status:'VERIFIED',tripAcceptBlocked:false},
  {userId:'north',vehicleType:'CAR_16',vehicleFuelType:'ELECTRIC',operatingProvinceCode:'01',operatingProvinceConfirmedAt:now,status:'VERIFIED',tripAcceptBlocked:false},
  {userId:'unconfirmed',vehicleType:'CAR_16',vehicleFuelType:'ELECTRIC',operatingProvinceCode:'79',operatingProvinceConfirmedAt:null,status:'VERIFIED',tripAcceptBlocked:false},
  {userId:'blocked',vehicleType:'CAR_16',vehicleFuelType:'ELECTRIC',operatingProvinceCode:'79',operatingProvinceConfirmedAt:now,status:'VERIFIED',tripAcceptBlocked:true}];
 const db={trip:{findUnique:async()=>structuredClone(state)},tripConfig:{findFirst:async()=>({...flags})},
  async $transaction(fn){let release;const previous=serial;serial=new Promise(r=>release=r);await previous;
   const draft=structuredClone(state),out=[],history=[],notifications=[];
   const tx={
    $queryRawUnsafe:async()=>[],trip:{findUnique:async()=>structuredClone(draft),update:async({data})=>{Object.assign(draft,data,{updatedAt:new Date(new Date(draft.updatedAt).getTime()+1)});return structuredClone(draft);}},
    tripConfig:db.tripConfig,driverConfig:{findFirst:async()=>({newTripAcceptDelaySeconds:10})},
    driverProfile:{findMany:async({where})=>(options.noDrivers?[]:profiles).filter(p=>p.status===where.status && p.tripAcceptBlocked===where.tripAcceptBlocked && p.operatingProvinceConfirmedAt && where.operatingProvinceCode.in.includes(p.operatingProvinceCode))},
    adminTripActionLog:{create:async({data})=>{history.push(data);return data;}},systemNotification:{create:async({data})=>{notifications.push(data);return data;}},
    notificationJob:{create:async({data})=>{if(options.failQueue)throw Error('queue insert failed');out.push(data);return data;}},
   };
   try{const value=await fn(tx);state=draft;jobs.push(...out);logs.push(...history);notices.push(...notifications);return value;}finally{release();}
  }};
 const processor=createTripAutoApprovalProcessor({db,clock:()=>new Date(now),resolveAddresses:options.resolve || (async()=>evidence)});
 return {db,processor,flags,profiles,options,job:{id:base.id,source:'NEW',version:base.version,updatedAt:base.updatedAt},
  get trip(){return state;},get jobs(){return jobs;},get logs(){return logs;},get notices(){return notices;},mutate:fn=>fn(state)};
}
for(const source of ['NEW','REQUEUE'])test(source+': independent toggle queues only subsequent corresponding requests',async()=>{
 const jobs=[];const trip=structuredClone(base),flags={autoApproveNewTrips:false,autoApproveRequeuedTrips:false};
 const tx={tripConfig:{findFirst:async()=>flags},notificationJob:{create:async({data})=>jobs.push(data)}};
 assert.equal(await enqueueTripAutoApproval(tx,trip,source),false);assert.equal(jobs.length,0);
 flags[source==='NEW'?'autoApproveRequeuedTrips':'autoApproveNewTrips']=true;
 assert.equal(await enqueueTripAutoApproval(tx,trip,source),false);
 flags[source==='NEW'?'autoApproveNewTrips':'autoApproveRequeuedTrips']=true;
 assert.equal(await enqueueTripAutoApproval(tx,trip,source),true);assert.equal(jobs.length,1);
 assert.equal(jobs[0].kind,'tripAutoApprove');assert.equal(jobs[0].payload[0].source,source);
 assert.equal(trip.__autoApprovalQueued,true);assert.equal(Object.keys(trip).includes('__autoApprovalQueued'),false);
});
for(const carType of ['CAR_5','CAR_7','CAR_16'])test(carType+': auto approval broadcasts compatible vehicles in the confirmed pickup region and preserves price',async()=>{
 const f=fixture({trip:{carType}});const result=await f.processor(f.job);
 assert.equal(result.approved,true);assert.equal(f.trip.totalPrice,500000);assert.equal(f.trip.carType,carType);
 assert.deepEqual(f.trip.audienceDriverIds,carType==='CAR_5'?['south-5','south-7','south-16']:carType==='CAR_7'?['south-7','south-16']:['south-16']);assert.deepEqual(f.trip.audienceRegions,['SOUTH']);
 assert.equal(new Date(f.trip.driverAcceptOpenAt)-now,10000);assert.equal(f.trip.verifiedById,null);
 assert.equal(f.logs[0].eventData.kind,'APPROVED');assert.equal(f.logs[0].actorRole,'SYSTEM');
 const admin=f.jobs.filter(job=>job.kind==='sendAdminPushNotification');assert.equal(admin.length,1);
 assert.equal(admin[0].payload[0].data.source,'auto_verify_trip');assert.equal(admin[0].payload[0].data.type,'ADMIN_TRIP_STATUS_CHANGED');
 assert.ok(f.jobs.some(job=>job.kind==='sendNewTripToDrivers'));assert.equal(f.notices.length,1);
});
test('parallel duplicate processing commits one approval, one driver push and one admin status push',async()=>{
 const f=fixture();await Promise.all([f.processor(f.job),f.processor(f.job),f.processor(f.job)]);
 assert.equal(f.logs.length,1);assert.equal(f.jobs.filter(job=>job.kind==='sendNewTripToDrivers').length,1);
 assert.equal(f.jobs.filter(job=>job.kind==='sendAdminPushNotification').length,1);
});
for(const options of [{noDrivers:true},{resolve:async()=>{throw Error('map unavailable');}},{resolve:async()=>[proof(pickup),proof('TP.HCM, Việt Nam')]}])test('uncertain address/empty region fails closed and sends normal pending notification',async()=>{
 const f=fixture(options);const result=await f.processor(f.job);assert.equal(result.approved,false);assert.equal(f.trip.isVerified,false);
 assert.ok(f.trip.autoApprovalReviewReason);assert.equal(f.jobs.some(job=>job.kind==='sendNewTripToDrivers'),false);
 assert.equal(f.jobs.find(job=>job.kind==='sendAdminPushNotification').payload[0].data.type,'ADMIN_NEW_TRIP');
 await f.processor(f.job);assert.equal(f.logs.length,1);assert.equal(f.jobs.length,2);
});
test('transaction failure rolls back approval, history and all notification jobs; a retry succeeds',async()=>{
 const f=fixture({failQueue:true});await assert.rejects(f.processor(f.job),/queue insert/);
 assert.equal(f.trip.isVerified,false);assert.equal(f.logs.length,0);assert.equal(f.jobs.length,0);
 f.options.failQueue=false;assert.equal((await f.processor(f.job)).approved,true);
});
for(const change of ['cancelled','manualApproved','edited','toggleOff'])test(change+' during map lookup is rechecked under transaction lock',async()=>{
 let release,entered;const ready=new Promise(r=>entered=r),waiting=new Promise(r=>release=r);
 const f=fixture({resolve:async()=>{entered();await waiting;return evidence;}});const work=f.processor(f.job);await ready;
 if(change==='cancelled')f.mutate(trip=>{trip.status='CANCELLED';trip.cancelledAt=now;});
 if(change==='manualApproved')f.mutate(trip=>{trip.isVerified=true;trip.verifiedAt=now;trip.audienceDriverIds=['manual-private'];});
 if(change==='edited')f.mutate(trip=>{trip.updatedAt=now;trip.totalPrice=700000;});
 if(change==='toggleOff')f.flags.autoApproveNewTrips=false;
 release();await work;
 assert.equal(f.jobs.some(job=>job.kind==='sendNewTripToDrivers'),false);
 if(change==='manualApproved')assert.deepEqual(f.trip.audienceDriverIds,['manual-private']);
 if(change==='edited')assert.equal(f.trip.totalPrice,700000);
});
test('requeued approval is identified in the admin notification and a fresh shared countdown',async()=>{
 const f=fixture({trip:{version:3}});const result=await f.processor({...f.job,version:3,source:'REQUEUE'});assert.equal(result.approved,true);
 const push=f.jobs.find(job=>job.kind==='sendAdminPushNotification').payload[0];assert.equal(push.data.autoApprovalSource,'REQUEUE');assert.match(push.title,/duyệt lại/);
});
test('committed audience is used for realtime and no public room or full address leaks',async()=>{
 const f=fixture();await f.processor(f.job);const events=[];const io={to:room=>({emit:(event,payload)=>events.push({room,event,payload})})};
 await publishTripAutoApproval(io,{id:f.trip.id,verifiedAt:f.trip.verifiedAt,autoApprovalSource:'NEW'},f.db);
 const driver=events.find(event=>event.event==='trip:new');assert.deepEqual(driver.room,['driver:south-5','driver:south-7','driver:south-16']);
 assert.ok(!driver.payload.pickupAddressMasked.includes('123'));assert.equal(driver.payload.driverAcceptOpenAt.getTime(),f.trip.driverAcceptOpenAt.getTime());
 assert.equal(events.find(event=>event.event==='admin:trip_status_changed').payload.source,'auto_verify_trip');
 f.mutate(trip=>{trip.isVerified=false;trip.verifiedAt=null;});events.length=0;await publishTripAutoApproval(io,{id:f.trip.id,verifiedAt:now},f.db);assert.equal(events.length,0);
});

const res=()=>({statusCode:200,status(value){this.statusCode=value;return this;},setHeader(){},json(value){this.body=value;return this;}});
test('settings PATCH is strict, preserves unrelated settings, and rejects stale versions',async()=>{
 let value={id:1,autoApproveNewTrips:false,autoApproveRequeuedTrips:false,maxStops:30,updatedAt:now};
 const db={tripConfig:{findFirst:async()=>value,update:async({where,data})=>{assert.equal(where.updatedAt,value.updatedAt);value={...value,...data,updatedAt:new Date(value.updatedAt.getTime()+1)};return value;}}};
 const api=createTripAutoApprovalConfigController(db);
 for(const body of [{autoApproveNewTrips:'true'},{autoApproveNewTrips:true,autoApproveRequeuedTrips:true},{autoApproveNewTrips:true,maxStops:0}]){const response=res();await api.patch({body},response);assert.equal(response.statusCode,400);}
 const response=res();await api.patch({body:{autoApproveNewTrips:true,expectedUpdatedAt:now.toISOString()}},response);assert.equal(response.statusCode,200);assert.equal(value.autoApproveNewTrips,true);assert.equal(value.autoApproveRequeuedTrips,false);assert.equal(value.maxStops,30);
 const stale=res();await api.patch({body:{autoApproveRequeuedTrips:true,expectedUpdatedAt:now.toISOString()}},stale);assert.equal(stale.statusCode,409);assert.equal(value.autoApproveRequeuedTrips,false);
});

test('auto approval reuses server-verified canonical addresses and province metadata without another map lookup',async()=>{
 const addresses=[pickup,dropoff],places=addresses.map((fullAddress,i)=>({fullAddress,name:fullAddress.split(',')[0],province:i?'Vĩnh Long':'Bình Dương',lat:10.8+i,lng:106.7+i}));let lookups=0;
 const service=createBookingQuoteService({knownPlace:()=>null,detail:async id=>{lookups++;return places[Number(id.split('|').at(-1))];},search:async()=>assert.fail('verified canonical alias must be cached'),route:async()=>({distanceKm:50,durationMinutes:60,outboundDurationMinutes:60,returnDurationMinutes:0})});
 await service.verifiedRoute({pickupAddress:pickup,dropoffAddress:dropoff,stops:[dropoff],pickupTime:'2099-01-02T08:00:00+07:00',direction:'ONE_WAY',routePricingPoints:addresses.map((address,i)=>({address,placeId:'goong|'+i}))});
 assert.equal(lookups,2);const proof=await service.verifiedAddresses(addresses);assert.equal(lookups,2);assert.deepEqual(proof.map(p=>p.provinceCode),['79','86']);assert.deepEqual(proof.map(p=>p.address),addresses);
});

for(const source of ['NEW','REQUEUE'])for(const carType of ['CAR_5','CAR_7','CAR_16'])for(const fuelPreference of ['ANY','ELECTRIC','GASOLINE'])test(`${source} ${carType} ${fuelPreference}: regional capacity and fuel intersection`,async()=>{
 const f=fixture({trip:{carType,fuelPreference}});
 // Include unknown vehicle/fuel profiles; unknown fuel is only eligible for ANY.
 f.profiles.push({userId:'unknown-fuel',vehicleType:'CAR_16',vehicleFuelType:null,operatingProvinceCode:'79',operatingProvinceConfirmedAt:now,status:'VERIFIED',tripAcceptBlocked:false});
 f.profiles.push({userId:'unknown-car',vehicleType:null,vehicleFuelType:'ELECTRIC',operatingProvinceCode:'79',operatingProvinceConfirmedAt:now,status:'VERIFIED',tripAcceptBlocked:false});
 const expected={CAR_5:{ANY:['south-5','south-7','south-16','unknown-fuel'],ELECTRIC:['south-5','south-16'],GASOLINE:['south-7']},
 CAR_7:{ANY:['south-7','south-16','unknown-fuel'],ELECTRIC:['south-16'],GASOLINE:['south-7']},
 CAR_16:{ANY:['south-16','unknown-fuel'],ELECTRIC:['south-16'],GASOLINE:[]}}[carType][fuelPreference];
 const result=await f.processor({...f.job,source});
 assert.equal(result.approved,expected.length>0);assert.equal(f.trip.totalPrice,500000);
 assert.equal(f.jobs.filter(j=>j.kind==='sendAdminPushNotification').length,1);
 if(expected.length){assert.deepEqual(f.trip.audienceDriverIds,expected);assert.ok(f.jobs.some(j=>j.kind==='sendNewTripToDrivers'));}
 else {assert.equal(f.trip.isVerified,false);assert.match(f.trip.autoApprovalReviewReason,/số chỗ và nhiên liệu/);assert.equal(f.jobs.some(j=>j.kind==='sendNewTripToDrivers'),false);}
});
test('auto approval reads the vehicle after the address check, not from a stale pre-check snapshot',async()=>{
 let entered,release;const ready=new Promise(r=>entered=r),wait=new Promise(r=>release=r);
 const f=fixture({trip:{carType:'CAR_7',fuelPreference:'GASOLINE'},resolve:async()=>{entered();await wait;return evidence;}});
 const work=f.processor(f.job);await ready;f.profiles.find(p=>p.userId==='south-7').vehicleFuelType='ELECTRIC';release();
 assert.equal((await work).approved,false);assert.equal(f.trip.isVerified,false);assert.match(f.trip.autoApprovalReviewReason,/nhiên liệu/);
});
