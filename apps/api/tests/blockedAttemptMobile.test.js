import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
function service({blocked=true}={}) {
  const events=[], pushes=[], logs=[];
  const prisma={
    driverProfile:{findUnique:async()=>({id:'profile1',fullName:'Tài xế A',tripAcceptBlocked:blocked,user:{displayName:'A'}})},
    trip:{findUnique:async()=>({id:'trip1',status:'PENDING',driverId:null,isVerified:true,verifiedAt:new Date(),cancelledAt:null,audienceDriverIds:[]})},
    adminAlertLog:{findFirst:async()=>null,create:async({data})=>{logs.push(data);return {id:'alert1',sentAt:new Date(),...data};}},
  };
  const source=readFileSync(new URL('../src/services/blockedTripAttemptNotification.js',import.meta.url),'utf8').replace(/^import.*;\n/gm,'').replace('export async function','async function');
  const notify=new Function('prisma','canDriverSeeTrip','sendAdminPushNotification',source+'; return notifyBlockedTripAttempt;')(prisma,()=>true,async body=>pushes.push(body));
  const io={to:room=>({emit:(event,payload)=>events.push({room,event,payload})})};
  return {notify,io,events,pushes,logs};
}
test('blocked driver attempt creates shared history, admin realtime and a mobile push without unlocking',async()=>{
  const f=service();
  await f.notify({io:f.io,driverId:'driver1',tripId:'trip1'});
  assert.equal(f.logs[0].alertType,'BLOCKED_TRIP_ACCEPT_ATTEMPT');
  assert.equal(f.events[0].room,'admins');assert.equal(f.events[0].payload.driverProfileId,'profile1');
  assert.equal(f.pushes[0].data.type,'BLOCKED_TRIP_ACCEPT_ATTEMPT');assert.equal(f.pushes[0].data.driverProfileId,'profile1');
  await f.notify({io:f.io,driverId:'driver1',tripId:'trip1'});
  assert.equal(f.pushes.length,1,'cooldown must prevent repeated notifications');
});
test('unblocked drivers do not produce blocked-attempt alerts',async()=>{
  const f=service({blocked:false});await f.notify({io:f.io,driverId:'driver1',tripId:'trip1'});
  assert.equal(f.logs.length,0);assert.equal(f.pushes.length,0);
});
test('mobile history extracts only a blocked-attempt profile link',()=>{
  const source=readFileSync(new URL('../../admin-mobile/services/adminAlertsApi.ts',import.meta.url),'utf8');
  const start=source.indexOf('export function blockedAlertDriverId');
  const parse=new Function(source.slice(start).replace('export function','function').replace('alert:AdminAlert','alert')+';return blockedAlertDriverId;')();
  assert.equal(parse({alertType:'BLOCKED_TRIP_ACCEPT_ATTEMPT',message:'A (mã tài xế: cmv123abc) đang bị khoá'}),'cmv123abc');
  assert.equal(parse({alertType:'TRIP_MILESTONE',message:'(mã tài xế: cmv123abc)'}),null);
  assert.equal(parse({alertType:'BLOCKED_TRIP_ACCEPT_ATTEMPT',message:'Không có mã'}),null);
});
