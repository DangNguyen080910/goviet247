import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatMediaDeletionQueue} from '../apps/api/src/services/chatMediaDeletionQueue.js';
test('twenty failing objects cannot starve the next record and successful image cleanup is retained',async()=>{
 const rows=Array.from({length:21},(_,i)=>({id:String(i).padStart(3,'0'),audioDeleteKey:`audio_${i}`,imageDeleteKey:i===0?'image_ok':null}));
 const removed=[];const db={tripChatMessage:{findMany:async({where,take})=>rows.filter(r=>(r.audioDeleteKey||r.imageDeleteKey)&&(!where.id||r.id>where.id.gt)).slice(0,take),update:async({where,data})=>Object.assign(rows.find(r=>r.id===where.id),data)}};
 const drain=createChatMediaDeletionQueue();const remove=async key=>{if(key.startsWith('audio_')&&key!=='audio_20')throw Error('storage unavailable');removed.push(key);};
 await drain(db,remove,{error(){}});assert.equal(rows[0].imageDeleteKey,null);
 await drain(db,remove,{error(){}});assert(removed.includes('audio_20'));assert.equal(rows[20].audioDeleteKey,null);
 await drain(db,remove,{error(){}});assert.equal(removed.filter(k=>k==='image_ok').length,1);
});
