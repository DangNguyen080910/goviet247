import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import express from 'express';
import * as policy from '../src/services/tripAudiencePolicy.js';
import {parseAudienceRegions,matchesAudienceFilters} from '../src/shared/audienceFilters.js';
import {audienceRegionsForApproval} from '../src/shared/tripAudienceLabel.js';

const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
async function fixture(run,{driverPush,riderPush,commitFailure=false,verified=false}={}){
  const calls=[],logs=[],ids=Array.from({length:620},(_,i)=>'offline-driver-'+i);
  const trip={id:'offline-approval',status:'PENDING',isVerified:verified,audienceDriverIds:verified?ids:[],riderId:'offline-rider',driverId:null};
  const tx={trip:{update:async({data})=>{if(commitFailure)throw Error('DB unavailable');calls.push('write');return{...trip,...data};}}};
  let committed=false;
  const db={trip:{findUnique:async()=>trip},driverProfile:{findMany:async()=>ids.map(userId=>({userId,vehicleType:'CAR_5',vehicleFuelType:'ELECTRIC',operatingProvinceCode:'79',operatingProvinceConfirmedAt:new Date()}))},
    $transaction:async fn=>{const result=await fn(tx);committed=true;calls.push('commit');return result;}};
  const deps={prisma:db,...policy,parseAudienceRegions,matchesAudienceFilters,audienceRegionsForApproval,
    buildDriverAcceptOpenAt:async()=>new Date(),recordTripEvent:async()=>{calls.push('history');},createRiderTripNotification:async()=>({id:'offline-notice'}),
    emitDriverTripEvent:()=>calls.push('socket:drivers'),emitAdminDashboardChanged:()=>calls.push('socket:admins'),emitTripChangedToRider:async()=>calls.push('socket:rider'),maskAddress:value=>value,
    sendNewTripToDrivers:updated=>{assert.equal(committed,true);assert.equal(updated.audienceDriverIds.length,620);calls.push('push:driver');return driverPush?.();},
    sendTripStatusChangedToRider:()=>{assert.equal(committed,true);calls.push('push:rider');return riderPush?.();},console:{log(){},error(...args){logs.push(args);}}};
  const source=readFileSync(new URL('../src/controllers/tripController.js',import.meta.url),'utf8');
  const fn=source.slice(source.indexOf('export async function adminVerifyTrip(')).replace('export ','');
  const approve=new Function(...Object.keys(deps),fn+';return adminVerifyTrip;')(...Object.values(deps));
  const app=express();app.use(express.json());app.set('io',{to:()=>({emit(){}})});
  app.post('/approve',(req,res)=>{req.params={id:trip.id};req.admin={id:1,role:'ADMIN'};return approve(req,res);});
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const submit=async()=>{const response=await fetch('http://127.0.0.1:'+server.address().port+'/approve',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({audienceMode:'AUDIENCE_FILTER',regions:['SOUTH'],driverIds:ids}),signal:AbortSignal.timeout(1000)});
    return{status:response.status,body:await response.json()};};
  try{await run({submit,calls,logs,get committed(){return committed;}});}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
test('HTTP approval finishes after commit/realtime even when both pushes remain pending for 620 drivers',async()=>{
  const driver=deferred(),rider=deferred();
  try{await fixture(async f=>{
    const result=await f.submit();assert.equal(result.status,200);assert.equal(result.body.success,true);assert.equal(f.committed,true);
    assert.equal(result.body.trip.isVerified,true);assert.equal(result.body.trip.audienceDriverIds.length,620);
    assert.deepEqual(f.calls.slice(0,6),['write','history','commit','socket:drivers','socket:admins','socket:rider']);
    assert.ok(f.calls.includes('push:driver'));assert.ok(f.calls.includes('push:rider'),'a slow driver push cannot hold rider push');
  },{driverPush:()=>driver.promise,riderPush:()=>rider.promise});}finally{driver.resolve();rider.resolve();}
});
test('sync and async push failures are logged independently without replacing the approved response',async()=>fixture(async f=>{
  const result=await f.submit();assert.equal(result.status,200);assert.equal(result.body.success,true);
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(f.logs.some(([message])=>message.includes('push driver error')));assert.ok(f.logs.some(([message])=>message.includes('push rider error')));
  assert.equal(f.calls.filter(value=>value==='commit').length,1);
},{driverPush:()=>{throw Error('driver offline');},riderPush:async()=>{throw Error('rider offline');}}));
test('failed approval transaction never returns success or sends pushes',async()=>fixture(async f=>{
  const result=await f.submit();assert.equal(result.status,500);assert.equal(result.body.success,false);assert.equal(f.committed,false);
  assert.equal(f.calls.some(value=>value.startsWith('push:')||value.startsWith('socket:')),false);
},{commitFailure:true}));
test('an identical already-approved request is successful without publishing duplicate pushes',async()=>fixture(async f=>{
  const result=await f.submit();assert.equal(result.status,200);assert.equal(result.body.success,true);assert.deepEqual(f.calls,[]);
},{verified:true}));
