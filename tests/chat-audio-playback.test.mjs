import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTripCallService} from '../apps/api/src/services/tripCallService.js';
const source=readFileSync(new URL('../apps/api/src/routes/tripChat.js',import.meta.url),'utf8');
const body=source.split("router.get('/:tripId/audio/:id', wrap(async (req, res) => {")[1].split('\n}));')[0];
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
for(const role of ['RIDER','DRIVER','ADMIN'])test(`${role} can play an authorized voice message`,async()=>{
 const audits=[];let result;
 const prisma={tripChatMessage:{findFirst:async({where})=>{assert.equal(where.tripId,'trip');assert.equal(where.deletedAt,null);return {audioKey:'private-audio',audioMime:'audio/mp4'};}},tripChatAccess:{create:async row=>audits.push(row)}};
 const handler=new AsyncFunction('req','res','prisma','chatAccess','messageWhere','audioUrl',body);
 await handler({chatActor:{id:'actor',role},params:{tripId:'trip',id:'message'}},{set:()=>({json:v=>{result=v;}})},prisma,async()=>({id:'trip'}),trip=>({tripId:trip.id}),async key=>{assert.equal(key,'private-audio');return 'signed-url';});
 assert.equal(result.url,'signed-url');assert.equal(result.mimeType,'audio/mp4');assert.equal(audits.length,role==='ADMIN'?1:0);
});
test('admin can recover a finished call recording before the sweep indexes it',async()=>{
 const row={id:'call',tripId:'trip',status:'ENDED',concatId:'concat',recordingKey:null};const audits=[];
 const db={tripCall:{findUnique:async()=>({...row}),update:async({data})=>Object.assign(row,data)},tripChatAccess:{create:async v=>audits.push(v)}};
 const aws={recording:async()=> 'call-recordings/call/final/audio/concat.mp4',recordingUrl:async key=>{assert.equal(key,row.recordingKey);return 'signed-call';}};
 const service=createTripCallService(db,aws);
 assert.deepEqual(await service.recording('call',{id:'admin',role:'ADMIN',recordingAdmin:true}),{url:'signed-call'});assert.equal(audits.length,1);
 await assert.rejects(()=>service.recording('call',{role:'RIDER'}),/Chỉ Admin/);
});
