import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sendChatPushBatch} from '../apps/api/src/services/chatPushTransport.js';
const message=to=>({to,title:'Chat',data:{type:'TRIP_CHAT'}});
const response=(data,status=200)=>({ok:status===200,status,json:async()=>data});
test('mixed Rider/Admin/Driver projects are retried separately after whole batch rejection',async()=>{
 const calls=[];
 const fetchImpl=async(url,options)=>{const batch=JSON.parse(options.body);calls.push(batch.map(m=>m.to));return batch.length>1?response({errors:[{code:'PUSH_TOO_MANY_EXPERIENCE_IDS'}]},400):response({data:[{status:'ok',id:'ticket'}]});};
 await sendChatPushBatch(['rider','admin','driver'].map(message),{fetchImpl,removeDevice:async()=>assert.fail()});
 assert.deepEqual(calls,[['rider','admin','driver'],['rider'],['admin'],['driver']]);
});
test('same project success is sent once without splitting',async()=>{
 let calls=0;await sendChatPushBatch([message('r1'),message('r2')],{fetchImpl:async()=>{calls++;return response({data:[{status:'ok'},{status:'ok'}]});},removeDevice:async()=>assert.fail()});assert.equal(calls,1);
});
test('one failing project does not prevent delivery to other projects; error contains no tokens',async()=>{
 const calls=[];
 await assert.rejects(sendChatPushBatch(['secret-rider','secret-driver'].map(message),{fetchImpl:async(url,o)=>{const batch=JSON.parse(o.body);calls.push(batch[0].to);return batch.length>1?response({errors:[{code:'PUSH_TOO_MANY_EXPERIENCE_IDS'}]},400):batch[0].to==='secret-rider'?response({data:[{status:'error',details:{error:'InvalidCredentials'},message:'secret-rider'}]}):response({data:[{status:'ok'}]});},removeDevice:async()=>assert.fail()}),e=>/InvalidCredentials/.test(e.message)&&!e.message.includes('secret-'));
 assert.deepEqual(calls,['secret-rider','secret-rider','secret-driver']);
});
test('unregistered tokens are removed; malformed tickets and HTTP failures cannot mark push successful',async()=>{
 const removed=[];
 await sendChatPushBatch([message('stale')],{fetchImpl:async()=>response({data:[{status:'error',details:{error:'DeviceNotRegistered'}}]}),removeDevice:async token=>removed.push(token)});
 assert.deepEqual(removed,['stale']);
 for(const result of [response({data:[]}),response({errors:[{code:'UNAUTHORIZED'}]},401)]) await assert.rejects(sendChatPushBatch([message('r')],{fetchImpl:async()=>result,removeDevice:async()=>{}}));
});

test('partial success persists accepted devices before throwing for a failed device', async()=>{
 const accepted=[];
 await assert.rejects(sendChatPushBatch([message('ok-device'),message('bad-device')],{
  fetchImpl:async()=>response({data:[{status:'ok'},{status:'error',details:{error:'InvalidCredentials'}}]}),
  removeDevice:async()=>assert.fail(),onAccepted:async token=>accepted.push(token)
 }),/InvalidCredentials/);
 assert.deepEqual(accepted,['ok-device']);
});
test('mixed-project split preserves per-device acknowledgements',async()=>{
 const accepted=[];
 await sendChatPushBatch([message('rider'),message('admin')],{
  fetchImpl:async(_url,o)=>JSON.parse(o.body).length>1?response({errors:[{code:'PUSH_TOO_MANY_EXPERIENCE_IDS'}]},400):response({data:[{status:'ok'}]}),
  removeDevice:async()=>assert.fail(),onAccepted:async token=>accepted.push(token)
 });assert.deepEqual(accepted,['rider','admin']);
});
