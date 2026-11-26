import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as vehiclePolicy from '../src/services/tripVehiclePolicy.js';
import {audienceWhere,canDriverSeeTrip} from '../src/services/tripAudiencePolicy.js';
import {tripPagination,tripPage} from '../src/services/tripPagination.js';

const allowed={CAR_5:['CAR_5','CAR_7','CAR_16'],CAR_7:['CAR_7','CAR_16'],CAR_16:['CAR_16']};
const source=readFileSync(new URL('../src/controllers/tripController.js',import.meta.url),'utf8');
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;},set(){}});
function controller(name,deps){
 const start=source.indexOf(`export async function ${name}(`),end=source.indexOf('\n}',start)+2;
 return new Function(...Object.keys(deps),source.slice(start,end).replace('export ','')+`;return ${name};`)(...Object.values(deps));
}

test('all seat/fuel combinations agree between the policy and the SQL filter, including legacy vehicle labels',()=>{
 for(const carType of ['CAR_5','CAR_7','CAR_16'])for(const vehicleType of ['CAR_5','CAR_7','CAR_16',null,'invalid','Xe 7 chỗ'])for(const fuelPreference of ['ANY','ELECTRIC','GASOLINE'])for(const vehicleFuelType of ['ELECTRIC','GASOLINE',null,'ANY']){
  const normalized=vehicleType==='Xe 7 chỗ'?'CAR_7':vehicleType;
  const expected=allowed[carType].includes(normalized)&&(fuelPreference==='ANY'||fuelPreference===vehicleFuelType);
  const trip={carType,fuelPreference},profile={vehicleType,vehicleFuelType},filter=vehiclePolicy.driverTripVehicleWhere(profile);
  const label=JSON.stringify({trip,profile});
  assert.equal(vehiclePolicy.canVehicleServeTrip(trip,profile),expected,label);
  assert.equal(filter.carType.in.includes(carType)&&filter.fuelPreference.in.includes(fuelPreference),expected,label);
  if(expected)assert.doesNotThrow(()=>vehiclePolicy.assertVehicleServesTrip(trip,profile));
  else assert.throws(()=>vehiclePolicy.assertVehicleServesTrip(trip,profile),e=>e.statusCode===409);
 }
 for(const trip of [{carType:null,fuelPreference:'ANY'},{carType:'CAR_5',fuelPreference:'DIESEL'}])assert.equal(vehiclePolicy.canVehicleServeTrip(trip,{vehicleType:'CAR_16',vehicleFuelType:'GASOLINE'}),false);
});

test('actual acceptance rejects incompatible current profiles before active-trip, wallet, claim or notification work',async()=>{
 for(const carType of ['CAR_5','CAR_7','CAR_16'])for(const vehicleType of ['CAR_5','CAR_7','CAR_16',null])for(const fuelPreference of ['ANY','ELECTRIC','GASOLINE'])for(const vehicleFuelType of ['ELECTRIC','GASOLINE',null]){
  const eligible=allowed[carType].includes(vehicleType)&&(fuelPreference==='ANY'||fuelPreference===vehicleFuelType);
  const calls=[];let locked=false;
  const trip={id:'t',carType,fuelPreference,audienceDriverIds:['d'],status:'PENDING',isVerified:true,verifiedAt:new Date(0),totalPrice:123456};
  const tx={driverProfile:{findUnique:async()=>{assert.equal(locked,true);return {vehicleType,vehicleFuelType,status:'VERIFIED',balance:0};}},trip:{findUnique:async()=>trip}};
  const accept=controller('acceptTrip',{...vehiclePolicy,canDriverSeeTrip,prisma:{$transaction:fn=>fn(tx)},getDriverConfigSnapshot:async()=>({maxActiveTrips:3}),
   lockDriverProfile:async()=>{locked=true;},lockTrip:async()=>{},assertTripAcceptanceAllowed:()=>{},assertCurrentContractForNewTrip:async()=>{},
   countDriverActiveTrips:async()=>{calls.push('active');return 0;},calculateDriverFinanceSnapshot:({totalPrice})=>{assert.equal(totalPrice,123456);calls.push('finance');return {requiredWalletAmount:100};},console:{log(){},error(){}}});
  const res=response();await accept({user:{id:'d'},body:{tripId:'t'}},res);
  assert.equal(res.body.code,eligible?'INSUFFICIENT_BALANCE':!vehicleType?'DRIVER_VEHICLE_INFO_REQUIRED':!allowed[carType].includes(vehicleType)?'VEHICLE_CAPACITY_MISMATCH':'VEHICLE_FUEL_MISMATCH');
  assert.deepEqual(calls,eligible?['active','finance']:[]);
  assert.equal(trip.status,'PENDING');assert.equal(trip.totalPrice,123456);
 }
});

test('actual paginated feed finds eligible trips past incompatible rows and preserves a private audience',async()=>{
 const rows=[...Array.from({length:8},(_,i)=>({id:'electric-'+i,carType:'CAR_5',fuelPreference:'ELECTRIC',audienceDriverIds:[]})),
  {id:'too-large',carType:'CAR_16',fuelPreference:'GASOLINE',audienceDriverIds:[]},
  {id:'private-other',carType:'CAR_5',fuelPreference:'GASOLINE',audienceDriverIds:['other']},
  {id:'compatible-private',carType:'CAR_5',fuelPreference:'GASOLINE',audienceDriverIds:['d']},
  {id:'compatible-public',carType:'CAR_7',fuelPreference:'ANY',audienceDriverIds:[]}].map(t=>({...t,verifiedAt:new Date(0),totalPrice:100000}));
 const list=controller('listAvailableTrips',{...vehiclePolicy,tripPagination,tripPage,audienceWhere,
  prisma:{driverProfile:{findUnique:async()=>({vehicleType:'CAR_7',vehicleFuelType:'GASOLINE'})},trip:{findMany:async({where,take})=>{
   assert.deepEqual(where.OR,audienceWhere('d').OR);assert.equal(take,2);
   // Apply the SQL predicates, then the database limit, in that order.
   return rows.filter(t=>where.carType.in.includes(t.carType)&&where.fuelPreference.in.includes(t.fuelPreference)&&canDriverSeeTrip(t,'d')).slice(0,take);
  }}},getDriverConfigSnapshot:async()=>({newTripAcceptDelaySeconds:0}),tripAudienceLabel:()=>'',calculateDriverFinanceSnapshot:()=>({}),serializeDriverTrip:t=>t,console});
 const res=response();await list({user:{id:'d'},query:{pageSize:'1'}},res);
 assert.equal(res.statusCode,200);assert.deepEqual(res.body.items.map(t=>t.id),['compatible-private']);
 assert.equal(res.body.hasMore,true);assert.equal(res.body.nextCursor,'compatible-private');
});
