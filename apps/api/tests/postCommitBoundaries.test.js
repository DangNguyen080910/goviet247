import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {createNotificationOutbox,isDeliveringNotification} from '../src/services/notificationOutbox.js';
import {bookingRequestKey} from '../src/services/bookingIdentity.js';
const ts=createRequire(import.meta.url)('typescript'),quiet={log(){},error(){}};
function load(file,bindings){
  const source=readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),modules={};
  for(const node of ast.statements)if(ts.isImportDeclaration(node)){
    const values=modules[node.moduleSpecifier.text] ||= {__esModule:true},clause=node.importClause;
    if(clause?.name)values.default=bindings[clause.name.text] || {};
    if(clause?.namedBindings?.elements)for(const i of clause.namedBindings.elements)values[i.propertyName?.text || i.name.text]=bindings[i.name.text];
  }
  const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>modules[id],console:quiet,Date,Map});return exports;
}
test('all six production notification entry points enqueue without touching device/network delivery',async()=>{
  const jobs=[];const outbox=createNotificationOutbox({db:{$executeRawUnsafe:async(_,id,kind,payload)=>{jobs.push({kind,args:JSON.parse(payload)});return 1;}},logger:quiet});
  const api=load('services/notificationService.js',{notificationOutbox:outbox,isDeliveringNotification,pkg:{PrismaClient:class{constructor(){return{device:{findMany:async()=>assert.fail('device lookup during request')}};}}},sendChatPushBatch:async()=>assert.fail('network during request')});
  const trip={id:'trip'},notice={id:'notice',audience:'DRIVER'};
  const results=await Promise.all([api.sendNewTripToDrivers(trip),api.sendSystemNotificationToDrivers(notice),api.sendSystemNotificationToDriver('driver',notice),api.sendAdminPushNotification({title:'offline'}),api.sendSystemNotificationToRiders({...notice,audience:'RIDER'}),api.sendTripStatusChangedToRider(trip)]);
  assert.equal(jobs.length,6);assert.equal(results.every(r=>r.queued),true);assert.equal(new Set(jobs.map(j=>j.kind)).size,6);
});
test('new-trip jobs are discarded after acceptance/cancellation or a newer resend generation',async()=>{
  let current={audienceDriverIds:['driver'],status:'ACCEPTED',isVerified:true,driverId:'driver'};
  const api=load('services/notificationService.js',{isDeliveringNotification:()=>true,pkg:{PrismaClient:class{constructor(){return{trip:{findUnique:async()=>current},device:{findMany:async()=>assert.fail('stale new-trip push')}};}}}});
  for(const changed of [{status:'ACCEPTED',driverId:'driver'},{status:'CANCELLED',driverId:null},{status:'PENDING',driverId:null,isVerified:false},{status:'PENDING',driverId:null,isVerified:true,verifiedAt:'2099-01-02'}]){
    current={...current,...changed};await api.sendNewTripToDrivers({id:'trip',verifiedAt:'2099-01-01'});
  }
});
test('booking lookup is bound to the authenticated user and returns only minimal booking status',async()=>{
  const rows=new Map(),wanted=bookingRequestKey({user:{uid:'owner'},body:{bookingRequestId:'same'}});
  rows.set(wanted,{id:'owned',status:'PENDING'});
  const api=load('controllers/bookingResultController.js',{bookingRequestKey,prisma:{trip:{findUnique:async({where,select})=>{assert.deepEqual(Object.keys(select).sort(),['id','status']);return rows.get(where.bookingRequestKey) || null;}}}});
  const call=async(uid,requestId='same')=>{const res={code:200,status(c){this.code=c;return this;},json(body){this.body=body;return this;}};await api.getBookingResult({user:{uid},query:{requestId},body:{bookingRequestId:'spoofed'}},res);return res;};
  assert.equal((await call('owner')).body.trip.id,'owned');assert.equal((await call('other')).body.trip,null);assert.equal((await call('owner','x'.repeat(151))).code,400);
});

test('delayed Rider status jobs cannot announce an obsolete state or previous driver',async()=>{
  const trip={id:'trip',status:'ACCEPTED',isVerified:true,driverId:'first'};
  let current={...trip,status:'CANCELLED'};
  const api=load('services/notificationService.js',{isDeliveringNotification:()=>true,getTripRiderRecipientUserIds:async()=>assert.fail('obsolete state must not resolve recipients'),pkg:{PrismaClient:class{constructor(){return{trip:{findUnique:async()=>current}};}}}});
  for(const change of [{status:'CANCELLED'},{status:'ACCEPTED',driverId:'second'},{status:'ACCEPTED',driverId:'first',isVerified:false}]){
    current={...trip,...change};await api.sendTripStatusChangedToRider(trip);
  }
});
