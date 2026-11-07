import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../apps/api/src/services/tripChatService.js',import.meta.url),'utf8');
const fail=(m,status=403)=>Object.assign(new Error(m),{status});
function fixture({visible=true,deleted=false,canSend=true,denied=false}={}) {
 const hearts=new Set(); let locked=false;
 const tx={
  $queryRaw:async()=>{locked=true;},
  tripChatMessage:{findFirst:async()=>visible ? {id:'m',deletedAt:deleted?new Date():null}:null},
  tripChatReaction:{upsert:async({create})=>hearts.add(create.actorId),deleteMany:async({where})=>hearts.delete(where.actorId),count:async()=>hearts.size}
 };
 const fn=new Function('chatAccess','chatCanSend','messageWhere','fail',source.slice(source.indexOf('export async function setChatHeart')).replaceAll('export ', '')+';return {setChatHeart,chatHeartsForClient};')(
  async()=>{assert.equal(locked,true);if(denied)throw fail('Forbidden');return {};},()=>canSend,()=>({tripId:'t'}),fail);
 return {...fn,db:{$transaction:fn=>fn(tx)},hearts};
}
test('heart retries do not inflate counts; a second account adds one; removing twice is safe',async()=>{
 const f=fixture();const a={id:'a'};
 assert.deepEqual(await f.setChatHeart(f.db,'t','m',a,true),{heartCount:1,hearted:true});
 assert.equal((await f.setChatHeart(f.db,'t','m',a,true)).heartCount,1);
 assert.equal((await f.setChatHeart(f.db,'t','m',{id:'b'},true)).heartCount,2);
 await f.setChatHeart(f.db,'t','m',a,false);
 assert.equal((await f.setChatHeart(f.db,'t','m',a,false)).heartCount,1);
});
for(const options of [{visible:false},{deleted:true},{canSend:false},{denied:true}]) test('denies inaccessible, deleted or read-only messages '+JSON.stringify(options),async()=>{
 const f=fixture(options);await assert.rejects(f.setChatHeart(f.db,'t','m',{id:'a'},true));assert.equal(f.hearts.size,0);
});
test('rejects untyped state before a transaction',async()=>{
 const f=fixture();await assert.rejects(f.setChatHeart(f.db,'t','m',{id:'a'},'true'),e=>e.status===400);
});
test('serializes count and own selection without exposing other actor IDs',()=>{
 const f=fixture();assert.deepEqual(f.chatHeartsForClient({id:'m',reactions:[{actorId:'a'},{actorId:'b'}]},{id:'a'}),{id:'m',heartCount:2,hearted:true});
 assert.deepEqual(f.chatHeartsForClient({id:'m',deletedAt:'now',reactions:[{actorId:'a'}]},{id:'a'}),{id:'m',deletedAt:'now',heartCount:0,hearted:false});
});
