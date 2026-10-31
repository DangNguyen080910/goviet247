import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as fuelPolicy from "../src/services/vehicleFuelPolicy.js";
import * as audiencePolicy from "../src/services/tripAudiencePolicy.js";
const {fuelMatches,availableFuelWhere,assertDriverFuel}=fuelPolicy;
test("unknown and wrong fuel cannot match a specific customer preference",()=>{
  for(const fuel of [null,'ELECTRIC','GASOLINE']) assert(fuelMatches('ANY',fuel));
  assert(fuelMatches('ELECTRIC','ELECTRIC'));assert(fuelMatches('GASOLINE','GASOLINE'));
  assert.equal(fuelMatches('GASOLINE','ELECTRIC'),false);assert.equal(fuelMatches('ELECTRIC',null),false);
  assert.deepEqual(availableFuelWhere(null),{fuelPreference:{in:['ANY']}});
  assert.deepEqual(availableFuelWhere('ELECTRIC'),{fuelPreference:{in:['ANY','ELECTRIC']}});
});
function controller(name,deps){
  const source=readFileSync(new URL('../src/controllers/tripController.js',import.meta.url),'utf8').replace(/^import[\s\S]*?;\n/gm,'').replace(/export /g,'');
  return new Function(...Object.keys(deps),source+`; return ${name};`)(...Object.values(deps));
}
function response(){return {statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
test("server rejects mismatched and unknown fuel before writing a trip or debiting wallet",async()=>{
  for(const fuel of ['ELECTRIC',null]){
    const tx={driverProfile:{findUnique:async()=>({status:'VERIFIED',balance:1000000,vehicleFuelType:fuel})},trip:{findUnique:async()=>({id:'t',status:'PENDING',isVerified:true,verifiedAt:new Date(),fuelPreference:'GASOLINE',audienceDriverIds:[]})}};
    // Use the function body so configuration/database helpers can be injected independently.
    const raw=readFileSync(new URL('../src/controllers/tripController.js',import.meta.url),'utf8');const a=raw.indexOf('export async function acceptTrip('),b=raw.indexOf('\n}',a)+2;
    const deps={prisma:{$transaction:fn=>fn(tx)},...fuelPolicy,...audiencePolicy,getDriverConfigSnapshot:async()=>({}),lockDriverProfile:async()=>{},lockTrip:async()=>{},assertTripAcceptanceAllowed:()=>{},console:{log(){},error(){}}};
    const handler=new Function(...Object.keys(deps),raw.slice(a,b).replace('export ','')+';return acceptTrip;')(...Object.values(deps));
    const res=response();await handler({body:{tripId:'t'},user:{id:'d'}},res);
    assert.equal(res.statusCode,409);assert.equal(res.body.code,fuel?'FUEL_MISMATCH':'FUEL_TYPE_REQUIRED');
  }
});
test("fuel-group approval freezes matching IDs and rejects mismatched selections",async()=>{
  let written;let profiles=[{userId:'gas1',vehicleFuelType:'GASOLINE'}];
  const prisma={trip:{findUnique:async()=>({id:'t',status:'PENDING',fuelPreference:'GASOLINE',audienceDriverIds:[]}),update:async args=>{written=args;return {id:'t',...args.data};}},driverProfile:{findMany:async()=>profiles},driverConfig:{findFirst:async()=>({newTripAcceptDelaySeconds:0})}};
  const verify=controller('adminVerifyTrip',{prisma,...fuelPolicy,...audiencePolicy,sendNewTripToDrivers:async()=>{},sendTripStatusChangedToRider:async()=>{},console:{log(){},error(){}}});
  async function run(body){const res=response();await verify({params:{id:'t'},admin:{id:1},body,app:{get:()=>null}},res);return res;}
  assert.equal((await run({audienceMode:'FUEL_TYPE',fuelType:'GASOLINE',driverIds:['gas1']})).statusCode,200);
  assert.deepEqual(written.data.audienceDriverIds,['gas1']);
  written=null;profiles=[{userId:'gas1',vehicleFuelType:'ELECTRIC'}];
  assert.equal((await run({audienceMode:'FUEL_TYPE',fuelType:'GASOLINE',driverIds:['gas1']})).statusCode,409);assert.equal(written,null);
  assert.equal((await run({audienceMode:'FUEL_TYPE',fuelType:'ELECTRIC',driverIds:['gas1']})).statusCode,409);
});

test('new-trip push filters recipients using the fuel preference persisted in DB',async()=>{
  let filter;
  const source=readFileSync(new URL('../src/services/notificationService.js',import.meta.url),'utf8').replace(/^import[\s\S]*?;\n/gm,'').replace(/export /g,'').replace('const { PrismaClient } = pkg;','').replace('const prisma = new PrismaClient();','');
  const prisma={trip:{findUnique:async()=>({audienceDriverIds:[],fuelPreference:'GASOLINE'})},device:{findMany:async()=>[{userId:'electric'}]},driverProfile:{findMany:async args=>{filter=args.where;return [];}}};
  const send=new Function('prisma','activeDriverDevices','console',source+';return sendNewTripToDrivers;')(prisma,async(db,devices)=>devices,{log(){},error(){}});
  await send({id:'t',fuelPreference:'ANY'});
  assert.equal(filter.vehicleFuelType,'GASOLINE');
});
test('candidate lookup excludes unknown and mismatched fuel before returning drivers',async()=>{
  let filter;
  const source=readFileSync(new URL('../src/controllers/tripAudienceController.js',import.meta.url),'utf8').replace(/^import.*;\n/gm,'').replace('export async function','async function');
  const prisma={trip:{findUnique:async()=>({fuelPreference:'ELECTRIC'}),findMany:async()=>[]},tripConfig:{findFirst:async()=>null},driverProfile:{findMany:async args=>{filter=args.where;return [];}}};
  const handler=new Function('prisma','VEHICLE_FUELS',source+';return listTripAudienceCandidates;')(prisma,fuelPolicy.VEHICLE_FUELS);
  const res=response();await handler({params:{id:'t'},query:{}},res);
  assert.equal(res.statusCode,200);assert.equal(filter.vehicleFuelType,'ELECTRIC');
});

test('combined vehicle filter validates both seat count and fuel at approval', async()=>{
  let written;
  let profiles=[{userId:'a',vehicleType:'CAR_5',vehicleFuelType:'GASOLINE'}];
  const prisma={trip:{findUnique:async()=>({id:'t',status:'PENDING',fuelPreference:'ANY',audienceDriverIds:[]}),update:async args=>{written=args;return {id:'t',...args.data};}},driverProfile:{findMany:async()=>profiles},driverConfig:{findFirst:async()=>({newTripAcceptDelaySeconds:0})}};
  const verify=controller('adminVerifyTrip',{prisma,...fuelPolicy,...audiencePolicy,sendNewTripToDrivers:async()=>{},sendTripStatusChangedToRider:async()=>{},console:{log(){},error(){}}});
  async function run(extra={}){const res=response();await verify({params:{id:'t'},admin:{id:1},body:{audienceMode:'VEHICLE_FILTER',carType:'CAR_5',fuelType:'GASOLINE',driverIds:['a'],...extra},app:{get:()=>null}},res);return res;}
  assert.equal((await run()).statusCode,200);assert.deepEqual(written.data.audienceDriverIds,['a']);
  for(const wrong of [{vehicleType:'CAR_7',vehicleFuelType:'GASOLINE'},{vehicleType:'CAR_5',vehicleFuelType:'ELECTRIC'},{vehicleType:'CAR_5',vehicleFuelType:null}]){
    written=null;profiles=[{userId:'a',...wrong}];assert.equal((await run()).statusCode,409);assert.equal(written,null);
  }
  assert.equal((await run({carType:undefined,fuelType:undefined})).statusCode,400);
  assert.equal((await run({fuelType:'DIESEL'})).statusCode,400);
});
