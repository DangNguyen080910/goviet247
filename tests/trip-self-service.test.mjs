import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canSelfCancelTrip} from '../apps/api/src/shared/tripSelfService.js';
import {chatCanSend} from '../apps/api/src/shared/tripChat.js';
import {createBookingChatNotice} from '../apps/api/src/services/tripBookingChat.js';
import {createChatAlertGate,newUnreadConversations} from '../apps/api/src/shared/chatAlerts.js';
const pending={id:'t',status:'PENDING',isVerified:false,verifiedAt:null,driverId:null,cancelledAt:null};
test('self cancellation only permits unapproved, unassigned pending trips',()=>{
 assert.equal(canSelfCancelTrip(pending),true);
 for(const patch of [{isVerified:true},{verifiedAt:new Date()},{driverId:'d'},{cancelledAt:new Date()},...['ACCEPTED','CONTACTED','IN_PROGRESS','COMPLETED','CANCELLED'].map(status=>({status}))]) assert.equal(canSelfCancelTrip({...pending,...patch}),false);
 assert.equal(canSelfCancelTrip(null),false);
});
test('riders and partners can chat immediately; drivers still require an accepted assignment',()=>{
 for(const role of ['RIDER','PARTNER']){
  for(const status of ['PENDING','ACCEPTED','CONTACTED','IN_PROGRESS']) assert.equal(chatCanSend({...pending,status},{role}),true);
  for(const status of ['COMPLETED','CANCELLED','UNKNOWN'])assert.equal(chatCanSend({...pending,status},{role}),false);
 }
 assert.equal(chatCanSend(pending,{role:'DRIVER'}),false);
 assert.equal(chatCanSend({...pending,status:'ACCEPTED',driverId:'d'},{role:'DRIVER'}),true);
 assert.equal(chatCanSend({...pending,status:'CANCELLED'},{role:'ADMIN'}),false);
});
test('new booking gets one private system notice, with retry-safe key, for rider or partner',async()=>{
 for(const partnerCompanyId of [null,'company1']){
  const rows=new Map(),tx={tripChatMessage:{createMany:async({data,skipDuplicates})=>{assert.equal(skipDuplicates,true);for(const m of data)rows.set(m.clientId,m);}}};
  await createBookingChatNotice(tx,{...pending,partnerCompanyId});await createBookingChatNotice(tx,{...pending,partnerCompanyId});
  assert.equal(rows.size,1);const note=[...rows.values()][0];assert.equal(note.senderRole,'SYSTEM');assert.equal(note.audience,partnerCompanyId?'PARTNER':'RIDER');assert.match(note.text,/chờ.*duyệt/);assert.match(note.text,/Liên hệ chuyến/);
 }
});
test('alerts detect a new message even if total unread is unchanged, and exclude own or deleted previews',()=>{
 const old=new Map([['t','m1']]);
 const items=[{tripId:'t',unread:1,last:{id:'m2',senderId:'other'}},{tripId:'other',unread:1,last:{id:'m3',senderId:'me'}},{tripId:'deleted',unread:1,last:{id:'m4',deletedAt:'now'}}];
 assert.deepEqual(newUnreadConversations(old,items,'me').map(c=>c.tripId),['t']);
 assert.equal(newUnreadConversations(new Map([['t','m2']]),[items[0]],'me').length,0);
 assert.equal(newUnreadConversations(new Map(),[items[0]],'me').length,1);
});
test('push and foreground poll alert once per message, with a short burst cooldown',()=>{
 let now=0;const claim=createChatAlertGate(()=>now);assert.equal(claim('m1'),true);assert.equal(claim('m1'),false);
 now=2000;assert.equal(claim('m1'),false);assert.equal(claim('m2'),true);assert.equal(claim('m3'),false);
 now=4000;assert.equal(claim('m4'),true);
});
