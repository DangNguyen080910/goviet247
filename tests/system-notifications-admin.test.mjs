import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../apps/api/src/controllers/adminController.js',import.meta.url),'utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
function handler(name,next){
 const body=source.split(`    async ${name}(req, res) {`)[1].split(`    async ${next}`)[0].replace(/\n    },\s*$/,'');
 return new AsyncFunction('req','res','prisma','emitDriverNotificationChanged','emitRiderNotificationChanged','sendSystemNotificationToDrivers','sendSystemNotificationToRiders','mapSystemNotificationItem',body);
}
const create=handler('createSystemNotification','updateSystemNotification');
const update=handler('updateSystemNotification','deleteSystemNotification');
const remove=handler('deleteSystemNotification','listPendingTrips');
function response(){return {statusCode:200,status(n){this.statusCode=n;return this;},json(v){this.data=v;return this;}};}
for(const audience of ['DRIVER','RIDER'])for(const isActive of [true,false])test(`create ${audience} active=${isActive} controls storage, realtime and push`,async()=>{
 const events=[],push=[];const res=response();
 const db={systemNotification:{create:async({data})=>{assert.equal(data.isActive,isActive);return {...data,id:'notice'};}}};
 await create({body:{title:'Title',message:'Body',audience,isActive}},res,db,()=>events.push('DRIVER'),()=>events.push('RIDER'),async()=>push.push('DRIVER'),async()=>push.push('RIDER'));
 assert.equal(res.data.success,true);assert.deepEqual(events,isActive?[audience]:[]);assert.deepEqual(push,isActive?[audience]:[]);
});
for(const audience of ['DRIVER','RIDER'])test(`deactivation refreshes ${audience} without push`,async()=>{
 const events=[];const res=response();const db={systemNotification:{findUnique:async()=>({id:'notice'}),update:async({data})=>{assert.equal(data.isActive,false);return {id:'notice',audience};}}};
 await update({params:{id:'notice'},body:{isActive:false}},res,db,()=>events.push('DRIVER'),()=>events.push('RIDER'),()=>assert.fail('No push'),()=>assert.fail('No push'),v=>v);
 assert.deepEqual(events,[audience]);assert.equal(res.data.success,true);
});
test('reject string false instead of turning it on',async()=>{
 const res=response();await update({params:{id:'notice'},body:{isActive:'false'}},res,{},()=>{},()=>{});assert.equal(res.statusCode,400);
});
for(const audience of ['DRIVER','RIDER'])test(`delete ${audience} refreshes recipient list`,async()=>{
 const events=[];const res=response();await remove({params:{id:'notice'}},res,{systemNotification:{delete:async({where})=>{assert.equal(where.id,'notice');return {id:'notice',audience};}}},()=>events.push('DRIVER'),()=>events.push('RIDER'));
 assert.equal(res.data.success,true);assert.deepEqual(events,[audience]);
});
