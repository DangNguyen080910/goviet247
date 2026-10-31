import test from 'node:test';
import assert from 'node:assert/strict';
import { recordBlockedChatContact, CHAT_CONTACT_ALERT } from '../src/services/chatContactAlert.js';
import { validateChatPayload } from '../src/shared/tripChat.js';

function fixture({status='ACCEPTED',recent=false}={}) {
 const alerts=[],events=[],pushes=[];
 const trip={id:'trip-12345',status,driverId:'driver',riderId:'booker',riderPhone:'0901234567'};
 const tx={
  $queryRaw:async()=>[],trip:{findUnique:async()=>trip},
  driverProfile:{findUnique:async()=>({status:'VERIFIED'})},phone:{findMany:async()=>[]},
  adminAlertLog:{findFirst:async()=>recent?{id:'previous'}:null,create:async({data})=>{const a={id:'alert-1',...data};alerts.push(a);return a;}}
 };
 const db={$transaction:fn=>fn(tx)};
 const options={io:{to:room=>({emit:(event,payload)=>events.push({room,event,payload})})},notify:async p=>pushes.push(p)};
 return {db,options,alerts,events,pushes};
}
const body={clientId:'phone_attempt',text:'Gọi tôi 0901234567'};
test('phone validation returns a distinct code without accepting a message',()=>{
 assert.throws(()=>validateChatPayload(body),e=>e.code===CHAT_CONTACT_ALERT);
 assert.throws(()=>validateChatPayload({clientId:'x',text:'hello'}),e=>!e.code);
});
test('authorized blocked sender creates unread admin history and notifies only admins',async()=>{
 const f=fixture();await recordBlockedChatContact(f.db,'trip-12345',{id:'driver',role:'RIDER'},body,f.options);
 assert.equal(f.alerts.length,1);assert.equal(f.alerts[0].alertType,CHAT_CONTACT_ALERT);
 assert.match(f.alerts[0].message,/\[DRIVER:driver\]/);assert.match(f.alerts[0].message,/0901234567/);
 assert.equal(f.alerts[0].readAt,undefined);assert.equal(f.events[0].room,'admins');
 assert.equal(f.events[0].payload.source,'chat_contact_alert');assert.equal(f.pushes[0].data.type,CHAT_CONTACT_ALERT);
 assert.equal(JSON.stringify(f.events).includes('0901234567'),false);assert.equal(JSON.stringify(f.pushes).includes('0901234567'),false);
});
test('booker and verified passenger attempts both generate alerts with correct roles',async()=>{
 const f=fixture();await recordBlockedChatContact(f.db,'trip-12345',{id:'booker',role:'RIDER'},body,f.options);
 assert.match(f.alerts[0].message,/Người đặt chuyến/);
 const g=fixture();const base=g.db.$transaction;g.db.$transaction=fn=>base(tx=>{tx.phone.findMany=async()=>[{e164:'+84901234567'}];return fn(tx);});
 await recordBlockedChatContact(g.db,'trip-12345',{id:'passenger',role:'RIDER'},body,g.options);assert.match(g.alerts[0].message,/Hành khách/);
});
test('strangers and closed-trip senders cannot manufacture admin alerts',async()=>{
 for(const [id,status] of [['outsider','ACCEPTED'],['driver','COMPLETED']]) {
  const f=fixture({status});await assert.rejects(()=>recordBlockedChatContact(f.db,'trip-12345',{id,role:'RIDER'},body,f.options));
  assert.equal(f.alerts.length,0);assert.equal(f.pushes.length,0);
 }
});
test('rapid repeats do not duplicate alerts or push and push failure keeps history',async()=>{
 const f=fixture({recent:true});assert.equal(await recordBlockedChatContact(f.db,'trip-12345',{id:'booker',role:'RIDER'},body,f.options),null);assert.equal(f.pushes.length,0);assert.equal(f.alerts.length,0);
 const g=fixture();const result=await recordBlockedChatContact(g.db,'trip-12345',{id:'booker',role:'RIDER'},body,{notify:async()=>{throw new Error('simulated push failure');}});
 assert.equal(result.id,'alert-1');assert.equal(g.alerts.length,1);
});
