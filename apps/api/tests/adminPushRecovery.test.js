import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import express from 'express';
import jwt from 'jsonwebtoken';
import {activeAdminDevices} from '../src/services/adminPushAccess.js';
import {adminTokenVersion,createAdminSessionVerifier} from '../src/services/adminSessions.js';
import {createNotificationOutbox,isDeliveringNotification} from '../src/services/notificationOutbox.js';
const ts=createRequire(import.meta.url)('typescript'),noop=async()=>{},quiet={log(){},error(){}};
function load(path,bindings){
  const source=readFileSync(new URL('../src/'+path,import.meta.url),'utf8'),ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true),modules={};
  for(const n of ast.statements)if(ts.isImportDeclaration(n)){
    const values=modules[n.moduleSpecifier.text] ||= {__esModule:true},c=n.importClause;
    if(c?.name)values.default=bindings[c.name.text] || {};
    if(c?.namedBindings?.elements)for(const i of c.namedBindings.elements)values[i.propertyName?.text || i.name.text]=bindings[i.name.text] || noop;
  }
  const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>modules[id],console:quiet,Date,Map,process:{env:{}}});return exports;
}
test('Store-style registration restores missing Admin expiry from the signed JWT without logout or client-supplied metadata',async()=>{
  const admin={id:7,username:'offline',role:'ADMIN',is_active:true,password_hash:'offline-hash',authVersion:1};
  const token=jwt.sign({id:7,role:'ADMIN',av:adminTokenVersion(admin)},'offline-test-secret',{expiresIn:'1h'}),claims=jwt.decode(token);
  let device={userId:'admin-7',role:'admin',adminAuthVersion:claims.av,pushExpiresAt:null,pushToken:'ExpoPushToken[offline]'},wakes=0;
  const db={admin_users:{findUnique:async()=>admin,findMany:async()=>[admin]},user:{upsert:noop},device:{upsert:async({update})=>(device={...device,...update})}};
  assert.equal((await activeAdminDevices(db,[device])).length,0,'legacy null expiry reproduces the loss');
  const verify=createAdminSessionVerifier(db,t=>jwt.verify(t,'offline-test-secret'));
  const router=load('routes/devices.js',{Router:express.Router,pkg:{PrismaClient:class{constructor(){return db;}}},
    userSessions:{verify:async()=>{throw Object.assign(Error('not a user token'),{status:401});}},verifyAdminJwtToken:verify,wakeUnsentAdminTripPush:async()=>wakes++}).default;
  const app=express();app.use(express.json());app.use('/devices',router);
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  try{
    const response=await fetch('http://127.0.0.1:'+server.address().port+'/devices',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({platform:'ios',pushToken:device.pushToken,role:'ADMIN',pushExpiresAt:'2099-01-01'})});
    assert.equal(response.status,200,await response.text());assert.equal(device.pushExpiresAt.getTime(),claims.exp*1000);
    assert.equal(device.adminAuthVersion,claims.av);assert.equal((await activeAdminDevices(db,[device])).length,1);assert.equal(wakes,1);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test('Admin jobs without eligible devices are retryable, not reported as delivered',async()=>{
  let devices=[];
  const db={device:{findMany:async()=>devices}};
  const api=load('services/notificationService.js',{isDeliveringNotification:()=>true,activeAdminDevices:async()=>[],pkg:{PrismaClient:class{constructor(){return db;}}}});
  for(const rows of [[],[{userId:'admin-7',pushExpiresAt:null}]]){
    devices=rows;await assert.rejects(api.sendAdminPushNotification({title:'Offline'}),{code:'ADMIN_PUSH_NO_ACTIVE_DEVICE'});
  }
  const writes=[];const queue=createNotificationOutbox({logger:quiet,db:{$queryRawUnsafe:async()=>[{id:'job',kind:'sendAdminPushNotification',payload:[{title:'Offline'}],attempts:1,lockToken:'offline'}],$executeRawUnsafe:async(...args)=>{writes.push(args);return 1;}}});
  await queue.drain((_,args)=>api.sendAdminPushNotification(...args));
  assert.ok(writes.some(([sql,,code])=>sql.includes('"runAt"=now()')&&code==='ADMIN_PUSH_NO_ACTIVE_DEVICE'));
  assert.equal(writes.some(([sql])=>sql.includes('"completedAt"=now()')),false);
});
test('recovered new-trip alerts are discarded after Admin has already reviewed/cancelled the trip',async()=>{
  const api=load('services/notificationService.js',{isDeliveringNotification:()=>true,pkg:{PrismaClient:class{constructor(){return{trip:{findUnique:async()=>({status:'PENDING',isVerified:true})},device:{findMany:async()=>assert.fail('obsolete alert')}};}}}});
  await api.sendAdminPushNotification({data:{source:'create_trip',tripId:'already-reviewed'}});
});
