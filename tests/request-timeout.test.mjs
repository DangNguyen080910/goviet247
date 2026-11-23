import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchWithTimeout} from '../apps/mobile-chat/fetchWithTimeout.js';
import {reconcileBooking} from '../apps/mobile-chat/reconcileBooking.js';
const original=globalThis.fetch;
test('mutation deadline releases even when the transport ignores abort, and never resends',async()=>{
  let calls=0;globalThis.fetch=async()=>{calls++;return new Promise(()=>{});};
  try{await assert.rejects(fetchWithTimeout('offline',{method:'POST'},15),{code:'REQUEST_UNCONFIRMED'});assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
test('deadline includes a stalled JSON body after successful response headers',async()=>{
  let stream;globalThis.fetch=async()=>new Response(new ReadableStream({start(controller){stream=controller;controller.enqueue(new TextEncoder().encode('{'));}}));
  try{await assert.rejects(fetchWithTimeout('offline',{},20),{code:'REQUEST_TIMEOUT'});}finally{stream.close();globalThis.fetch=original;}
});
test('successful and non-JSON HTTP errors retain their real HTTP status',async()=>{
  try{
    globalThis.fetch=async()=>new Response('{"success":true}',{status:200});
    assert.equal((await (await fetchWithTimeout('offline')).json()).success,true);
    globalThis.fetch=async()=>new Response('not json',{status:401});
    assert.equal((await fetchWithTimeout('offline')).status,401);
  }finally{globalThis.fetch=original;}
});
test('caller cancellation is distinct from timeout and does not imply an expired session',async()=>{
  globalThis.fetch=async()=>new Promise(()=>{});const controller=new AbortController();
  try{const pending=fetchWithTimeout('offline',{signal:controller.signal},1000);controller.abort();await assert.rejects(pending,{name:'AbortError'});}finally{globalThis.fetch=original;}
});
test('booking reconciliation makes only a read request and returns an existing trip',async()=>{
  const calls=[];globalThis.fetch=async(url,options)=>{calls.push([url,options]);return new Response(JSON.stringify({success:true,trip:{id:'existing',status:'PENDING'}}));};
  try{
    const result=await reconcileBooking('https://offline.invalid',{Authorization:'Bearer offline'},'request/key');
    assert.equal(result.trip.id,'existing');assert.equal(calls.length,1);assert.ok(calls[0][0].includes('requestId=request%2Fkey'));assert.equal(calls[0][1].method,undefined);
  }finally{globalThis.fetch=original;}
});
