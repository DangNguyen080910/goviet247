import {driverTripVehicleWhere} from '../apps/api/src/services/tripVehiclePolicy.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { createServerClock, acceptCountdownSeconds } from '../apps/mobile-chat/serverClock.js';
import { readTripPages } from '../apps/api/src/shared/tripPages.js';
const require = createRequire(import.meta.url), ts = require('typescript');
const base = Date.parse('2026-12-01T01:00:00Z');
const iso = offset => new Date(base + offset).toISOString();
function phone(wallOffset = 0, origin = 0) {
  let elapsed = 0, wall = base + wallOffset;
  const clock = createServerClock({ monotonicNow: () => origin + elapsed, wallNow: () => wall + elapsed });
  return { clock, advance(ms) { elapsed += ms; }, changeWall(ms) { wall += ms; } };
}
function syncFirst(p) {
  const start = p.clock.monotonicNow();
  p.advance(1000);
  // 100 ms each way and 800 ms of API work: processing must not be counted as network delay.
  assert.equal(p.clock.sync({serverReceivedAt:iso(100),serverTime:iso(900)},start),true);
}

test('phones five minutes fast/slow show the same countdown after server synchronization', () => {
  const phones = [phone(-300000,200),phone(300000,90000)];
  for (const p of phones) syncFirst(p);
  assert.deepEqual(phones.map(p => p.clock.now()),[base+1000,base+1000]);
  assert.deepEqual(phones.map(p => acceptCountdownSeconds(iso(11000),p.clock.now())),[10,10]);
  for (const p of phones) p.advance(10000);
  assert.deepEqual(phones.map(p => acceptCountdownSeconds(iso(11000),p.clock.now())),[0,0]);
});

test('wall-clock changes and delayed timer callbacks cannot drift a synchronized countdown', () => {
  const p=phone();syncFirst(p);p.changeWall(24*3600000);
  p.advance(8999);assert.equal(acceptCountdownSeconds(iso(10000),p.clock.now()),1);
  p.advance(1);assert.equal(acceptCountdownSeconds(iso(10000),p.clock.now()),0);
  p.advance(60000);p.changeWall(-48*3600000);
  assert.equal(p.clock.now(),base+70000);
  assert.equal(acceptCountdownSeconds(iso(10000),p.clock.now()),0);
});

test('slow or out-of-order responses do not replace a fresher low-latency clock; samples refresh after a minute', () => {
  const p=phone();syncFirst(p);
  p.advance(1000);
  assert.equal(p.clock.sync({serverReceivedAt:iso(1200),serverTime:iso(1300)},1000),false);
  assert.equal(p.clock.now(),base+2000);
  assert.equal(p.clock.sync({serverReceivedAt:iso(100),serverTime:iso(200)},0),false);
  p.advance(60000);
  assert.equal(p.clock.sync({serverReceivedAt:iso(61100),serverTime:iso(61900)},61000),true);
  assert.equal(p.clock.now(),base+62000);
});

test('missing/invalid timestamps and timeout samples preserve the last valid estimate; old APIs still load', () => {
  const p=phone(300000);
  assert.equal(p.clock.sync({success:true},0),false);
  assert.equal(p.clock.now(),base+300000);
  syncFirst(p);
  for(const payload of [null,{}, {serverTime:'bad',serverReceivedAt:iso(0)},
    {serverTime:iso(0),serverReceivedAt:iso(10)}, {serverTime:iso(999999),serverReceivedAt:iso(0)}]) {
    assert.equal(p.clock.sync(payload,1000),false);
    assert.equal(p.clock.now(),base+1000);
  }
  p.advance(11000);
  assert.equal(p.clock.sync({serverTime:iso(11900),serverReceivedAt:iso(1100)},1000),false);
  assert.equal(p.clock.now(),base+12000);
  assert.equal(acceptCountdownSeconds(null,p.clock.now()),0);
  assert.equal(acceptCountdownSeconds('invalid',p.clock.now()),0);
});

const apiSource=readFileSync(new URL('../apps/driver-mobile/services/tripApi.ts',import.meta.url),'utf8');
function mobileApi(clock,fetchWithTimeout) {
  const exports={};
  const modules={ './serverClock':{driverServerClock:clock}, '../../mobile-chat/fetchWithTimeout.js':{fetchWithTimeout},
    '../../api/src/shared/tripPages.js':{readTripPages}, '../constants/api':{API_BASE_URL:'https://offline.invalid'}, './storage':{getDriverToken:async()=>'offline'} };
  vm.runInNewContext(ts.transpileModule(apiSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {exports,require:id=>{assert.ok(modules[id],id);return modules[id];},AbortController,URLSearchParams,setTimeout,clearTimeout});
  return exports;
}
test('actual Driver list API client synchronizes each page without extra requests and preserves legacy list payloads', async () => {
  const p=phone(300000);let requests=0;
  const api=mobileApi(p.clock,async url=>{
    requests++;p.advance(1000);
    if(requests===1) return {ok:true,json:async()=>({success:true,serverReceivedAt:iso(100),serverTime:iso(900),items:[{id:'a'}],nextCursor:'next'})};
    assert.ok(url.includes('cursor=next'));
    return {ok:true,json:async()=>({success:true,items:[{id:'b'}]})};
  });
  assert.deepEqual(await api.getAvailableTrips(),[{id:'a'},{id:'b'}]);
  assert.equal(requests,2);assert.equal(p.clock.now(),base+2000);
});
test('an unsuccessful API response cannot reset the Driver clock', async () => {
  const p=phone();syncFirst(p);
  const api=mobileApi(p.clock,async()=>({ok:false,json:async()=>({success:true,serverReceivedAt:iso(999999),serverTime:iso(999999),message:'offline rejection'})}));
  await assert.rejects(api.getAvailableTrips(),/offline rejection/);
  assert.equal(p.clock.now(),base+1000);
});

test('actual available-trips controller supplies millisecond timestamps bracketing API work, even for an empty list', async () => {
  const source=readFileSync(new URL('../apps/api/src/controllers/tripController.js',import.meta.url),'utf8');
  const a=source.indexOf('export async function listAvailableTrips('),b=source.indexOf('\n}',a)+2;
  let now=base;
  class FakeDate extends Date { constructor(...args) { super(...(args.length?args:[now])); } }
  const deps={driverTripVehicleWhere,Date:FakeDate,tripPagination:()=>null,tripPage:rows=>({items:rows}),audienceWhere:()=>({}),
    prisma:{driverProfile:{findUnique:async()=>({vehicleType:'CAR_5'})},trip:{findMany:async()=>{now+=900;return[];}}},getDriverConfigSnapshot:async()=>{now+=100;return{};},console};
  const list=new Function(...Object.keys(deps),source.slice(a,b).replace('export ','')+';return listAvailableTrips;')(...Object.values(deps));
  let payload;
  await list({user:{id:'offline'}},{set(){},json:body=>{payload=body;},status:()=>assert.fail('controller error')});
  assert.equal(payload.serverReceivedAt,iso(0));assert.equal(payload.serverTime,iso(1000));
  assert.deepEqual(payload.items,[]);assert.equal(payload.success,true);
});

const dashboard=readFileSync(new URL('../apps/driver-mobile/app/dashboard.tsx',import.meta.url),'utf8');
test('actual Dashboard uses live synchronized time on tap even if its last rendered countdown is stale', () => {
  const a=dashboard.indexOf('  const getAcceptLockRemainingSeconds ='),b=dashboard.indexOf('  const loadDriverMenuProfile =',a);
  const code=ts.transpileModule(dashboard.slice(a,b),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const p=phone();syncFirst(p);
  const remaining=new Function('useCallback','acceptCountdownSeconds','driverServerClock','currentTimeMs',code+';return getAcceptLockRemainingSeconds;')(
    fn=>fn,acceptCountdownSeconds,p.clock,base+1000);
  const trip={driverAcceptOpenAt:iso(2000)};
  p.advance(1000);
  assert.equal(remaining(trip),1,'rendered state can be one tick old');
  assert.equal(remaining(trip,true),0,'tap rechecks the current server estimate');
});
test('actual Dashboard pauses clock rendering in background and refreshes immediately on foreground', () => {
  const a=dashboard.lastIndexOf('  useEffect(() => {',dashboard.indexOf('    const refreshClock ='));
  const b=dashboard.indexOf('  }, [availableTrips]);',a)+'  }, [availableTrips]);'.length;
  const code=ts.transpileModule(dashboard.slice(a,b),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const p=phone();syncFirst(p);let tick,onState,cleanup,removed=false,currentTime=base+1000;const updates=[];
  const app={currentState:'active',addEventListener:(_,fn)=>{onState=fn;return{remove(){removed=true;}};}};
  new Function('useEffect','AppState','driverServerClock','setCurrentTimeMs','setInterval','clearInterval','availableTrips','acceptCountdownSeconds',code)(
    fn=>{cleanup=fn();},app,p.clock,update=>{const next=update(currentTime);if(next!==currentTime)updates.push(next);currentTime=next;},
    (fn,ms)=>{assert.equal(ms,250);tick=fn;return 1;},()=>{},[{driverAcceptOpenAt:iso(11000)}],acceptCountdownSeconds);
  tick();p.advance(250);tick();p.advance(250);tick();assert.deepEqual(updates,[],'unchanged displayed seconds must not render the whole list');
  app.currentState='background';p.advance(60000);tick();assert.equal(updates.length,0);
  app.currentState='active';onState('active');assert.deepEqual(updates,[base+61500]);
  cleanup();assert.equal(removed,true);
});
