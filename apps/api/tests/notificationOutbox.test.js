import test from 'node:test';
import assert from 'node:assert/strict';
import {createNotificationOutbox,notificationAlreadyAccepted,recordNotificationAccepted,isDeliveringNotification} from '../src/services/notificationOutbox.js';
import {activeAdminDevices} from '../src/services/adminPushAccess.js';
import {adminTokenVersion} from '../src/services/adminSessions.js';
import {sendChatPushBatch} from '../src/services/chatPushTransport.js';
const logger={error(){}};
test('enqueue acknowledges durable insertion without running network delivery',async()=>{
  const rows=[];let delivered=0;
  const queue=createNotificationOutbox({db:{$executeRawUnsafe:async(sql,...values)=>{rows.push(values);return 1;}},logger});
  const result=await queue.enqueue('push',[{id:'offline',at:new Date(0)}],()=>delivered++);
  assert.equal(result.queued,true);assert.equal(delivered,0);assert.equal(rows.length,1);assert.deepEqual(JSON.parse(rows[0][2]),[{id:'offline',at:new Date(0).toISOString()}]);
});
test('enqueue failure cannot turn an already-committed operation into a failure',async()=>{
  let ran=false;
  const queue=createNotificationOutbox({db:{$executeRawUnsafe:async()=>{throw Error('offline');}},logger});
  const result=await queue.enqueue('push',[],()=>{assert.equal(isDeliveringNotification(),true);ran=true;});
  assert.equal(result.queued,false);await new Promise(resolve=>setImmediate(resolve));assert.equal(ran,true);
});
test('accepted token hashes persist before a retry and remain private to each delivery',async()=>{
  const writes=[];const queue=createNotificationOutbox({db:{$executeRawUnsafe:async(...args)=>{writes.push(args);return 1;}},logger});
  await queue.run({id:'job',lockToken:'owner',acceptedTokens:[]},async()=>{
    assert.equal(notificationAlreadyAccepted('token'),false);await recordNotificationAccepted('token');await recordNotificationAccepted('token');
    assert.equal(notificationAlreadyAccepted('token'),true);
  });
  assert.equal(writes.length,1);assert.notEqual(writes[0][1],'token');assert.equal(notificationAlreadyAccepted('token'),false);
});
test('two drain calls on one process do not overlap; failed jobs become retryable',async()=>{
  const writes=[];let claims=0,release;
  const queue=createNotificationOutbox({db:{$queryRawUnsafe:async()=>{claims++;return[{id:'job',kind:'push',payload:[],lockToken:'owner',attempts:1}];},$executeRawUnsafe:async(...args)=>{writes.push(args);return 1;}},logger});
  const first=queue.drain(async()=>new Promise(resolve=>release=resolve));
  await new Promise(resolve=>setImmediate(resolve));await queue.drain(async()=>assert.fail('duplicate'));assert.equal(claims,1);release();await first;
  await queue.drain(async()=>{throw Error('temporary');});assert.ok(writes.some(([sql])=>sql.includes('"runAt"=now()')));
});
test('revoked, expired, mismatched-role and inactive Admin devices never receive push',async()=>{
  const row={id:7,password_hash:'offline',role:'ADMIN',is_active:true,authVersion:1};
  const valid={userId:'admin-7',role:'admin',adminAuthVersion:adminTokenVersion(row),pushExpiresAt:new Date(Date.now()+60000)};
  const db={admin_users:{findMany:async()=>[row]}};
  assert.deepEqual(await activeAdminDevices(db,[valid]),[valid]);
  for(const change of [{adminAuthVersion:'old'},{role:'staff'},{pushExpiresAt:new Date(0)},{pushExpiresAt:null},{userId:'other'}])assert.deepEqual(await activeAdminDevices(db,[{...valid,...change}]),[]);
  row.authVersion++;assert.deepEqual(await activeAdminDevices(db,[valid]),[]);row.is_active=false;assert.deepEqual(await activeAdminDevices(db,[valid]),[]);
});
test('push tickets preserve successful devices and remove invalid ones; temporary failures retry',async()=>{
  const accepted=[],removed=[];
  const fetchImpl=async(_,options)=>{assert.ok(options.signal);return{ok:true,status:200,json:async()=>({data:[{status:'ok',id:'receipt'},{status:'error',details:{error:'DeviceNotRegistered'}},{status:'error',details:{error:'MessageRateExceeded'}}]})};};
  await assert.rejects(sendChatPushBatch([{to:'ok'},{to:'invalid'},{to:'retry'}],{fetchImpl,onAccepted:async token=>accepted.push(token),removeDevice:async token=>removed.push(token)}));
  assert.deepEqual(accepted,['ok']);assert.deepEqual(removed,['invalid']);
});
