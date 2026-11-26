import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminSessionVerifier,adminTokenVersion} from '../src/services/adminSessions.js';
import {createBookingQuoteService,quoteRequestHash} from '../src/services/bookingQuotes.js';
import {createBookableTrip} from '../src/services/carAvailability.js';
import {assertOtpSendAvailable,respondToOtpLock} from '../src/services/otpService.js';
import {driverDocumentKey} from '../src/services/s3Service.js';
import {tripPagination,tripPage} from '../src/services/tripPagination.js';
import {readTripPages} from '../src/shared/tripPages.js';
import {createRequestRateLimit} from '../src/middleware/requestRateLimit.js';

const input={pickupAddress:'Địa chỉ A',dropoffAddress:'Địa chỉ B',stops:['Địa chỉ B'],
 routePricingPoints:[{placeId:'goong|a',address:'Địa chỉ A'},{placeId:'goong|b',address:'Địa chỉ B'}],
 carType:'CAR_5',direction:'ONE_WAY',fuelPreference:'ANY',pickupTime:'2099-01-01T08:00:00+07:00',returnTime:null,
 distanceKm:10,driveMinutes:10,outboundDriveMinutes:10};
function quoteFixture(){
 const records=new Map();let routeCalls=0,priceCalls=0,amount=1000000;
 const db={bookingQuote:{create:async({data})=>{records.set(data.tokenHash,data);return data;},findUnique:async({where})=>records.get(where.tokenHash)}};
 const service=createBookingQuoteService({db,search:async address=>[{placeId:address==='Địa chỉ A'?'goong|a':'goong|b',fullAddress:address}],
  detail:async id=>({fullAddress:id==='goong|a'?'Địa chỉ A':'Địa chỉ B',lat:id==='goong|a'?10:11,lng:106}),
  route:async points=>{routeCalls++;assert.equal(points.length,2);return{distanceKm:100,durationMinutes:120,outboundDurationMinutes:120,returnDurationMinutes:0};},
  price:async data=>{priceCalls++;assert.equal(data.distanceKm,100);assert.equal(data.driveMinutes,120);return{ok:true,data:{finalPrice:amount,pricePerKm:10000,distanceKm:data.distanceKm,destinationService:{sessions:[],fee:0},regionalSurcharge:{amount:0}}};}});
 return{service,records,get routes(){return routeCalls;},get prices(){return priceCalls;},set amount(value){amount=value;}};
}
test('client distance/time cannot lower the fare; old payloads are also resolved by address',async()=>{
 const f=quoteFixture();const result=await f.service.booking(input);assert.equal(result.route.distanceKm,100);assert.equal(result.pricing.totalPrice,1000000);
 const old={...input};delete old.routePricingPoints;const legacy=await f.service.booking(old);assert.equal(legacy.route.distanceKm,100);
});
test('server holds the verified fare across configuration changes, with no second map/price call',async()=>{
 const f=quoteFixture();const first=await f.service.booking(input);const token=await f.service.issue(input,{finalPrice:first.pricing.totalPrice,pricePerKm:10000,distanceKm:100,destinationService:{sessions:[]}},first.route);
 f.amount=3000000;const held=await f.service.booking({...input,...token,distanceKm:1});
 assert.equal(held.pricing.totalPrice,1000000);assert.equal(held.route.distanceKm,100);assert.equal(f.routes,1);assert.equal(f.prices,1);
});
test('a held quote is bound to itinerary, schedule, vehicle, fuel and charter choices',async()=>{
 const f=quoteFixture(),route=await f.service.verifiedRoute(input);
 const token=await f.service.issue(input,{finalPrice:1000000},route);
 for(const changed of [{fuelPreference:'GASOLINE'},{carType:'CAR_7'},{pickupTime:'2099-01-02T08:00:00+07:00'},
  {stops:['Địa chỉ C'],dropoffAddress:'Địa chỉ C'},{destinationServiceDates:['2099-01-02']}]){
  await assert.rejects(f.service.booking({...input,...token,...changed}),{status:409});
 }
});
test('expired explicit quotes cannot be used; old history tokens can reprice safely',async()=>{
 const f=quoteFixture(),route=await f.service.verifiedRoute(input);const token=await f.service.issue(input,{finalPrice:1000000},route);
 [...f.records.values()][0].expiresAt=new Date(0);
 await assert.rejects(f.service.booking({...input,...token}),{status:409});
 const old=await f.service.booking({...input,quoteHistoryToken:token.quoteToken});assert.equal(old.route.distanceKm,100);
});
test('legacy quote history token honors the held fare and equivalent VN/UTC times',async()=>{
 const f=quoteFixture(),route=await f.service.verifiedRoute(input);const token=await f.service.issue(input,{finalPrice:1000000},route);
 f.amount=9000000;const old=await f.service.booking({...input,pickupTime:'2099-01-01T01:00:00Z',quoteHistoryToken:token.quoteToken});
 assert.equal(old.pricing.totalPrice,1000000);assert.equal(f.prices,0);
 assert.equal(quoteRequestHash(input),quoteRequestHash({...input,pickupTime:'2099-01-01T01:00:00Z'}));
});
test('substituted addresses and last stops are rejected instead of trusting coordinates',async()=>{
 const f=quoteFixture();await assert.rejects(f.service.verifiedRoute({...input,stops:['Địa chỉ khác']}),{status:409});
 await assert.rejects(f.service.verifiedRoute({...input,pickupAddress:'Địa chỉ giả'}),{status:409});
});

for(const field of ['is_active','role','password_hash','authVersion'])test('Admin token is revoked when '+field+' changes',async()=>{
 const row={id:1,username:'audit',is_active:true,role:'ADMIN',password_hash:'hash-before'};
 const claims={id:1,role:'ADMIN',av:adminTokenVersion(row)};
 const verify=createAdminSessionVerifier({admin_users:{findUnique:async()=>row}},()=>claims);
 assert.equal((await verify('offline')).id,1);
 row[field]=field==='is_active'?false:field==='role'?'STAFF':field==='authVersion'?1:'hash-after';
 await assert.rejects(verify('offline'),{status:401});
});
test('unversioned old Admin tokens are invalid, while DB outages are not classified as logout',async()=>{
 const row={id:1,is_active:true,role:'ADMIN',password_hash:'hash'};
 const verify=createAdminSessionVerifier({admin_users:{findUnique:async()=>row}},()=>({id:1,role:'ADMIN'}));
 await assert.rejects(verify('offline'),{status:401});
 const outage=createAdminSessionVerifier({admin_users:{findUnique:async()=>{throw new Error('offline');}}},()=>({id:1,role:'ADMIN',av:adminTokenVersion(row)}));
 await assert.rejects(outage('offline'),error=>error.status!==401);
});

function bookingDb(){
 const records=new Map(),locks=new Map();let count=0,chats=0,blocked=false;
 return {records,get count(){return count;},get chats(){return chats;},set blocked(value){blocked=value;},
  async $transaction(fn){const held=[];const tx={tripConfig:{findFirst:async()=>({})},
   async $queryRawUnsafe(sql,key){
    if(!sql.includes('pg_advisory'))return [];
    assert.match(sql,/hashtextextended\(\$1, 0\)/);
    const previous=locks.get(key);let release;const current=new Promise(r=>release=r);locks.set(key,current);
    if(previous)await previous;held.push(()=>{release();if(locks.get(key)===current)locks.delete(key);});return[];
   },
   riderProfile:{findFirst:async()=>blocked?{status:'SUSPENDED'}:null},
   pricingConfig:{findUnique:async()=>({isActive:true})},
   trip:{findUnique:async({where})=>records.has(where.bookingRequestKey)?structuredClone(records.get(where.bookingRequestKey)):null,
    create:async({data})=>{await Promise.resolve();const row={...data,id:'trip-'+(++count),createdAt:new Date()};records.set(data.bookingRequestKey,row);return row;}},
   tripStop:{createMany:async()=>({count:1})},tripChatMessage:{createMany:async()=>{chats++;return{count:1};}},
  };try{return await fn(tx);}finally{held.forEach(release=>release());}}
 };
}
const booking={riderId:'rider',bookingRequestKey:'offline-request',bookingStops:['Địa chỉ B'],
 pickupAddress:'Địa chỉ A',pickupTime:new Date('2099-01-01T01:00:00Z'),carType:'CAR_5',direction:'ONE_WAY',totalPrice:1000000,status:'PENDING'};
test('parallel retries create one trip, one chat notice and return the original booking',async()=>{
 const db=bookingDb();const results=await Promise.all(Array.from({length:8},()=>createBookableTrip(db,{...booking})));
 assert.equal(db.count,1);assert.equal(db.chats,1);assert.equal(new Set(results.map(t=>t.id)).size,1);
 await assert.rejects(createBookableTrip(db,{...booking,riderName:'Different customer'}),{status:409});
});
test('a distinct request can intentionally book another identical car',async()=>{
 const db=bookingDb();await createBookableTrip(db,{...booking});await createBookableTrip(db,{...booking,bookingRequestKey:'another-request'});assert.equal(db.count,2);
});
test('a suspended rider cannot create a new booking',async()=>{
 const db=bookingDb();db.blocked=true;await assert.rejects(createBookableTrip(db,{...booking}),{status:403});assert.equal(db.count,0);
});

test('OTP cooldown rejects a resend before creating or sending anything',async()=>{
 const until=new Date(Date.now()+30000);const tx={tripConfig:{findFirst:async()=>({})},otpSession:{findFirst:async args=>args.where.status?{resendAfter:until}:null,findMany:async()=>[]}};
 const error=await assertOtpSendAvailable(tx,'phone').catch(e=>e);assert.equal(error.code,'OTP_RESEND_COOLDOWN');
 const res={set(){return this;},status(code){this.code=code;return this;},json(value){this.value=value;return this;}};
 assert.equal(respondToOtpLock(res,error),true);assert.equal(res.code,429);
 until.setTime(Date.now()-1);await assertOtpSendAvailable(tx,'phone');
});
test('driver documents cannot point to someone else or accounting keys',()=>{
 assert.equal(driverDocumentKey('driver-documents/me/photo.jpg','me'),'driver-documents/me/photo.jpg');
 for(const key of ['driver-documents/other/photo.jpg','accounting-documents/2099/file.pdf','driver-documents/me/../other.jpg','https://foreign.invalid/driver-documents/me/photo.jpg'])assert.equal(driverDocumentKey(key,'me'),null);
});
test('pagination preserves all rows and clients detect looping cursors',async()=>{
 assert.equal(tripPagination({}),null);assert.throws(()=>tripPagination({pageSize:'999'}));
 const page=tripPage(Array.from({length:101},(_,i)=>({id:String(i)})),tripPagination({pageSize:'100'}));assert.equal(page.items.length,100);assert.equal(page.nextCursor,'99');
 const all=await readTripPages(async cursor=>cursor?{success:true,items:[{id:'b'},{id:'c'}]}:{success:true,items:[{id:'a'},{id:'b'}],nextCursor:'b'});assert.deepEqual(all.map(x=>x.id),['a','b','c']);
 await assert.rejects(readTripPages(async()=>({success:true,items:[],nextCursor:'loop'})));
});
test('request throttling returns Retry-After without affecting another identity',()=>{
 const limit=createRequestRateLimit({max:1,windowMs:30000});let passed=0;
 const res={set(k,v){this[k]=v;return this;},status(c){this.code=c;return this;},json(){return this;}};
 limit({ip:'one'},res,()=>passed++);limit({ip:'one'},res,()=>passed++);assert.equal(res.code,429);assert.ok(Number(res['Retry-After'])>0);
 limit({ip:'two'},res,()=>passed++);assert.equal(passed,2);
});

test('malformed schedule returns a controlled error and round-trip requires a return clock',async()=>{
 const f=quoteFixture();
 for(const bad of ['invalid','2099-02-31T08:00'])assert.throws(()=>quoteRequestHash({...input,pickupTime:bad}),{status:409});
 for(const returnTime of [null,'invalid','2098-01-01T08:00:00+07:00'])await assert.rejects(f.service.verifiedRoute({...input,direction:'ROUND_TRIP',returnTime}),{status:409});
 assert.equal(f.routes,0);
});
test('stored coordinates and total trip duration come from the verified route and schedule',async()=>{
 const f=createBookingQuoteService({detail:async id=>({fullAddress:id==='goong|a'?'Địa chỉ A':'Địa chỉ B',lat:id==='goong|a'?10:11,lng:106}),
  route:async()=>({distanceKm:200,durationMinutes:180,outboundDurationMinutes:120,returnDurationMinutes:60})});
 const result=await f.verifiedRoute({...input,direction:'ROUND_TRIP',returnTime:'2099-01-01T18:00:00+07:00',pickupLat:0,dropoffLat:0});
 assert.equal(result.pickupLat,10);assert.equal(result.dropoffLat,11);assert.equal(result.estimatedDurationMinutes,660);assert.equal(result.driveMinutes,180);
});
test('legacy booking defaults remain one-way and five-seat when optional fields are omitted',async()=>{
 const f=quoteFixture(),legacy={...input};delete legacy.direction;delete legacy.carType;
 assert.equal(quoteRequestHash(legacy),quoteRequestHash(input));assert.equal((await f.service.booking(legacy)).pricing.totalPrice,1000000);
});
