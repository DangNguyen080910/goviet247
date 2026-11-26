import * as vehiclePolicy from '../src/services/tripVehiclePolicy.js';
import { tripPagination, tripPage } from "../src/services/tripPagination.js";
import {recordTripEvent,makeTripEvent} from "../src/services/tripHistory.js";
import {dropoffIsRepresented} from "../src/shared/tripRoute.js";
import * as audienceLabel from '../src/shared/tripAudienceLabel.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as audiencePolicy from '../src/services/tripAudiencePolicy.js';
const quiet = { log(){}, error(){} };
function controller(name,deps){
  const source=readFileSync(new URL('../src/controllers/tripController.js',import.meta.url),'utf8').replace(/^import[\s\S]*?;\n/gm,'').replace(/export /g,'');
  deps={...vehiclePolicy,tripPagination,tripPage,dropoffIsRepresented,...audienceLabel,getDriverConfigSnapshot:async()=>({newTripAcceptDelaySeconds:0}),assertCurrentContractForNewTrip:async()=>{},...deps};
 if(deps.prisma){deps.prisma.$transaction ||= fn=>fn(deps.prisma);deps.prisma.adminTripActionLog ||= {create:async({data})=>data};}
 deps={recordTripEvent,makeTripEvent,...deps};
  return new Function(...Object.keys(deps),source+`; return ${name};`)(...Object.values(deps));
}
function response(){return {statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}

test('public list filters customer fuel and capacity in SQL while retaining the admin audience',async()=>{
  let where;
  const rows=['ELECTRIC','ANY'].map(fuelPreference=>({id:fuelPreference,fuelPreference,verifiedAt:new Date(0),totalPrice:100000}));
  const prisma={driverProfile:{findUnique:async()=>({vehicleType:'CAR_7',vehicleFuelType:'ELECTRIC'})},driverConfig:{findFirst:async()=>({newTripAcceptDelaySeconds:0})},trip:{findMany:async args=>{where=args.where;return rows;}}};
  const list=controller('listAvailableTrips',{prisma,...audiencePolicy,calculateDriverFinanceSnapshot:()=>({}),serializeDriverTrip:t=>t,console:quiet});
  const res=response();await list({user:{id:'d'}},res);
  assert.equal(res.statusCode,200);assert.deepEqual(where.fuelPreference,{in:['ANY','ELECTRIC']});assert.deepEqual(where.carType,{in:['CAR_5','CAR_7']});
  assert.deepEqual(where.OR,audiencePolicy.audienceWhere('d').OR);
  assert.deepEqual(res.body.items.map(t=>t.fuelPreference),['ELECTRIC','ANY']);
});

test('acceptance enforces customer fuel for public and selected drivers and rejects outsiders first',async()=>{
  const raw=readFileSync(new URL('../src/controllers/tripController.js',import.meta.url),'utf8');
  const a=raw.indexOf('export async function acceptTrip('),b=raw.indexOf('\n}',a)+2;
  for(const preference of ['ANY','GASOLINE','ELECTRIC']) for(const fuel of ['ELECTRIC','GASOLINE',null]) for(const audience of [[],['d'],['other']]){
    const tx={driverProfile:{findUnique:async()=>({status:'VERIFIED',balance:0,vehicleType:'CAR_5',vehicleFuelType:fuel})},trip:{findUnique:async()=>({id:'t',status:'PENDING',isVerified:true,verifiedAt:new Date(),carType:'CAR_5',fuelPreference:preference,audienceDriverIds:audience})}};
    const deps={...vehiclePolicy,...audienceLabel,assertCurrentContractForNewTrip:async()=>{},prisma:{$transaction:fn=>fn(tx)},...audiencePolicy,getDriverConfigSnapshot:async()=>({maxActiveTrips:3}),lockDriverProfile:async()=>{},lockTrip:async()=>{},assertTripAcceptanceAllowed:()=>{},countDriverActiveTrips:async()=>0,calculateDriverFinanceSnapshot:()=>({requiredWalletAmount:95000}),console:quiet};
    const handler=new Function(...Object.keys(deps),raw.slice(a,b).replace('export ','')+';return acceptTrip;')(...Object.values(deps));
    const res=response();await handler({body:{tripId:'t'},user:{id:'d'}},res);
    // Matching vehicles reach the unchanged wallet check; private outsiders are rejected first.
    assert.equal(res.body.code,audience.includes('other')?'TRIP_NOT_AVAILABLE':preference==='ANY'||preference===fuel?'INSUFFICIENT_BALANCE':'VEHICLE_FUEL_MISMATCH');
  }
});

test('approval only checks fuel when admin explicitly chooses a fuel group',async()=>{
  let written,profiles=[];
  const prisma={trip:{findUnique:async()=>({id:'t',status:'PENDING',fuelPreference:'GASOLINE',audienceDriverIds:[]}),update:async args=>{written=args;return {id:'t',...args.data};}},driverProfile:{findMany:async()=>profiles},driverConfig:{findFirst:async()=>({newTripAcceptDelaySeconds:0})}};
  const verify=controller('adminVerifyTrip',{prisma,...audiencePolicy,sendNewTripToDrivers:async()=>{},sendTripStatusChangedToRider:async()=>{},console:quiet});
  async function run(body){written=null;const res=response();await verify({params:{id:'t'},admin:{id:1},body,app:{get:()=>null}},res);return res;}
  assert.equal((await run({audienceMode:'ALL'})).statusCode,200);assert.deepEqual(written.data.audienceDriverIds,[]);
  profiles=[{userId:'a',vehicleType:'CAR_5',vehicleFuelType:null}];
  for(const body of [{audienceMode:'SELECTED',driverIds:['a']},{audienceMode:'CAR_TYPE',carType:'CAR_5',driverIds:['a']}]){
    assert.equal((await run(body)).statusCode,200);assert.deepEqual(written.data.audienceDriverIds,['a']);
  }
  for(const fuelType of ['GASOLINE','ELECTRIC']){
    profiles=[{userId:'a',vehicleType:'CAR_5',vehicleFuelType:fuelType}];
    assert.equal((await run({audienceMode:'FUEL_TYPE',fuelType,driverIds:['a']})).statusCode,200);
    assert.deepEqual(written.data.audienceDriverIds,['a']);
    profiles=[{userId:'a',vehicleType:'CAR_5',vehicleFuelType:null}];
    assert.equal((await run({audienceMode:'FUEL_TYPE',fuelType,driverIds:['a']})).statusCode,409);assert.equal(written,null);
  }
});

test('new-trip push uses current persisted requirements and current vehicles within the admin audience',async()=>{
  const raw=readFileSync(new URL('../src/services/notificationService.js',import.meta.url),'utf8');
  const start=raw.indexOf('export async function sendNewTripToDrivers('),end=raw.indexOf('\n}',start)+2;
  const profiles=[{userId:'small',vehicleType:'CAR_5',vehicleFuelType:'GASOLINE'},
    {userId:'gas',vehicleType:'CAR_7',vehicleFuelType:'GASOLINE'},
    {userId:'electric',vehicleType:'CAR_16',vehicleFuelType:'ELECTRIC'},
    {userId:'large',vehicleType:'CAR_16',vehicleFuelType:'GASOLINE'},
    {userId:'unknown',vehicleType:'CAR_7',vehicleFuelType:null}];
  for(const audience of [[],['small','gas','electric','unknown'],['electric']]){
    const sent=[];
    const prisma={trip:{findUnique:async()=>({audienceDriverIds:audience,carType:'CAR_7',fuelPreference:'GASOLINE',status:'PENDING',isVerified:true})},
      device:{findMany:async({where})=>{assert.deepEqual(where.userId,audience.length?{in:audience}:undefined);return profiles.filter(p=>!audience.length||audience.includes(p.userId)).map(p=>({userId:p.userId,pushToken:p.userId}));}},
      driverProfile:{findMany:async({where})=>profiles.filter(p=>where.userId.in.includes(p.userId))}};
    const deps={...vehiclePolicy,prisma,isDeliveringNotification:()=>true,activeDriverDevices:async(db,devices)=>devices,console:quiet,isExpoPushToken:()=>true,maskAddress:()=>'',shortText:s=>s,formatVnd:()=>'',chunkArray:a=>[a],sendExpoPushMessages:async messages=>{sent.push(...messages);return [];}};
    const send=new Function(...Object.keys(deps),raw.slice(start,end).replace('export ','')+';return sendNewTripToDrivers;')(...Object.values(deps));
    // Stale job disagrees with the current trip; the database remains authoritative.
    await send({id:'t',carType:'CAR_5',fuelPreference:'ELECTRIC'});
    assert.deepEqual(sent.map(m=>m.to),audience.length?audience.includes('gas')?['gas']:[]:['gas','large']);
  }
});

test('candidate lookup includes all fuels so admin can choose any group',async()=>{
  let filter;
  const source=readFileSync(new URL('../src/controllers/tripAudienceController.js',import.meta.url),'utf8').replace(/^import.*;\n/gm,'').replace('export async function','async function');
  const prisma={trip:{findUnique:async()=>({fuelPreference:'ELECTRIC'}),findMany:async()=>[]},tripConfig:{findFirst:async()=>null},driverProfile:{findMany:async args=>{filter=args.where;return [];}}};
  const handler=new Function('prisma',source+';return listTripAudienceCandidates;')(prisma);
  const res=response();await handler({params:{id:'t'},query:{}},res);
  assert.equal(res.statusCode,200);assert.equal(filter.vehicleFuelType,undefined);
  assert.doesNotMatch(res.body.warning,/chỉ liệt kê/);
});

test('explicit combined filter still validates both seat count and fuel',async()=>{
  let written,profiles=[{userId:'a',vehicleType:'CAR_5',vehicleFuelType:'GASOLINE'}];
  const prisma={trip:{findUnique:async()=>({id:'t',status:'PENDING',fuelPreference:'ANY',audienceDriverIds:[]}),update:async args=>{written=args;return {id:'t',...args.data};}},driverProfile:{findMany:async()=>profiles},driverConfig:{findFirst:async()=>({newTripAcceptDelaySeconds:0})}};
  const verify=controller('adminVerifyTrip',{prisma,...audiencePolicy,sendNewTripToDrivers:async()=>{},sendTripStatusChangedToRider:async()=>{},console:quiet});
  async function run(extra={}){written=null;const res=response();await verify({params:{id:'t'},admin:{id:1},body:{audienceMode:'VEHICLE_FILTER',carType:'CAR_5',fuelType:'GASOLINE',driverIds:['a'],...extra},app:{get:()=>null}},res);return res;}
  assert.equal((await run()).statusCode,200);assert.deepEqual(written.data.audienceDriverIds,['a']);
  for(const wrong of [{vehicleType:'CAR_7',vehicleFuelType:'GASOLINE'},{vehicleType:'CAR_5',vehicleFuelType:'ELECTRIC'},{vehicleType:'CAR_5',vehicleFuelType:null}]){
    profiles=[{userId:'a',...wrong}];assert.equal((await run()).statusCode,409);assert.equal(written,null);
  }
  assert.equal((await run({carType:undefined,fuelType:undefined})).statusCode,400);
  assert.equal((await run({fuelType:'DIESEL'})).statusCode,400);
});
