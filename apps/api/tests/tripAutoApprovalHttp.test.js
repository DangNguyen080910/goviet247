import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import express from 'express';
import {createTripAutoApprovalConfigController} from '../src/controllers/tripAutoApprovalConfigController.js';

const middleware=readFileSync(new URL('../src/middleware/authMiddleware.js',import.meta.url),'utf8');
const adminSource=middleware.slice(middleware.indexOf('export async function requireAdmin('),middleware.indexOf('// ✅ Middleware cho ADMIN hoặc STAFF')).replace('export ','');
const requireAdmin=new Function('verifyAdminJwtToken',adminSource+';return requireAdmin;')(async token=>{
 if(token==='admin')return{id:1,role:'ADMIN'};
 if(token==='staff')return{id:2,role:'STAFF'};
 throw Object.assign(Error('revoked'),{status:401});
});
const source=readFileSync(new URL('../src/routes/admin.js',import.meta.url),'utf8').split('\n').filter(line=>line.startsWith('router.') && line.includes('"/trip-config/auto-approval"')).join('\n');
test('real settings routes require Admin, reject Staff and revoked sessions, and apply one toggle with CAS',async()=>{
 let config={id:1,autoApproveNewTrips:false,autoApproveRequeuedTrips:false,updatedAt:new Date('2099-01-01T00:00:00Z')};
 const db={tripConfig:{findFirst:async()=>config,update:async({where,data})=>{assert.equal(where.updatedAt,config.updatedAt);config={...config,...data,updatedAt:new Date(config.updatedAt.getTime()+1)};return config;}}};
 const app=express(),router=express.Router();app.use(express.json());
 new Function('router','requireAdmin','tripAutoApprovalConfig',source)(router,requireAdmin,createTripAutoApprovalConfigController(db));app.use('/api/admin',router);
 const server=await new Promise(resolve=>{const value=app.listen(0,'127.0.0.1',()=>resolve(value));});
 try{
  const endpoint=`http://127.0.0.1:${server.address().port}/api/admin/trip-config/auto-approval`;
  for(const method of ['GET','PATCH'])for(const [token,code] of [['',401],['staff',403],['revoked',401]]){
   const response=await fetch(endpoint,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(method==='PATCH'?{body:JSON.stringify({autoApproveNewTrips:true,expectedUpdatedAt:config.updatedAt.toISOString()})}:{})});assert.equal(response.status,code);assert.equal(config.autoApproveNewTrips,false);
  }
  const before=await fetch(endpoint,{headers:{Authorization:'Bearer admin'}}).then(response=>response.json());assert.equal(before.item.autoApproveNewTrips,false);
  const response=await fetch(endpoint,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer admin'},body:JSON.stringify({autoApproveNewTrips:true,expectedUpdatedAt:before.item.updatedAt})});assert.equal(response.status,200);const after=await response.json();assert.equal(after.item.autoApproveNewTrips,true);assert.equal(after.item.autoApproveRequeuedTrips,false);
  const stale=await fetch(endpoint,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer admin'},body:JSON.stringify({autoApproveRequeuedTrips:true,expectedUpdatedAt:before.item.updatedAt})});assert.equal(stale.status,409);assert.equal(config.autoApproveRequeuedTrips,false);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
