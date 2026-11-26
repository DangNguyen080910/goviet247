import { notificationFeed, driverNotificationScope } from "../apps/api/src/services/notificationPreferences.js";
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {chatNotificationRoute} from '../apps/api/src/shared/chatNotificationNavigation.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('logout removes every device bound to this account/session without removing other sessions',async()=>{
 const source=read('apps/api/src/routes/auth.js');
 const body=source.split('router.post("/logout", verifyToken, ')[1].split('\n});')[0]+'\n}';
 const devices=[{userId:'u',pushSessionId:'current',role:'rider'},{userId:'u',pushSessionId:'current',role:'driver'},{userId:'u',pushSessionId:'other',role:'rider'},{userId:'other',pushSessionId:'current',role:'rider'}];let revoked=false;
 const prisma={device:{deleteMany:async({where})=>{assert.equal(where.role,undefined);for(let i=devices.length-1;i>=0;i--)if(devices[i].userId===where.userId&&devices[i].pushSessionId===where.pushSessionId)devices.splice(i,1);}}};
 const handler=new Function('userSessions','prisma','pushSessionKey',`return (${body});`)({revoke:async()=>{revoked=true;}},prisma,()=> 'current');
 let result;await handler({user:{id:'u'},authToken:'token',app:{get:()=>null}},{json:x=>result=x});
 assert(revoked);assert(result.success);assert.equal(devices.length,2);assert(devices.every(d=>d.userId!=='u'||d.pushSessionId!=='current'));
});
const navSource=ts.transpileModule(read('apps/admin-mobile/services/adminNotificationNavigation.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};new Function('require','exports',navSource)(()=>({chatNotificationRoute}),exports);
test('two deliberate taps on the same trip carry different focus requests',()=>{
 const data={type:'ADMIN_TRIP_STATUS_CHANGED',tripId:'trip/a',status:'ACCEPTED'};
 const first=new URL(exports.getAdminNotificationRoute(data),'https://local.test');
 const second=new URL(exports.getAdminNotificationRoute(data),'https://local.test');
 assert.equal(first.pathname,'/assigned-trips');assert.equal(first.searchParams.get('tripId'),'trip/a');
 assert.notEqual(first.searchParams.get('focusRequest'),second.searchParams.get('focusRequest'));
 const pending=new URL(exports.getAdminNotificationRoute({...data,status:'PENDING'}),'https://local.test');assert.equal(pending.pathname,'/pending-trips');
});
const driverSource=read('apps/api/src/controllers/driverNotificationController.js').replace(/^import.*;$/gm,'').replace(/export (?=(?:async )?function)/g,'');
function matchNotice(value, where) {
 return Object.entries(where).every(([key, cond]) => {
   if (key === 'AND') return cond.every(child => matchNotice(value, child));
   if (key === 'OR') return cond.some(child => matchNotice(value, child));
   if (cond?.some) return (value[key] || []).some(child => matchNotice(child, cond.some));
   if (cond?.none) return !(value[key] || []).some(child => matchNotice(child, cond.none));
   return value[key] === cond;
 });
}
async function targetNotification(id,user='u'){
 const data=Array.from({length:70},(_,i)=>({id:String(i),audience:'DRIVER',isActive:true,targetType:'USER',targetUserId:i===0?'other':'u',reads:[]}));
 const prisma={systemNotification:{findMany:async({where,take})=>data.filter(n=>matchNotice(n,where)).slice(0,take ?? data.length)}};
 const handler=new Function('prisma','notificationFeed','driverNotificationScope',driverSource+';return getMyDriverNotifications;')(prisma,notificationFeed,driverNotificationScope);let result;
 await handler({user:{id:user},query:{notificationId:id}},{json:x=>result=x});return result.items;
}
test('an old notification opens by exact ID beyond the newest fifty',async()=>{assert.deepEqual((await targetNotification('69')).map(n=>n.id),['69']);});
test('notification target cannot bypass account scope',async()=>{assert.deepEqual(await targetNotification('0'),[]);});

test('auto-approved notification opens the unassigned trip, and follows a later accepted status',()=>{
 const data={type:'ADMIN_TRIP_STATUS_CHANGED',source:'auto_verify_trip',tripId:'auto/trip',status:'PENDING',isVerified:true};
 const pending=new URL(exports.getAdminNotificationRoute(data),'https://local.test');assert.equal(pending.pathname,'/unassigned-trips');assert.equal(pending.searchParams.get('tripId'),'auto/trip');
 const accepted=new URL(exports.getAdminNotificationRoute({...data,status:'ACCEPTED'}),'https://local.test');assert.equal(accepted.pathname,'/assigned-trips');assert.equal(accepted.searchParams.get('tripId'),'auto/trip');
 const review=new URL(exports.getAdminNotificationRoute({type:'ADMIN_NEW_TRIP',source:'create_trip',tripId:'auto/trip',status:'PENDING'}),'https://local.test');assert.equal(review.pathname,'/pending-trips');
});
