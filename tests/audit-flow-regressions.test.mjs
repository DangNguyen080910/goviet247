import test from 'node:test';
import assert from 'node:assert/strict';
import {createTripCallService} from '../apps/api/src/services/tripCallService.js';
import {deliverCallInvites} from '../apps/api/src/services/tripCallDevices.js';
import {chatMessageInCurrentHistory} from '../apps/api/src/shared/chatAssignmentHistory.js';
import {refundCustomerCancellationHold} from '../apps/api/src/services/customerCancellationRefund.js';
import {registerDriverNoteDraft,flushDriverNoteDraft} from '../apps/mobile-chat/driverNoteDrafts.js';
const now=Date.now();
const trip={id:'trip',driverId:'driver',status:'ACCEPTED',riderPhone:'0900000001'};
const call={id:'call_1',tripId:'trip',callerId:'driver',calleeId:'passenger',callerLabel:'Tài xế',calleeLabel:'Hành khách',callerAliases:['driver'],calleeAliases:['passenger'],callerDevice:'driver_device_123456',createdAt:new Date(now-46000),callerSeenAt:new Date(),calleeSeenAt:new Date(),status:'RINGING'};
function dbFixture(current={...call}){
 const writes=[],messages=[];
 const db={$queryRaw:async()=>[],trip:{findUnique:async()=>trip},driverProfile:{findUnique:async()=>({status:'VERIFIED'})},phone:{findMany:async()=>[{userId:'passenger'}]},tripCallReservation:{deleteMany:async()=>{}},tripChatMessage:{upsert:async({create})=>{messages.push(create);return create;}},tripCall:{findUnique:async()=>current,findMany:async({where})=>where.status.in.includes('RINGING')?[{...call}]:[],update:async({data})=>{writes.push(data);Object.assign(current,data);return current;}}};db.$transaction=fn=>fn(db);return{db,writes,messages};
}
test('sweep rechecks a call answered between candidate scan and row lock',async()=>{
 const f=dbFixture({...call,status:'CONNECTED',startedAt:new Date(),answeredAt:new Date()});
 await createTripCallService(f.db,{}).sweep();assert.equal(f.writes.length,0);
});
test('call summary uses end time for polling and original time only for archive access',async()=>{
 const f=dbFixture({...call});await createTripCallService(f.db,{}).end(call.id,{id:'driver',role:'DRIVER'},{deviceId:call.callerDevice});
 const m=f.messages[0];assert(m.createdAt>call.createdAt);assert.equal(+m.historyAt,+call.createdAt);
 assert.equal(chatMessageInCurrentHistory({chatVisibleFrom:new Date(now-1000)},{role:'RIDER'},m),false);
});
test('recording recovery and live calls have independent rotating queues',async()=>{
 const queries=[];const f=dbFixture();f.db.tripCall.findMany=async q=>{queries.push(q);return Array.from({length:100},(_,i)=>({id:`${q.where.status.in.includes('RINGING')?'active':'record'}_${i}`,status:'OTHER'}));};
 const service=createTripCallService(f.db,{});await service.sweep();await service.sweep();
 assert.equal(queries.length,4);assert.equal(queries[2].where.id.gt,'active_99');assert.equal(queries[3].where.id.gt,'record_99');
});
test('51st ringing call receives its invitation and repeat delivery stays deduplicated',async()=>{
 const calls=Array.from({length:51},(_,i)=>({...call,id:`call_${String(i).padStart(3,'0')}`,createdAt:new Date()}));
 const f=dbFixture();const deliveries=new Map(),sent=[];const device={id:'dev',userId:'passenger',appKind:'RIDER',generation:'g',pushSessionId:'s',token:'abc',environment:'production'};
 f.db.tripCall.findMany=async({where,take})=>calls.filter(c=>!where.id||c.id>where.id.gt).slice(0,take);
 f.db.tripCall.findUnique=async({where})=>calls.find(c=>c.id===where.id);
 f.db.session={findMany:async()=>[{id:'s',userId:'passenger',expiresAt:new Date(Date.now()+60000)}]};f.db.tripCallDevice={findMany:async()=>[device],findUnique:async()=>device};
 f.db.tripCallInvite={upsert:async({create})=>{if(!deliveries.has(create.callId))deliveries.set(create.callId,{id:create.callId,attempts:0});return deliveries.get(create.callId);},updateMany:async({where,data})=>{const d=deliveries.get(where.id);if(d.sentAt||d.attempts!==where.attempts)return{count:0};d.attempts++;d.attemptAt=data.attemptAt;return{count:1};},update:async({where,data})=>Object.assign(deliveries.get(where.id),data)};
 const sender={send:async c=>{sent.push(c.callId);return{accepted:true};}};
 await deliverCallInvites(f.db,sender);await deliverCallInvites(f.db,sender);assert.equal(sent.length,51);assert(sent.includes('call_050'));
});
test('repeated assignment refunds only its own holds and refuses a same-assignment retry',async()=>{
 const current={...trip,walletHoldId:'trip:2',driver:{driverProfile:{id:'wallet'}},commissionAmountSnapshot:100,requiredWalletAmountSnapshot:100};
 const rows=[{type:'COMMISSION_HOLD',amount:-100,walletHoldId:'trip:1',createdAt:new Date(now-10000)},{type:'COMMISSION_REFUND',amount:100,walletHoldId:'trip:1',createdAt:new Date(now-9000)},{type:'COMMISSION_HOLD',amount:-100,walletHoldId:'trip:2',createdAt:new Date(now-1000)}];let balance=800;
 const tx={driverProfile:{update:async({data})=>({balance:balance+=data.balance.increment})},driverWalletTransaction:{findMany:async({where})=>rows.filter(row=>where.type.in.includes(row.type)&&(where.walletHoldId?row.walletHoldId===where.walletHoldId:where.AND?row.walletHoldId===current.walletHoldId: true)),create:async({data})=>{rows.push(data);return data;}}};
 await refundCustomerCancellationHold(tx,current);assert.equal(balance,900);await assert.rejects(refundCustomerCancellationHold(tx,current),{statusCode:409});assert.equal(balance,900);
});
test('approval gate waits for saving and propagates failure without dropping the draft',async()=>{
 let release;const unregister=registerDriverNoteDraft('t',()=>new Promise(resolve=>release=resolve));let complete=false;const pending=flushDriverNoteDraft('t').then(()=>complete=true);await Promise.resolve();assert.equal(complete,false);release();await pending;unregister();
 const remove=registerDriverNoteDraft('t',async()=>{throw Error('save conflict');});await assert.rejects(flushDriverNoteDraft('t'),/save conflict/);remove();
});

test('recording discovery still runs after a two-day outage without stopping cleaned resources again',async()=>{
 const old={...call,status:'ENDED',endedAt:new Date(Date.now()-172800000),cleanupDoneAt:new Date(),concatId:'concat',captureId:'capture',meeting:{MeetingId:'meeting'}};
 const f=dbFixture(old);let found=0;
 f.db.tripCall.findMany=async({where})=>{
  if(where.status.in.includes('RINGING'))return [];
  const recovery=where.OR[1];assert.equal(recovery.endedAt.gte,undefined);return old.recordingKey?[]:[old];
 };
 const aws={recording:async()=>{found++;return 'recordings/call.mp4';},stopCapture:async()=>assert.fail('already cleaned'),stopMeeting:async()=>assert.fail('already cleaned')};
 await createTripCallService(f.db,aws).sweep();
 assert.equal(found,1);assert.equal(old.recordingKey,'recordings/call.mp4');assert.equal(f.messages[0].audience,'ADMIN');
});
