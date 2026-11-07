import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chatVisibleFrom,chatMessageInCurrentHistory} from '../apps/api/src/shared/chatAssignmentHistory.js';
import {chatAudienceWhere} from '../apps/api/src/shared/tripChatVisibility.js';
import {chatPushRecipientIds} from '../apps/api/src/services/tripAcceptanceChat.js';
const service=readFileSync(new URL('../apps/api/src/services/tripChatService.js',import.meta.url),'utf8');
const body=service.slice(service.indexOf('export function messageWhere('),service.indexOf('export async function privateAudioBucket'));
const messageWhere=new Function('chatVisibleFrom','chatAudienceWhere',body.replace('export function','function')+'; return messageWhere;')(chatVisibleFrom,chatAudienceWhere);
const trip={id:'t',status:'ACCEPTED',driverId:'new',riderId:'rider',chatVisibleFrom:new Date('2026-11-07T02:00:00Z'),acceptedAt:new Date('2026-11-07T02:10:00Z')};
test('all non-Admin histories exclude previous assignment; Admin keeps the archive',()=>{
 for(const role of ['RIDER','PARTNER','DRIVER']){
  const actor={role,id:'new'},where=messageWhere(trip,actor);
  assert.equal(+where.AND[1].OR[0].historyAt.gte,+(role==='DRIVER'?trip.acceptedAt:trip.chatVisibleFrom));
  assert.equal(chatMessageInCurrentHistory(trip,actor,{createdAt:'2026-11-07T01:59:59Z'}),false);
 }
 assert.equal(messageWhere(trip,{role:'ADMIN',recordingAdmin:true}).createdAt,undefined);
 assert.equal(chatMessageInCurrentHistory(trip,{role:'ADMIN'},{createdAt:'2020-01-01'}),true);
 assert.equal(chatMessageInCurrentHistory(trip,{role:'RIDER'},{createdAt:trip.chatVisibleFrom}),true);
});
test('first assignment preserves existing customer history',()=>assert.equal(chatVisibleFrom({acceptedAt:trip.acceptedAt},{role:'RIDER'}),null));
test('late archived messages only notify Admin, including partner trips',async()=>{
 const db={admin_users:{findMany:async()=>[{id:1}]},user:{findMany:async()=>[]},partnerMember:{findMany:async()=>[{id:'dispatcher'}]}};
 for(const extra of [{},{partnerCompanyId:'company',partnerAssignedToId:'dispatcher'}]){
  const ids=await chatPushRecipientIds(db,{...trip,...extra},{senderId:'old',senderRole:'DRIVER',audience:'ALL',createdAt:new Date('2026-11-07T01:00:00Z')});
  assert.deepEqual(ids,['admin-1']);
 }
});
test('media, reactions, delete and cursor lookup share the same authorized history',()=>{
 const routes=readFileSync(new URL('../apps/api/src/routes/tripChat.js',import.meta.url),'utf8');
 assert.ok((routes.match(/messageWhere\(/g)||[]).length>=5);
 assert.match(service,/if \(!chatMessageInCurrentHistory\(trip, actor, existing\)\)/);
});
