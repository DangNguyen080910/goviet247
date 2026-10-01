import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as policy from '../src/services/tripAudiencePolicy.js';
function load(path, names, deps) {
 const source = readFileSync(new URL(path, import.meta.url), 'utf8').replace(/^import[\s\S]*?;\n/gm, '').replace(/export /g, '').replace('const { PrismaClient } = pkg;', '').replace('const prisma = new PrismaClient();', '');
 return new Function(...Object.keys(deps), `${source}; return {${names}};`)(...Object.values(deps));
}
async function call(fn, body = {}, extra = {}) {
 const res = { statusCode: 200, status(code) { this.statusCode=code; return this; }, json(body) { this.body=body; return this; } };
 await fn({ params: {id:'trip'}, body, admin: {id:1}, app: {get:()=>null}, ...extra },res); return res;
}
test('audience validation rejects empty/malformed and deduplicates', () => {
 for(const value of [null,[],[''],[1],Array(101).fill('a')]) assert.throws(()=>policy.parseAudience(value));
 assert.deepEqual(policy.parseAudience(['a','a','b']), ['a','b']);
 assert.equal(policy.canDriverSeeTrip({audienceDriverIds:['a']}, 'b'), false);
 assert.equal(policy.canDriverSeeTrip({audienceDriverIds:[]}, 'b'), true);
 assert.equal(policy.canDriverSeeTrip({}, 'a'), false);
});
test('approval persists audience in guarded write and refuses invalid driver', async () => {
 let write;
 const prisma = {trip: {findUnique: async()=>({status:'PENDING',audienceDriverIds:[]}), update: async(args)=>{write=args;return {id:'trip',...args.data};}},driverProfile:{count:async()=>2}};
 const deps = {prisma,...policy,buildDriverAcceptOpenAt:async()=>new Date(), createRiderTripNotification:async()=>null,sendNewTripToDrivers:async()=>{},sendTripStatusChangedToRider:async()=>{},console:{error(){},log(){}}};
 // Use actual local buildDriverAcceptOpenAt through config stub.
 prisma.driverConfig={findFirst:async()=>({newTripAcceptDelaySeconds:0})};
 const api=load('../src/controllers/tripController.js','adminVerifyTrip',Object.fromEntries(Object.entries(deps).filter(([k])=>k!=='buildDriverAcceptOpenAt' && k!=='createRiderTripNotification')));
 assert.equal((await call(api.adminVerifyTrip,{driverIds:['a','b']})).statusCode,200);
 assert.deepEqual(write.data.audienceDriverIds,['a','b']);
 assert.equal(write.where.isVerified,false);
 write=null;
 assert.equal((await call(api.adminVerifyTrip,{driverIds:['a']})).statusCode,400);
 assert.equal(write,null);
});
test('every trip event uses persisted private rooms; failures do not broadcast', async () => {
 let audience=['a','b'], fail=false; const sent=[];
 const prisma={trip:{findUnique:async()=>{if(fail)throw Error('DB');return {audienceDriverIds:audience};}}};
 const {emitDriverTripEvent}=load('../src/services/tripAudience.js','emitDriverTripEvent',{prisma,console:{error(){}}});
 const io={to:rooms=>({emit:(event,payload)=>sent.push({rooms,event,payload})})};
 await emitDriverTripEvent(io,'trip:new',{id:'trip'});
 assert.deepEqual(sent[0].rooms,['driver:a','driver:b']);
 fail=true;await emitDriverTripEvent(io,'trip:changed',{tripId:'trip'});assert.equal(sent.length,1);
 fail=false;audience=[];await emitDriverTripEvent(io,'trip:new',{id:'trip'});assert.deepEqual(sent[1].rooms,['drivers']);
});
test('push recipient query filters by stored user IDs, not caller trip data', async () => {
 let where; const prisma={trip:{findUnique:async()=>({audienceDriverIds:['a']})},device:{findMany:async(args)=>{where=args.where;return [];}}};
 const {sendNewTripToDrivers}=load('../src/services/notificationService.js','sendNewTripToDrivers',{prisma,console:{error(){},log(){}}});
 await sendNewTripToDrivers({id:'trip',audienceDriverIds:[]});assert.deepEqual(where.userId,{in:['a']});
});
test('driver list restricts at DB query before limiting results; detail only permits owner', async () => {
 let where;const prisma={driverConfig:{findFirst:async()=>null},trip:{findMany:async(args)=>{where=args.where;return [];},findUnique:async()=>({riderId:'rider',driverId:null,audienceDriverIds:['a']})}};
 const api=load('../src/controllers/tripController.js','listAvailableTrips,getTripById',{prisma,...policy,console:{error(){},log(){}}});
 await call(api.listAvailableTrips,{}, {user:{id:'b'}});assert.deepEqual(where.OR,policy.audienceWhere('b').OR);
 assert.equal((await call(api.getTripById,{}, {user:{id:'b'}})).statusCode,404);
 assert.equal((await call(api.getTripById,{}, {user:{id:'rider'}})).statusCode,200);
});
test('suggestions exclude reciprocal return and missing coordinates', async () => {
 const yesterday=new Date(Date.now()-86400000), later=new Date(Date.now()-3600000);
 const outbound={id:'out',driverId:'a',status:'COMPLETED',direction:'ONE_WAY',pickupTime:yesterday,pickupLat:10,pickupLng:106,dropoffLat:11,dropoffLng:107};
 let history=[outbound];
 const prisma={trip:{findUnique:async()=>({pickupLat:11,pickupLng:107}),findMany:async()=>history},tripConfig:{findFirst:async()=>({returnSuggestionDays:2,returnSuggestionRadiusKm:20})},driverProfile:{findMany:async()=>[{userId:'a',fullName:'A',user:{phones:[]}}]}};
 const {listTripAudienceCandidates}=load('../src/controllers/tripAudienceController.js','listTripAudienceCandidates',{prisma,distanceKm:policy.distanceKm,console});
 let result=await call(listTripAudienceCandidates,{}, {query:{}});assert.equal(result.body.items[0].suggestion.tripId,'out');
 history.push({...outbound,id:'back',status:'ACCEPTED',pickupTime:later,pickupLat:11,pickupLng:107,dropoffLat:10,dropoffLng:106});
 result=await call(listTripAudienceCandidates,{}, {query:{}});assert.equal(result.body.items[0].suggestion,null);
 history=[{...outbound,dropoffLat:null}];result=await call(listTripAudienceCandidates,{}, {query:{}});assert.equal(result.body.items[0].suggestion,null);
});

test('socket rooms derive from verified token, never payload IDs or admin claims', async () => {
 const server = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
 const source = server.slice(server.indexOf('io.use(async (socket, next)'), server.indexOf('// Pending watcher'));
 let authenticate, connect;
 const io = { use(fn) {authenticate=fn;}, on(event, fn) {connect=fn;} };
 new Function('io','userSessions','verifyAdminJwtToken','prisma','driverSockets','riderSockets','console', source)(
   io, {verify:async token=>{if(token!=='driver-token')throw Error('bad');return {id:'a'};}},
   token=>{if(token!=='admin-token')throw Error('bad');return {role:'ADMIN'};},
   {driverProfile:{findUnique:async()=>({userId:'a'})}},new Map(),new Map(),{log(){}});
 const make=token=>({id:'socket', data:{},handshake:{auth:{token},headers:{}},joined:[],handlers:{},join(room){this.joined.push(room);},on(event,fn){this.handlers[event]=fn;}});
 const missing=make(''); let error;await authenticate(missing,e=>{error=e;});assert.equal(error.message,'AUTH_REQUIRED');
 const driver=make('driver-token');await authenticate(driver,e=>{assert.equal(e,undefined);});connect(driver);
 driver.handlers.registerDriver({userId:'b'});driver.handlers.registerAdmin({role:'ADMIN'});driver.handlers.registerRider({userId:'victim'});
 assert.deepEqual(driver.joined,['drivers','driver:a','riders','rider:a']);
 const admin=make('admin-token');await authenticate(admin,e=>{assert.equal(e,undefined);});connect(admin);admin.handlers.registerAdmin();assert.deepEqual(admin.joined,['admins']);
});
