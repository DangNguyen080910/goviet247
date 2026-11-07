import {registerCallDevice,unregisterCallDevice,deliverCallInvites} from '../apps/api/src/services/tripCallDevices.js';
import test,{beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {createTripCallService} from '../apps/api/src/services/tripCallService.js';
import {setChatHeart,chatAccess,chatHeartsForClient,messageWhere} from '../apps/api/src/services/tripChatService.js';
import {tripCallParties,callActorIdentity} from '../apps/api/src/services/tripCallPolicy.js';
import {callAwsConfig} from '../apps/api/src/services/tripCallAws.js';
const url=process.env.TEST_DATABASE_URL;
if(url){const u=new URL(url);assert.ok(['localhost','127.0.0.1'].includes(u.hostname)&&u.pathname==='/goviet247_test');}
const db=url?new PrismaClient({datasources:{db:{url}}}):null;
const integration=(name,fn)=>test(name,{skip:!db},fn);
const caller={id:'driver',role:'RIDER'},passenger={id:'passenger',role:'RIDER'},booker={id:'booker',role:'RIDER'};
const first='device_driver_12345',second='device_passenger_12345',third='device_passenger_67890';
let stopped,service;
const aws={meeting:async id=>({MeetingId:id,MeetingArn:'arn:'+id}),capture:async()=>({MediaPipelineId:'capture',MediaPipelineArn:'arn:capture'}),concatenate:async()=>({MediaPipelineId:'concat'}),attendee:async(_m,_id,side)=>({AttendeeId:side,JoinToken:'secret-'+side}),stopCapture:async()=>{stopped.push('capture');},stopMeeting:async()=>{stopped.push('meeting');},recording:async()=>null,recordingUrl:async()=> 'private-url'};
async function trip(id='trip',data={}) {return db.trip.create({data:{id,riderId:'booker',riderPhone:'0900000001',driverId:'driver',acceptedAt:new Date(Date.now()-1000),pickupAddress:'A',dropoffAddress:'B',distanceKm:10,status:'ACCEPTED',isVerified:true,basePricePerKm:10000,carType:'CAR_5',direction:'ONE_WAY',pickupTime:new Date(),totalPrice:100000,...data}});}
async function start(tripId='trip',clientId='request_call_123456'){return service.start(tripId,{...caller},{deviceId:first,clientId,consent:true});}
beforeEach(async()=>{
 if(!db)return;
 await db.$executeRawUnsafe('TRUNCATE TABLE "User", "Trip", "PartnerCompany" CASCADE');
 for(const id of ['driver','driver2','passenger','booker','manager'])await db.user.create({data:{id,displayName:id,...(id.startsWith('driver')?{driverProfile:{create:{status:'VERIFIED'}}}:{})}});
 await db.phone.create({data:{e164:'+84900000001',userId:'passenger',isVerified:true}});
 await trip();stopped=[];service=createTripCallService(db,aws);
});
after(async()=>{if(db)await db.$disconnect();});
test('calls use the instance role provider even when legacy upload keys exist',()=>{
 const config=callAwsConfig({TRIP_CALL_RECORDINGS_BUCKET:'goviet247-prod',AWS_ACCESS_KEY_ID:'old',AWS_SECRET_ACCESS_KEY:'old'});
 assert.equal(typeof config.credentials,'function');assert.equal(config.region,'ap-southeast-1');
 assert.throws(()=>callAwsConfig({TRIP_CALL_RECORDINGS_BUCKET:'goviet247-prod',TRIP_CALL_AWS_REGION:'us-east-1'}));
});
integration('booking on behalf: only passenger can ring; booker and admin cannot initiate',async()=>{
 const eligibility=await service.eligibility('trip',{...caller});assert.equal(eligibility.label,'Hành khách');
 assert.equal((await service.eligibility('trip',{...booker})).canCall,false);
 assert.equal((await service.eligibility('trip',{id:'admin-1',role:'ADMIN'})).canCall,false);
 const c=await start();assert.equal('meeting' in c,false);assert.equal('callerAliases' in c,false);
 assert.equal((await service.incoming({...passenger},second)).length,1);
 assert.equal((await service.incoming({...booker},second)).length,0);
});
integration('missing or unverified passenger account never falls back to booker',async()=>{
 await db.phone.updateMany({data:{isVerified:false}});
 assert.equal((await service.eligibility('trip',{...caller})).canCall,false);
 await assert.rejects(start(),e=>e.code==='CALL_RECIPIENT_UNAVAILABLE');
 assert.equal(await db.tripCall.count(),0);
});
integration('two different trips cannot reserve the same passenger concurrently',async()=>{
 await trip('trip2',{driverId:'driver2'});
 const results=await Promise.allSettled([start(),service.start('trip2',{id:'driver2',role:'RIDER'},{deviceId:third,clientId:'second_request_12345',consent:true})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.find(r=>r.status==='rejected').reason.code,'CALL_BUSY');
 assert.equal(await db.tripCall.count(),1);
});
integration('independent accounts can call on separate trips concurrently',async()=>{
 await db.user.create({data:{id:'passenger2'}});await db.phone.create({data:{e164:'+84900000002',userId:'passenger2',isVerified:true}});await trip('trip2',{driverId:'driver2',riderPhone:'0900000002'});
 const results=await Promise.all([start(),service.start('trip2',{id:'driver2',role:'RIDER'},{deviceId:third,clientId:'second_request_12345',consent:true})]);assert.equal(results.length,2);
});
integration('retrying call creation is idempotent and cannot change the device',async()=>{
 const c=await start();assert.equal((await start()).id,c.id);
 await assert.rejects(service.start('trip',{...caller},{deviceId:third,clientId:'request_call_123456',consent:true}));assert.equal(await db.tripCall.count(),1);
});
integration('first receiver wins and other device cannot read media credentials or hang up',async()=>{
 const c=await start();
 const results=await Promise.allSettled([second,third].map(deviceId=>service.accept(c.id,{...passenger},{deviceId,consent:true})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const row=await db.tripCall.findUnique({where:{id:c.id}}),loser=row.calleeDevice===second?third:second;
 const winner=await service.session(c.id,{...passenger},row.calleeDevice);assert.ok(winner.attendee.JoinToken);
 await assert.rejects(service.session(c.id,{...passenger},loser),e=>e.code==='CALL_ANSWERED_ELSEWHERE');
 await assert.rejects(service.end(c.id,{...passenger},{deviceId:loser}));
 await assert.rejects(service.session(c.id,{...booker},first));
});
integration('both participants must consent; media starts only after recording allocation',async()=>{
 await assert.rejects(service.start('trip',{...caller},{deviceId:first,clientId:'consent_request_12345',consent:false}));
 const c=await start();await assert.rejects(service.accept(c.id,{...passenger},{deviceId:second,consent:false}));
 assert.equal('attendee' in await service.session(c.id,{...caller},first),false);
 await service.accept(c.id,{...passenger},{deviceId:second,consent:true});
 await service.heartbeat(c.id,{...caller},{deviceId:first,joined:true});
 assert.equal((await service.heartbeat(c.id,{...passenger},{deviceId:second,joined:true})).status,'CONNECTED');
});
integration('hangup frees busy reservation, creates a single chat log and retries AWS cleanup',async()=>{
 const c=await start();await service.accept(c.id,{...passenger},{deviceId:second,consent:true});
 await service.end(c.id,{...caller},{deviceId:first});await service.end(c.id,{...caller},{deviceId:first});
 assert.equal(await db.tripCallReservation.count(),0);assert.equal(await db.tripChatMessage.count(),1);
 await service.sweep();assert.deepEqual(stopped,['capture','meeting']);assert.equal('attendee' in await service.session(c.id,{...caller},first),false);
});
integration('recording allocation failure ends call and prevents any media credentials',async()=>{
 service=createTripCallService(db,{...aws,capture:async()=>{throw new Error('failed');}});const c=await start();
 await assert.rejects(service.accept(c.id,{...passenger},{deviceId:second,consent:true}),e=>e.code==='CALL_CONNECT_FAILED');
 assert.equal(await db.tripCallReservation.count(),0);assert.equal('attendee' in await service.session(c.id,{...caller},first),false);
 await service.sweep();assert.ok(stopped.includes('meeting'));
});
integration('reassignment revokes session access and recovery ends old call',async()=>{
 const c=await start();await db.trip.update({where:{id:'trip'},data:{driverId:'driver2'}});
 await assert.rejects(service.session(c.id,{...caller},first));await service.sweep();assert.equal(await db.tripCallReservation.count(),0);
});
integration('only genuine ADMIN, excluding STAFF, can fetch recordings and access is audited',async()=>{
 const c=await start();await db.tripCall.update({where:{id:c.id},data:{recordingKey:`call-recordings/${c.id}/final/audio/c.mp4`}});
 for(const a of [passenger,caller,booker,{id:'admin-1',role:'ADMIN',recordingAdmin:false}])await assert.rejects(service.recording(c.id,a));
 assert.equal((await service.recording(c.id,{id:'admin-2',role:'ADMIN',recordingAdmin:true})).url,'private-url');assert.equal(await db.tripChatAccess.count(),1);
});
integration('recording-ready notification is ADMIN-only and deduplicated',async()=>{
 service=createTripCallService(db,{...aws,recording:async()=> 'call-recordings/test/final/audio/record.mp4'});
 const c=await start();await service.accept(c.id,{...passenger},{deviceId:second,consent:true});await service.end(c.id,{...caller},{deviceId:first});await service.sweep();await service.sweep();
 const messages=await db.tripChatMessage.findMany({where:{recordingCallId:c.id}});assert.equal(messages.length,1);assert.equal(messages[0].audience,'ADMIN');
});
integration('partner calls target assigned dispatcher and its Rider alias; manager/creator do not ring',async()=>{
 await db.partnerCompany.create({data:{id:'company',code:'TEST',name:'Test',managementName:'Manager',managementPhone:'+84900000003',members:{create:[{id:'assigned',username:'assigned',displayName:'Assigned',passwordHash:'test',phone:'+84900000001',mustChangePassword:false},{id:'creator',username:'creator',displayName:'Creator',passwordHash:'test',phone:'+84900000003',role:'ADMIN',mustChangePassword:false}]}}});
 const t=await db.trip.update({where:{id:'trip'},data:{partnerCompanyId:'company',partnerAssignedToId:'assigned',partnerCreatedById:'creator'}});
 const p=await tripCallParties(db,t);assert.equal(p.receiver.id,'partner-assigned');assert.ok(p.receiver.aliases.includes('passenger'));
 await assert.rejects(callActorIdentity(db,{id:'partner-creator',role:'PARTNER',memberId:'creator'},p));
 const c=await start();assert.equal((await service.incoming({id:'partner-assigned',role:'PARTNER',memberId:'assigned'},second))[0].id,c.id);
 assert.equal((await service.incoming({...passenger},third)).length,1);
});
integration('hearts enforce actual message audience, deletion and concurrent deduplication',async()=>{
 const m=await db.tripChatMessage.create({data:{tripId:'trip',senderId:'x',senderRole:'SYSTEM',senderLabel:'System',kind:'TEXT',text:'private',audience:'RIDER',clientId:'private-message'}});
 await assert.rejects(setChatHeart(db,'trip',m.id,{...caller},true));
 await Promise.all([1,2].map(()=>setChatHeart(db,'trip',m.id,{...passenger},true)));assert.equal(await db.tripChatReaction.count(),1);
 await db.tripChatMessage.update({where:{id:m.id},data:{deletedAt:new Date()}});await assert.rejects(setChatHeart(db,'trip',m.id,{...passenger},true));
 const serialized=chatHeartsForClient(await db.tripChatMessage.findUnique({where:{id:m.id},include:{reactions:true}}),passenger);assert.equal(serialized.heartCount,0);assert.equal('reactions' in serialized,false);
});

integration('recording message is invisible to STAFF, riders and driver but visible to ADMIN',async()=>{
 const m=await db.tripChatMessage.create({data:{tripId:'trip',senderId:'system-call',senderRole:'SYSTEM',senderLabel:'Recording',kind:'TEXT',text:'private recording',audience:'ADMIN',clientId:'recording-visibility',recordingCallId:'example'}});
 const t=await db.trip.findUnique({where:{id:'trip'}});
 for(const a of [{id:'admin-staff',role:'ADMIN',recordingAdmin:false},passenger,{id:'driver',role:'DRIVER'}]) assert.equal(await db.tripChatMessage.count({where:messageWhere(t,a)}),0);
 assert.equal(await db.tripChatMessage.count({where:messageWhere(t,{id:'admin-1',role:'ADMIN',recordingAdmin:true})}),1);
});

const pushSession={id:'legacy_calls_test',appRole:'RIDER',expiresAt:new Date(Date.now()+3600000)};
const deviceBody={deviceId:'installation_passenger_123456',appKind:'RIDER',token:'a'.repeat(64),environment:'production'};
async function registerPassenger(extra={}){return registerCallDevice(db,{...passenger},pushSession,{...deviceBody,...extra});}
integration('VoIP registration is session bound and unchanged registrations preserve generation',async()=>{
 await registerPassenger();const first=await db.tripCallDevice.findFirst();assert.equal(first.userId,'passenger');assert.equal(first.pushSessionId,pushSession.id);
 await registerPassenger();assert.equal((await db.tripCallDevice.findFirst()).generation,first.generation);
 await registerCallDevice(db,{...passenger},{...pushSession,id:'legacy_other_session'},deviceBody);assert.notEqual((await db.tripCallDevice.findFirst()).generation,first.generation);
});
integration('only allowed native apps with verified driver profiles may register calling tokens',async()=>{
 for(const [actor,session,body] of [[{id:'admin-1',role:'ADMIN'},pushSession,deviceBody],[passenger,null,deviceBody],[passenger,pushSession,{...deviceBody,appKind:'DRIVER'}],[passenger,{...pushSession,appRole:null},{...deviceBody,appKind:'DRIVER'}],[passenger,pushSession,{...deviceBody,appKind:'ADMIN'}],[passenger,pushSession,{...deviceBody,environment:'other'}],[passenger,pushSession,{...deviceBody,token:'ExpoPushToken[x]'}]])await assert.rejects(registerCallDevice(db,actor,session,body));
 assert.equal(await db.tripCallDevice.count(),0);
});
integration('persistent and legacy logout/revocation suppress ring delivery',async()=>{
 const c=await start();await registerPassenger();await db.session.create({data:{id:pushSession.id,userId:'passenger',refreshTokenHash:'unused',expiresAt:new Date(0)}});
 const sent=[];await deliverCallInvites(db,{send:async v=>{sent.push(v);return {accepted:true};}});assert.equal(sent.length,0);
});
integration('two phones receive the same call once each; booker does not ring',async()=>{
 await start();await registerPassenger();await registerPassenger({deviceId:'second_passenger_phone',token:'b'.repeat(64)});
 await registerCallDevice(db,{...booker},{...pushSession,id:'legacy_booker'}, {...deviceBody,deviceId:'booker_phone_123456',token:'c'.repeat(64)});
 const sent=[];const apns={send:async v=>{sent.push(v);return {accepted:true};}};await deliverCallInvites(db,apns);await deliverCallInvites(db,apns);
 assert.equal(sent.length,2);assert.equal(new Set(sent.map(v=>v.callId)).size,1);assert.deepEqual(new Set(sent.map(v=>v.token)),new Set(['a'.repeat(64),'b'.repeat(64)]));
});
integration('accepted, cancelled and expired invitations are never dispatched',async()=>{
 const c=await start();await registerPassenger();await db.tripCall.update({where:{id:c.id},data:{createdAt:new Date(Date.now()-46000)}});
 const sent=[];const apns={send:async v=>{sent.push(v);return {accepted:true};}};await deliverCallInvites(db,apns);assert.equal(sent.length,0);
 await db.tripCall.update({where:{id:c.id},data:{createdAt:new Date(),status:'CANCELLED'}});await deliverCallInvites(db,apns);assert.equal(sent.length,0);
});
integration('APNs expired device token removes only its exact binding; configuration failures retain devices',async()=>{
 await start();await registerPassenger();await deliverCallInvites(db,{send:async()=>({accepted:false,status:403,permanent:false})});assert.equal(await db.tripCallDevice.count(),1);
 await db.tripCallInvite.updateMany({data:{attemptAt:new Date(0)}});await deliverCallInvites(db,{send:async()=>({accepted:false,status:410,permanent:true})});assert.equal(await db.tripCallDevice.count(),0);
});
integration('outbox retries network failures without recording secret error text',async()=>{
 await start();await registerPassenger();const apns={send:async()=>{throw Object.assign(new Error('private-device-token'),{code:'APNS_TIMEOUT'});}};await deliverCallInvites(db,apns);
 const delivery=await db.tripCallInvite.findFirst();assert.equal(delivery.lastError,'APNS_TIMEOUT');assert.equal(delivery.attempts,1);
 await deliverCallInvites(db,apns);assert.equal((await db.tripCallInvite.findFirst()).attempts,1);
});
integration('unregister only removes own session; a stale login cannot remove a newer binding',async()=>{
 await registerPassenger();await unregisterCallDevice(db,{...booker},pushSession,deviceBody.deviceId);assert.equal(await db.tripCallDevice.count(),1);
 await unregisterCallDevice(db,{...passenger},{...pushSession,id:'legacy_old'},deviceBody.deviceId);assert.equal(await db.tripCallDevice.count(),1);
 await unregisterCallDevice(db,{...passenger},pushSession,deviceBody.deviceId);assert.equal(await db.tripCallDevice.count(),0);
});
integration('Rider caller rings only Driver installation, not the driver account installed in Rider',async()=>{
 await service.start('trip',{...passenger},{deviceId:second,clientId:'rider_calls_driver_12345',consent:true});
 await registerCallDevice(db,{...caller},{...pushSession,id:'legacy_driver',appRole:'DRIVER'},{...deviceBody,appKind:'DRIVER',deviceId:'installation_driver_123456'});
 await registerCallDevice(db,{...caller},{...pushSession,id:'legacy_driver_rider',appRole:'RIDER'},{...deviceBody,appKind:'RIDER',deviceId:'driver_in_rider_123456',token:'b'.repeat(64)});
 const sent=[];await deliverCallInvites(db,{send:async v=>{sent.push(v);return {accepted:true};}});assert.equal(sent.length,1);assert.equal(sent[0].appKind,'DRIVER');
});

integration('reassignment before delivery never rings the former trip participants',async()=>{
 await start();await registerPassenger();await db.trip.update({where:{id:'trip'},data:{driverId:'driver2'}});
 const sent=[];await deliverCallInvites(db,{send:async v=>{sent.push(v);return {accepted:true};}});assert.equal(sent.length,0);
});
integration('concurrent invite workers claim each device delivery once',async()=>{
 await start();await registerPassenger();const sent=[];const sender={send:async v=>{sent.push(v);return {accepted:true};}};
 await Promise.all([deliverCallInvites(db,sender),deliverCallInvites(db,sender)]);assert.equal(sent.length,1);
});

integration('Android call tokens preserve case and share authorized durable delivery with iPhone devices',async()=>{
 const c=await start();const token='ExpoPushToken[Android_Case_Sensitive_123456]';
 await registerPassenger({token,environment:'android-expo'});
 const first=await db.tripCallDevice.findFirst();assert.equal(first.token,token);
 await registerPassenger({token,environment:'android-expo'});assert.equal((await db.tripCallDevice.findFirst()).generation,first.generation);
 await registerPassenger({deviceId:'second_iphone_device_123456'});
 const sent=[];await deliverCallInvites(db,{send:async value=>{sent.push(value);return {accepted:true};}});
 assert.deepEqual(new Set(sent.map(v=>v.environment)),new Set(['android-expo','production']));
 assert.equal(sent.find(v=>v.environment==='android-expo').token,token);
 assert(sent.every(v=>v.callId===c.id));
 await assert.rejects(registerPassenger({token,environment:'production'}));
 await assert.rejects(registerPassenger({token:'a'.repeat(64),environment:'android-expo'}));
});
