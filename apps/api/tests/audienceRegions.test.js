import {recordTripEvent} from "../src/services/tripHistory.js";
import * as audienceLabel from '../src/shared/tripAudienceLabel.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AUDIENCE_REGIONS, driverAudienceRegion, parseAudienceRegions, matchesAudienceFilters, audienceFilterIds } from '../src/shared/audienceFilters.js';
import * as policy from '../src/services/tripAudiencePolicy.js';
const confirmed='2026-11-19T00:00:00Z';
const drivers=[
  {userId:'north',operatingProvinceCode:'01',operatingProvinceConfirmedAt:confirmed,carType:'CAR_5',vehicleFuelType:'ELECTRIC'},
  {userId:'central',operatingProvinceCode:'38',operatingProvinceConfirmedAt:confirmed,carType:'CAR_5',vehicleFuelType:'ELECTRIC'},
  {userId:'south',operatingProvinceCode:'79',operatingProvinceConfirmedAt:confirmed,carType:'CAR_7',vehicleFuelType:'GASOLINE'},
  {userId:'default',operatingProvinceCode:'79',operatingProvinceConfirmedAt:null,carType:'CAR_5',vehicleFuelType:'ELECTRIC'},
];
test('every province has exactly one operational region, including boundary provinces',()=>{
  const provinces=JSON.parse(readFileSync(new URL('../src/data/vietnam-provinces.json',import.meta.url)));
  const codes=AUDIENCE_REGIONS.flatMap(r=>r.provinceCodes);
  assert.equal(codes.length,34);assert.equal(new Set(codes).size,34);
  assert.deepEqual([...codes].sort(),provinces.map(p=>p.code).sort());
  for(const [code,region] of [['37','NORTH'],['38','CENTRAL'],['68','CENTRAL'],['75','SOUTH']]){
    assert.equal(driverAudienceRegion({operatingProvinceCode:code,operatingProvinceConfirmedAt:confirmed}),region);
  }
});
test('multiple regions union drivers, intersect seats/fuel, and never duplicate a driver',()=>{
  assert.deepEqual(audienceFilterIds(drivers,'CAR_5','ELECTRIC',['NORTH','CENTRAL']),['north','central']);
  assert.deepEqual(audienceFilterIds(drivers,'CAR_5','GASOLINE',['NORTH','CENTRAL']),[]);
  assert.deepEqual(audienceFilterIds(drivers,'','',['SOUTH','SOUTH']),['south']);
  assert.deepEqual(audienceFilterIds(drivers,'','',AUDIENCE_REGIONS.map(r=>r.value)),drivers.map(d=>d.userId));
  assert.equal(matchesAudienceFilters(drivers[0],'CAR_7','',['NORTH']),false);
});
test('unconfirmed/default or unknown provinces require the separate group, not the South',()=>{
  assert.equal(driverAudienceRegion(drivers[3]),'UNCONFIRMED');
  assert.equal(driverAudienceRegion({operatingProvinceCode:'99',operatingProvinceConfirmedAt:confirmed}),'UNCONFIRMED');
  assert.deepEqual(audienceFilterIds(drivers,'','',['UNCONFIRMED']),['default']);
  assert.deepEqual(audienceFilterIds(drivers,'','',['SOUTH']),['south']);
});
test('region validation rejects malformed requests rather than widening the audience',()=>{
  for(const value of [null,'SOUTH',['INVALID'],[null],['NORTH','CENTRAL','SOUTH','UNCONFIRMED','NORTH']])assert.throws(()=>parseAudienceRegions(value));
  assert.deepEqual(parseAudienceRegions(['NORTH','NORTH','CENTRAL']),['NORTH','CENTRAL']);
});
function response(){return {statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
test('approval rejects stale regions and forged/out-of-group IDs without writing or pushing',async()=>{
  let writes=0,pushes=0;
  let profiles=[{...drivers[0],vehicleType:'CAR_5'}];
  const prisma={trip:{findUnique:async()=>({id:'trip',status:'PENDING',audienceDriverIds:[]}),update:async({data})=>{writes++;return {id:'trip',...data};}},driverProfile:{findMany:async()=>profiles},driverConfig:{findFirst:async()=>({newTripAcceptDelaySeconds:0})}};
  const source=readFileSync(new URL('../src/controllers/tripController.js',import.meta.url),'utf8').replace(/^import[\s\S]*?;\n/gm,'').replace(/export /g,'');
  prisma.$transaction=fn=>fn(prisma);prisma.adminTripActionLog={create:async({data})=>data};
  const deps={prisma,recordTripEvent,...policy,...audienceLabel,parseAudienceRegions,matchesAudienceFilters,sendNewTripToDrivers:async()=>{pushes++;},sendTripStatusChangedToRider:async()=>{},console:{log(){},error(){}}};
  const verify=new Function(...Object.keys(deps),source+';return adminVerifyTrip;')(...Object.values(deps));
  async function run(body){const res=response();await verify({params:{id:'trip'},body,admin:{id:1},app:{get:()=>null}},res);return res;}
  const body={audienceMode:'AUDIENCE_FILTER',regions:['NORTH','CENTRAL'],driverIds:['north'],carType:'CAR_5',fuelType:'ELECTRIC'};
  assert.equal((await run(body)).statusCode,200);assert.equal(writes,1);
  for(const p of [{...drivers[2],userId:'north'}, {...drivers[3],userId:'north'}, {...drivers[0],carType:'CAR_7',vehicleType:'CAR_7'}]){
    profiles=[{vehicleType:'CAR_5',...p}];assert.equal((await run(body)).statusCode,409);
  }
  profiles=[];assert.equal((await run(body)).statusCode,400);
  for(const extra of [{regions:['INVALID']},{regions:[]},{driverIds:[]},{audienceMode:'ALL'},{audienceMode:'SELECTED'},{regions:'NORTH'}]){
    assert.equal((await run({...body,carType:undefined,fuelType:undefined,...extra})).statusCode,400);
  }
  assert.equal(writes,1);assert.equal(pushes,1);
});
test('region audience can include over 100 drivers without becoming a public broadcast',async()=>{
  const ids=Array.from({length:120},(_,i)=>'driver-'+i);
  let written;
  const prisma={trip:{findUnique:async()=>({id:'trip',status:'PENDING',audienceDriverIds:[]}),update:async({data})=>{written=data;return {id:'trip',...data};}},driverProfile:{findMany:async()=>ids.map(userId=>({...drivers[0],userId}))},driverConfig:{findFirst:async()=>({newTripAcceptDelaySeconds:0})}};
  const source=readFileSync(new URL('../src/controllers/tripController.js',import.meta.url),'utf8').replace(/^import[\s\S]*?;\n/gm,'').replace(/export /g,'');
  prisma.$transaction=fn=>fn(prisma);prisma.adminTripActionLog={create:async({data})=>data};
  const deps={prisma,recordTripEvent,...policy,...audienceLabel,parseAudienceRegions,matchesAudienceFilters,sendNewTripToDrivers:async()=>{},sendTripStatusChangedToRider:async()=>{},console:{log(){},error(){}}};
  const verify=new Function(...Object.keys(deps),source+';return adminVerifyTrip;')(...Object.values(deps));
  const res=response();await verify({params:{id:'trip'},body:{audienceMode:'AUDIENCE_FILTER',regions:['NORTH'],driverIds:ids},admin:{id:1},app:{get:()=>null}},res);
  assert.equal(res.statusCode,200);assert.deepEqual(written.audienceDriverIds,ids);assert.deepEqual(written.audienceRegions,['NORTH']);
});
