import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import express from 'express';
import multer from 'multer';
import {createRequestRateLimit} from '../src/middleware/requestRateLimit.js';
import {parseTripTime} from '../src/utils/tripTime.js';
const require=createRequire(import.meta.url),ts=require('typescript');
const noop=async()=>{};
function load(relative,bindings){
 const source=readFileSync(new URL('../src/'+relative,import.meta.url),'utf8');
 const ast=ts.createSourceFile(relative,source,ts.ScriptTarget.Latest,true),modules={};
 for(const node of ast.statements)if(ts.isImportDeclaration(node)){
  const values=modules[node.moduleSpecifier.text] ||= {__esModule:true};
  const clause=node.importClause;
  if(clause?.name)values.default=bindings[clause.name.text] || {};
  if(clause?.namedBindings?.elements)for(const item of clause.namedBindings.elements)values[item.propertyName?.text || item.name.text]=bindings[item.name.text] || noop;
 }
 const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {exports,require:id=>{assert.ok(id in modules,id);return modules[id];},console:{log(){},error(){}},Date,URL,process:{env:{}},setInterval,clearInterval});
 return exports;
}
function auth(){return load('middleware/authMiddleware.js',{
 userSessions:{verify:async token=>{if(token==='rider')return{uid:'rider-id',appRole:'RIDER'};if(token==='driver')return{uid:'driver-id',appRole:'DRIVER'};throw Object.assign(Error('invalid'),{status:401});}},
 verifyAdminJwtToken:async token=>{if(token==='admin')return{id:1,role:'ADMIN'};throw Object.assign(Error('invalid'),{status:401});},
});}
async function withApp(router,path,run){
 const app=express();app.use(express.json());app.use(path,router);
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 try{await run('http://127.0.0.1:'+server.address().port+path);}finally{await new Promise(resolve=>server.close(resolve));}
}
function fileForm(scope){const form=new FormData();form.set('scope',scope);form.set('year','2099');form.set('quarter','1');form.set('file',new Blob(['offline'],{type:'image/png'}),'photo.png');return form;}
test('real multipart parsing cannot bypass private upload authorization or switch query/body scopes',async()=>{
 const uploaded=[];const controller=load('controllers/uploadController.js',{uploadToS3:async args=>{uploaded.push(args.folder);return{key:'offline-only'};}});
 const router=load('routes/upload.js',{Router:express.Router,...auth(),...controller,createRequestRateLimit,
  uploadAccountingDocument:multer({storage:multer.memoryStorage(),limits:{files:1,fileSize:1024}})}).default;
 await withApp(router,'/upload',async url=>{
  for(const scope of ['driver_document','accounting_document']){
   const response=await fetch(url,{method:'POST',body:fileForm(scope)});assert.equal(response.status,401);
  }
  const forbidden=await fetch(url,{method:'POST',headers:{Authorization:'Bearer rider'},body:fileForm('accounting_document')});assert.equal(forbidden.status,401);
  const mismatch=await fetch(url+'?scope=public_avatar',{method:'POST',body:fileForm('accounting_document')});assert.equal(mismatch.status,400);assert.equal(uploaded.length,0);
  const driver=await fetch(url,{method:'POST',headers:{Authorization:'Bearer driver'},body:fileForm('driver_document')});assert.equal(driver.status,200);assert.equal(uploaded[0],'driver-documents/driver-id');
  const admin=await fetch(url,{method:'POST',headers:{Authorization:'Bearer admin'},body:fileForm('accounting_document')});assert.equal(admin.status,200);assert.equal(uploaded[1],'accounting-documents/2099/Q1');
 });
});
test('ordinary tokens cannot register administrative push devices',async()=>{
 const stored=[];const db={user:{upsert:noop,findUnique:async()=>({primaryRole:'DRIVER',roles:[{role:'DRIVER'}]})},device:{upsert:async({create})=>{stored.push(create);return create;}}};
 const tokens={rider:{uid:'rider-id',appRole:'RIDER'},driver:{uid:'driver-id',appRole:'DRIVER'}};
 const router=load('routes/devices.js',{Router:express.Router,pkg:{PrismaClient:class{constructor(){return db;}}},
  userSessions:{verify:async token=>{if(tokens[token])return tokens[token];throw Object.assign(Error('invalid'),{status:401});}},pushSessionKey:()=> 'session',
  verifyAdminJwtToken:async token=>{if(token==='admin')return{id:1,role:'ADMIN'};throw Object.assign(Error('invalid'),{status:401});},
  recordRiderAppUsage:noop}).default;
 await withApp(router,'/devices',async url=>{
  const send=(token,role)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({platform:'ios',pushToken:'ExponentPushToken[offline]',role})});
  for(const role of ['admin','staff','DRIVER'])assert.equal((await send('rider',role)).status,403);
  assert.equal(stored.length,0);assert.equal((await send('rider','RIDER')).status,200);assert.equal(stored[0].role,'rider');
  assert.equal((await send('driver','DRIVER')).status,200);assert.equal(stored[1].role,'driver');
  assert.equal((await send('admin','ADMIN')).status,200);assert.equal(stored[2].role,'admin');
 });
});
test('actual booking route rejects anonymous requests; a valid session books repeatedly with zero new OTP requests',async()=>{
 let created=0,otpCalls=0;
 const pricing={totalPrice:1000000,basePricePerKm:10000};const route={distanceKm:100,driveMinutes:120,outboundDriveMinutes:120,returnDriveMinutes:0,estimatedDurationMinutes:120};
 const router=load('routes/trips.js',{Router:express.Router,pkg:{PrismaClient:class{}},...auth(),parseTripTime,
  createRequestRateLimit,requestOtp:async()=>{otpCalls++;},bookingRequestKey:()=>null,
  bookingQuotes:{booking:async()=>({pricing,route})},validateTripDistance:async()=>({ok:true}),getEffectiveTripConfig:async()=>({maxStops:10}),
  createBookableTrip:async(_,data)=>({...data,id:'trip-'+(++created)}),assertRegionalQuote(){},assertDestinationQuote(){},sendAdminPushNotification:noop,
 }).default;
 await withApp(router,'/trips',async url=>{
  const payload={pickupAddress:'A',dropoffAddress:'B',stops:['B'],distanceKm:100,pickupTime:'2099-01-01T08:00:00+07:00',direction:'ONE_WAY',carType:'CAR_5'};
  assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})).status,401);assert.equal(created,0);
  for(let i=0;i<10;i++){
   const result=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer rider'},body:JSON.stringify(payload)});
   assert.equal(result.status,201,await result.text());
  }
  assert.equal(created,10);assert.equal(otpCalls,0);
 });
});

test('Vietmap uses the final leg for return time and deduplicates repeated route calls',async()=>{
 const source=readFileSync(new URL('../src/services/mapService.js',import.meta.url),'utf8');
 const calls=[];
 const axios={get:async(url,options)=>{
  calls.push({url,options});assert.equal(options.timeout,8000);
  const count=options.params.getAll('point').length;
  return {data:{code:'OK',paths:[{distance:count===2?50000:200000,time:(count===2?60:240)*60000}]}};
 }};
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,require:id=>{assert.equal(id,'axios');return{__esModule:true,default:axios};},
  process:{env:{MAP_PROVIDER:'vietmap',VIETMAP_API_KEY:'offline-placeholder'}},URLSearchParams,structuredClone,console,Date,Map,Promise});
 const points=[{lat:10,lng:106},{lat:11,lng:107},{lat:12,lng:108},{lat:10,lng:106}];
 const [first,second]=await Promise.all([exports.getRoute(points),exports.getRoute(points)]);
 assert.equal(first.outboundDurationMinutes,180);assert.equal(first.returnDurationMinutes,60);assert.equal(calls.length,2);
 first.distanceKm=1;assert.equal(second.distanceKm,200);assert.equal((await exports.getRoute(points)).distanceKm,200);assert.equal(calls.length,2);
 await assert.rejects(exports.getRoute([{lat:100,lng:0},{lat:0,lng:0}]),/COORDINATES_INVALID/);
});
