import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import express from 'express';
import {quotePrice} from '../src/services/pricingService.js';
import {createBookingQuoteService} from '../src/services/bookingQuotes.js';
import {assertDestinationQuote} from '../src/services/destinationService.js';
import {assertRegionalQuote} from '../src/services/regionalPricing.js';
import {createBookableTrip} from '../src/services/carAvailability.js';
import {bookingRequestKey} from '../src/services/bookingIdentity.js';
import {parseTripTime} from '../src/utils/tripTime.js';
import {createRequestRateLimit} from '../src/middleware/requestRateLimit.js';

const ts=createRequire(import.meta.url)('typescript'), noop=async()=>{};
// JSONB does not preserve object key order. Reorder recursively at the storage boundary,
// including nested service sessions and regional pricing config; arrays retain order.
const jsonb=value=>Array.isArray(value)?value.map(jsonb):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,jsonb(value[key])])):value;
function load(relative,bindings){
  const source=readFileSync(new URL('../src/'+relative,import.meta.url),'utf8');
  const ast=ts.createSourceFile(relative,source,ts.ScriptTarget.Latest,true), modules={};
  for(const node of ast.statements)if(ts.isImportDeclaration(node)){
    const values=modules[node.moduleSpecifier.text] ||= {__esModule:true}, clause=node.importClause;
    if(clause?.name)values.default=bindings[clause.name.text] || {};
    if(clause?.namedBindings?.elements)for(const item of clause.namedBindings.elements)values[item.propertyName?.text || item.name.text]=bindings[item.name.text] || noop;
  }
  const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {exports,require:id=>{assert.ok(id in modules,id);return modules[id];},console:{log(){},error(){}},Date,URL,process:{env:{}},setInterval,clearInterval});
  return exports;
}
async function fixture(run,{regional=false,overnightFlat=false}={}){
  const held=new Map(), trips=new Map();let saved=0, mapCalls=0, priceCalls=0;
  const config={baseFare:0,pricePerKm:5000,pricePerHour:10000,minFare:100000,overnightFee:300000,overnightTriggerKm:600,overnightTriggerHours:12,gasolineSurchargePercent:10};
  if (overnightFlat) config.roundTripWaitingConfig={freeWaitingMinutes:60,nightStartHour:22,nightEndHour:6,nightMinWaitHours:5,overnightPricePerHour:20000};
  const db={pricingConfig:{findFirst:async()=>config,findUnique:async()=>({isActive:true})},
    tripConfig:{findFirst:async()=>({quoteExpireSeconds:120,regionalPricingConfig:{NORTH:0,CENTRAL:regional?10:0,SOUTH:0}})},
    bookingQuote:{create:async({data})=>held.set(data.tokenHash,{...data,pricing:jsonb(data.pricing),route:jsonb(data.route)}),findUnique:async({where})=>held.get(where.tokenHash)},
    $transaction:async fn=>fn({$queryRawUnsafe:noop,riderProfile:{findFirst:async()=>null},pricingConfig:{findUnique:async()=>({isActive:true})},
      trip:{findUnique:async({where})=>trips.get(where.bookingRequestKey),create:async({data})=>{const trip={...data,id:'offline-'+(++saved),createdAt:new Date()};trips.set(data.bookingRequestKey,trip);return trip;}},
      tripStop:{createMany:noop},tripChatMessage:{createMany:noop}})};
  const service=createBookingQuoteService({db,knownPlace:()=>null,
    route:async coords=>{mapCalls++;return{distanceKm:200,durationMinutes:coords.length>2?240:120,outboundDurationMinutes:120,returnDurationMinutes:coords.length>2?120:0};},
    price:async input=>{priceCalls++;return quotePrice(input,db);}});
  const pricing=load('controllers/pricingController.js',{pkg:{PrismaClient:class{constructor(){return db;}}},bookingQuotes:service,
    quotePrice:input=>quotePrice(input,db),validateTripDistance:async()=>({ok:true}),recordQuoteHistory:async()=>({quoteHistoryToken:'a'.repeat(64)})});
  const router=load('routes/trips.js',{Router:express.Router,pkg:{PrismaClient:class{constructor(){return db;}}},
    verifyToken:(req,res,next)=>{if(!req.headers.authorization)return res.status(401).json({success:false});req.user={uid:'offline-rider'};next();},
    createRequestRateLimit,parseTripTime,bookingQuotes:service,bookingRequestKey,assertDestinationQuote,assertRegionalQuote,createBookableTrip,
    validateTripDistance:async()=>({ok:true}),getEffectiveTripConfig:async()=>({maxStops:10}),sendAdminPushNotification:noop}).default;
  const app=express();app.use(express.json());app.post('/quote',pricing.quote);app.use('/trips',router);
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const base='http://127.0.0.1:'+server.address().port;
  const post=async(path,input,authenticated=true)=>{const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(authenticated?{Authorization:'Bearer offline-session'}:{})},body:JSON.stringify(input)});return{status:response.status,body:await response.json()};};
  try{await run({post,held,get saved(){return saved;},get mapCalls(){return mapCalls;},get priceCalls(){return priceCalls;}});}finally{await new Promise(resolve=>server.close(resolve));}
}
const points=JSON.parse(readFileSync(new URL('../src/data/booking-trusted-places.json',import.meta.url)));
const pickup=points['goviet247:province:tp-hcm'].fullAddress, dropoff=points['goviet247:province:khanh-hoa'].fullAddress;
const request={pickupAddress:pickup,dropoffAddress:dropoff,stops:[dropoff],destinationAnchorAddress:dropoff,
  routePricingPoints:[{placeId:'goviet247:province:tp-hcm',address:pickup},{placeId:'goviet247:province:khanh-hoa',address:dropoff}],
  historyContext:{pickupAddress:pickup,stops:[dropoff]},pickupTime:'2099-01-01T08:00:00+07:00',distanceKm:200,direction:'ONE_WAY',carType:'CAR_5'};
function booking(input,data,legacy=false){
  const result={...input,fareEstimate:data.finalPrice,destinationServiceSignature:data.destinationServiceSignature,regionalPricingSignature:data.regionalPricingSignature,
    quoteHistoryToken:data.quoteHistoryToken,...(!legacy?{quoteToken:data.quoteToken,bookingRequestId:data.quoteToken}:{})};
  if(legacy)delete result.routePricingPoints;
  return result;
}
for (const legacy of [false,true]) test(`HTTP overnight flat quote → create with releasedMobile=${legacy}`, async()=>fixture(async f=>{
  const input={...request,direction:'ROUND_TRIP',returnTime:'2099-01-03T15:00:00+07:00'};
  const quoted=await f.post('/quote',input,false);
  assert.equal(quoted.status,200,JSON.stringify(quoted.body));
  assert.equal(quoted.body.data.waitingPricingMode,'OVERNIGHT_FLAT');
  assert.equal(quoted.body.data.waitingTierAdjustment,0);
  const created=await f.post('/trips',booking(input,quoted.body.data,legacy));
  assert.equal(created.status,201,JSON.stringify(created.body));
  assert.equal(created.body.trip.totalPrice,quoted.body.data.finalPrice);
  assert.equal(created.body.trip.destinationService.tourDisplay.waitingPricingMode,'OVERNIGHT_FLAT');
  assert.equal(f.saved,1);
  assert.equal(f.priceCalls,0,'held quote booking must not reprice');
}, {overnightFlat:true}));
for (const carType of ['CAR_5','CAR_7','CAR_16'])for (const legacy of [false,true])for (const regional of [false,true]) {
  test(`HTTP corrected charter → JSONB → create: ${carType}, releasedMobile=${legacy}, regional=${regional}`, async()=>fixture(async f=>{
    const input={...request,carType,direction:'ROUND_TRIP',fuelPreference:'GASOLINE',returnTime:'2099-01-03T15:00:00+07:00',destinationServiceDates:['2099-01-02']};
    const quoted=await f.post('/quote',input,false);
    assert.equal(quoted.status,200,JSON.stringify(quoted.body));
    const data=quoted.body.data;
    assert.equal(data.charterPricingVersion,1);
    assert.ok(data.charterWaitingCredit>0);
    const created=await f.post('/trips',booking(input,data,legacy));
    assert.equal(created.status,201,JSON.stringify(created.body));
    assert.equal(created.body.trip.totalPrice,data.finalPrice);
    assert.equal(created.body.trip.destinationService.tourDisplay.charterWaitingCredit,data.charterWaitingCredit);
    assert.equal(created.body.trip.destinationService.tourDisplay.nightTransitionAdjustment,data.nightTransitionAdjustment);
    assert.equal(f.saved,1);
    assert.equal(f.priceCalls,0);
  }, {overnightFlat:true,regional}));
}
for(const regional of [false,true])for(const kind of ['ONE_WAY','ROUND_TRIP','CHARTER'])for(const legacy of [false,true]){
  test(`HTTP quote → JSONB → create: ${kind}, regional=${regional}, releasedMobile=${legacy}`,async()=>fixture(async f=>{
    const input={...request,...(kind==='ONE_WAY'?{}:{direction:'ROUND_TRIP',returnTime:'2099-01-03T15:00:00+07:00'}),...(kind==='CHARTER'?{destinationServiceDates:['2099-01-02']}:{} )};
    const quoted=await f.post('/quote',input,false);assert.equal(quoted.status,200,JSON.stringify(quoted.body));
    const payload=booking(input,quoted.body.data,legacy);
    assert.equal((await f.post('/trips',payload,false)).status,401);
    const result=await f.post('/trips',payload);assert.equal(result.status,201,JSON.stringify(result.body));
    assert.equal(result.body.trip.totalPrice,quoted.body.data.finalPrice);assert.equal(f.saved,1);
    assert.equal(result.body.trip.destinationService.sessions.length,kind==='CHARTER'?1:0);
    assert.equal(f.mapCalls,1,'held quote must not call maps again');assert.equal(f.priceCalls,0);
    const retry=await f.post('/trips',payload);assert.equal(retry.status,200,JSON.stringify(retry.body));assert.equal(f.saved,1);
    assert.equal(retry.body.trip.id,result.body.trip.id);
  },{regional}));
}
test('same held quote rejects changed service/region signatures, itinerary, choices, price and expired token',async()=>fixture(async f=>{
  const quoted=await f.post('/quote',request,false);const payload=booking(request,quoted.body.data);
  for(const change of [{destinationServiceSignature:'changed'},{regionalPricingSignature:'changed'},{fareEstimate:1},{carType:'CAR_7'},{destinationServiceDates:['2099-01-02']},{stops:['different'],dropoffAddress:'different'}]){
    const result=await f.post('/trips',{...payload,...change});assert.equal(result.status,409,JSON.stringify(result.body));assert.equal(f.saved,0);
  }
  for(const row of f.held.values())row.expiresAt=new Date(0);
  assert.equal((await f.post('/trips',payload)).status,409);assert.equal(f.saved,0);
}));
for(const kind of ['ONE_WAY','ROUND_TRIP','CHARTER'])test(`released Mobile without either quote token still books: ${kind}`,async()=>fixture(async f=>{
  const input={...request,...(kind==='ONE_WAY'?{}:{direction:'ROUND_TRIP',returnTime:'2099-01-03T15:00:00+07:00'}),...(kind==='CHARTER'?{destinationServiceDates:['2099-01-02']}:{} )};
  const quoted=await f.post('/quote',input,false),payload=booking(input,quoted.body.data,true);
  delete payload.quoteHistoryToken;
  const result=await f.post('/trips',payload);
  assert.equal(result.status,201,JSON.stringify(result.body));assert.equal(f.saved,1);
  assert.equal(result.body.trip.totalPrice,quoted.body.data.finalPrice);assert.equal(f.priceCalls,1);
}));
test('charter cannot omit its signature and a regional surcharge cannot omit its signature',async()=>fixture(async f=>{
  const input={...request,direction:'ROUND_TRIP',returnTime:'2099-01-03T15:00:00+07:00',destinationServiceDates:['2099-01-02']};
  const quoted=await f.post('/quote',input,false),payload=booking(input,quoted.body.data);
  for(const field of ['destinationServiceSignature','regionalPricingSignature']){
    const changed={...payload};delete changed[field];
    assert.equal((await f.post('/trips',changed)).status,409);assert.equal(f.saved,0);
  }
},{regional:true}));
