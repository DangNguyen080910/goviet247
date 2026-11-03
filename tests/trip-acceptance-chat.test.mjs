import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAcceptanceChatNotices,chatPushRecipientIds,ACCEPTANCE_CHAT_TEXT} from '../apps/api/src/services/tripAcceptanceChat.js';
import {chatAudienceVisible,chatAudienceWhere,chatAudienceLabel} from '../apps/api/src/shared/tripChatVisibility.js';
import {validateChatPayload} from '../apps/api/src/shared/tripChat.js';
const acceptedAt=new Date('2026-11-02T09:00:00Z');
const trip={id:'trip1',version:1,status:'ACCEPTED',acceptedAt,driverId:'driver1',riderId:'rider1'};
function storage(){
 const rows=new Map();
 return {rows,tx:{tripChatMessage:{createMany:async({data,skipDuplicates})=>{
  assert.equal(skipDuplicates,true);let count=0;
  for(const m of data){const key=[m.tripId,m.senderId,m.clientId].join('/');if(!rows.has(key)){rows.set(key,m);count++;}}return {count};
 }}}};
}
test('acceptance creates one private rider notice and one notice bound to the accepting driver',async()=>{
 const {rows,tx}=storage();await createAcceptanceChatNotices(tx,trip);
 const messages=[...rows.values()];assert.equal(messages.length,2);
 const rider=messages.find(m=>m.audience==='RIDER'),driver=messages.find(m=>m.audience==='DRIVER');
 assert.equal(rider.text,ACCEPTANCE_CHAT_TEXT.RIDER);assert.equal(driver.text,ACCEPTANCE_CHAT_TEXT.DRIVER_RIDER);
 assert.equal(driver.recipientId,'driver1');assert.equal(rider.kind,'TEXT');assert.equal(rider.senderRole,'SYSTEM');
 assert.equal(rider.senderLabel,'Hệ thống GoViet247');assert.equal(driver.createdAt.getTime(),acceptedAt.getTime());
});
test('partner acceptance addresses dispatchers and tells the driver to contact dispatch, not passengers',async()=>{
 const {rows,tx}=storage();await createAcceptanceChatNotices(tx,{...trip,partnerCompanyId:'company1'});
 const messages=[...rows.values()];assert.equal(messages.find(m=>m.audience==='PARTNER').text,ACCEPTANCE_CHAT_TEXT.PARTNER);
 assert.equal(messages.find(m=>m.audience==='DRIVER').text,ACCEPTANCE_CHAT_TEXT.DRIVER_PARTNER);
 assert.equal(messages.some(m=>m.audience==='RIDER'),false);
});
test('acceptance retry is idempotent; a later acceptance creates a fresh pair',async()=>{
 const {rows,tx}=storage();await createAcceptanceChatNotices(tx,trip);await createAcceptanceChatNotices(tx,trip);assert.equal(rows.size,2);
 await createAcceptanceChatNotices(tx,{...trip,version:4,acceptedAt:new Date(acceptedAt.getTime()+1000),driverId:'driver2'});
 assert.equal(rows.size,4);assert.equal([...rows.values()].filter(m=>m.recipientId==='driver2').length,1);
});
test('failed or unassigned acceptance cannot generate notices',async()=>{
 const {rows,tx}=storage();
 for(const bad of [{...trip,status:'PENDING'},{...trip,driverId:null},{...trip,acceptedAt:null}])await assert.rejects(createAcceptanceChatNotices(tx,bad));
 assert.equal(rows.size,0);
});
test('audience visibility excludes the opposite side, other drivers and unknown audiences',()=>{
 const rider={role:'RIDER',id:'rider1'},driver={role:'DRIVER',id:'driver1'},other={role:'DRIVER',id:'driver2'},partner={role:'PARTNER',id:'partner-m1'},admin={role:'ADMIN',id:'admin-1'};
 for(const [message,allowed] of [[{audience:'ALL'},[rider,driver,other,partner,admin]],
  [{audience:'RIDER'},[rider,admin]],[{audience:'PARTNER'},[partner,admin]],
  [{audience:'DRIVER',recipientId:'driver1'},[driver,admin]],[{audience:'UNKNOWN'},[admin]]]){
  for(const actor of [rider,driver,other,partner,admin])assert.equal(chatAudienceVisible(message,actor),allowed.includes(actor));
 }
 assert.deepEqual(chatAudienceWhere(admin),{});
 assert.deepEqual(chatAudienceWhere(driver),{OR:[{audience:'ALL'},{audience:'DRIVER',recipientId:'driver1'}]});
 assert.match(chatAudienceLabel('PARTNER'),/đối tác/);
});
function recipientDb(){return {partnerCompany:{findUnique:async()=>({id:'company1',isActive:true,managementPhone:null})},phone:{findMany:async()=>[]},admin_users:{findMany:async()=>[{id:1}]},partnerMember:{findUnique:async()=>null,findMany:async()=>[{id:'m1'},{id:'m2'}]}};}
const notice=audience=>({senderId:'goviet247-system',senderRole:'SYSTEM',clientId:'accept_1_123_DRIVER',audience,recipientId:'driver1',createdAt:acceptedAt});
test('push for rider notice only targets rider and GoViet247, not driver',async()=>{
 assert.deepEqual((await chatPushRecipientIds(recipientDb(),trip,notice('RIDER'))).sort(),['admin-1','rider1']);
});
test('push for driver notice only targets the accepting driver and GoViet247',async()=>{
 assert.deepEqual((await chatPushRecipientIds(recipientDb(),trip,notice('DRIVER'))).sort(),['admin-1','driver1']);
});
test('partner notices only target eligible partner members and GoViet247',async()=>{
 const ids=await chatPushRecipientIds(recipientDb(),{...trip,partnerCompanyId:'company1',partnerAssignedToId:'m1'},notice('PARTNER'));
 assert.deepEqual(ids.sort(),['admin-1','partner-m1','partner-m2']);
});
test('late acceptance pushes are discarded after reassignment, return to pool or completion',async()=>{
 for(const changed of [{...trip,acceptedAt:new Date(acceptedAt.getTime()+1),driverId:'driver2'},
  {...trip,status:'PENDING',driverId:null,acceptedAt:null},{...trip,status:'COMPLETED'},{...trip,status:'CANCELLED'}]){
  assert.deepEqual(await chatPushRecipientIds(recipientDb(),changed,notice('RIDER')),[]);
 }
});
test('ordinary shared messages still notify both sides, excluding the sender',async()=>{
 const ids=await chatPushRecipientIds(recipientDb(),trip,{senderId:'rider1',senderRole:'RIDER',audience:'ALL',createdAt:acceptedAt});
 assert.deepEqual(ids.sort(),['admin-1','driver1']);
});
test('clients cannot forge system notices or private audience through message payloads',()=>{
 const payload=validateChatPayload({clientId:'test-message-001',kind:'TEXT',text:'Xin chào',audience:'DRIVER',recipientId:'driver1',senderRole:'SYSTEM'});
 assert.equal(payload.audience,undefined);assert.equal(payload.recipientId,undefined);assert.equal(payload.senderRole,undefined);
 assert.throws(()=>validateChatPayload({clientId:'test-message-001',kind:'SYSTEM',text:'fake'}));
});
