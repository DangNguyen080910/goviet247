import {activeDriverDevices} from './driverPushAccess.js';
import {callError,validCallDevice,tripCallParties} from './tripCallPolicy.js';
import {randomUUID} from 'node:crypto';
const kinds=['DRIVER','RIDER'];
export async function registerCallDevice(db,actor,session,body) {
 if(actor.role==='ADMIN'||actor.memberId||!session?.id)throw callError('Thiết bị gọi cần phiên đăng nhập app khách hoặc tài xế.');
 const installationId=validCallDevice(body.deviceId),{appKind,token,environment}=body;
 const validToken=typeof token==='string' && (environment==='android-expo'?/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{8,200}\]$/.test(token):/^[0-9a-f]{64,256}$/i.test(token));
 if(!kinds.includes(appKind)||!['sandbox','production','android-expo'].includes(environment)||!validToken)throw callError('Thông tin thiết bị gọi không hợp lệ.',400);
 if(session.appRole && session.appRole!==appKind)throw callError('Phiên đăng nhập không thuộc ứng dụng này.');
 if(appKind==='DRIVER'){
  const profile=await db.driverProfile.findUnique({where:{userId:actor.id},select:{status:true}});
  if(profile?.status!=='VERIFIED')throw callError('Tài xế chưa được xác minh.');
 }
 return db.$transaction(async tx=>{
  const count=await tx.tripCallDevice.count({where:{userId:actor.id}});
  const existing=await tx.tripCallDevice.findUnique({where:{installationId_appKind:{installationId,appKind}}});
  if(count>=10 && !existing)throw callError('Tài khoản đã đăng ký quá nhiều thiết bị gọi.',429);
  // A refreshed token has a new delivery generation; queued invites for older sessions cannot be sent.
  const data={userId:actor.id,token:environment==='android-expo'?token:token.toLowerCase(),environment,pushSessionId:session.id,pushExpiresAt:session.expiresAt,generation:existing && existing.userId===actor.id && existing.pushSessionId===session.id && existing.token===(environment==='android-expo'?token:token.toLowerCase()) && existing.environment===environment ? existing.generation : randomUUID(),lastRegisteredAt:new Date()};
  // APNs can reissue the same token after reinstall: move its binding to this installation.
  await tx.tripCallDevice.deleteMany({where:{token:data.token,appKind,environment,installationId:{not:installationId}}});
  await tx.tripCallDevice.upsert({where:{installationId_appKind:{installationId,appKind}},create:{...data,installationId,appKind},update:data});
  return {success:true};
 });
}
export async function unregisterCallDevice(db,actor,session,deviceId) {
 validCallDevice(deviceId);
 if(!session?.id)throw callError('Phiên đăng nhập không hợp lệ.');
 await db.tripCallDevice.deleteMany({where:{installationId:deviceId,userId:actor.id,pushSessionId:session.id}});
 return {success:true};
}
export async function eligibleCallDevices(db,call,devices) {
 const matching=devices.filter(d=>d.appKind===(call.calleeId.startsWith('partner-') || call.calleeLabel==='Hành khách'?'RIDER':'DRIVER') && call.calleeAliases.includes(d.userId));
 return activeDriverDevices(db,matching);
}
export async function deliverCallInvites(db,apns,{now=()=>Date.now()}={}) {
 const calls=[];
 let cursor=null;
 for(;;){
  const page=await db.tripCall.findMany({where:{status:'RINGING',createdAt:{gte:new Date(now()-45000)},...(cursor?{id:{gt:cursor}}:{})},orderBy:{id:'asc'},take:50});
  calls.push(...page);
  if(page.length<50)break;
  cursor=page[page.length-1].id;
 }
 const pending=[];
 for(const call of calls) {
  const devices=await eligibleCallDevices(db,call,await db.tripCallDevice.findMany({where:{userId:{in:call.calleeAliases}}}));
  pending.push(...devices.map(device=>({call,device})));
 }
 async function deliver(call,device) {
   // This durable outbox is tied to both installation and authenticated registration generation.
   const key={callId:call.id,deviceId:device.id,generation:device.generation};
   const delivery=await db.tripCallInvite.upsert({where:{callId_deviceId_generation:key},create:key,update:{}});
   if(delivery.sentAt || delivery.attempts>=3 || delivery.attemptAt && now()-delivery.attemptAt.getTime()<10000)return;
   const claimed=await db.tripCallInvite.updateMany({where:{id:delivery.id,attempts:delivery.attempts,sentAt:null},data:{attempts:{increment:1},attemptAt:new Date(now())}});
   if(!claimed.count)return;
   try {
    const current=await db.tripCall.findUnique({where:{id:call.id}}),fresh=await db.tripCallDevice.findUnique({where:{id:device.id}});
    if(!current||current.status!=='RINGING'||now()-current.createdAt.getTime()>=45000||!fresh||fresh.generation!==device.generation||!(await eligibleCallDevices(db,current,[fresh])).length)return;
    const trip=await db.trip.findUnique({where:{id:current.tripId}}),parties=await tripCallParties(db,trip);
    if(![parties.driver.id,parties.receiver.id].every(id=>[current.callerId,current.calleeId].includes(id)))return;
    const recipient=parties.driver.id===current.calleeId?parties.driver:parties.receiver;
    if(!recipient.aliases.includes(fresh.userId))return;
    const result=await apns.send({token:fresh.token,appKind:fresh.appKind,environment:fresh.environment,callId:call.id,callerLabel:call.callerLabel,createdAt:call.createdAt});
    if(result.accepted)await db.tripCallInvite.update({where:{id:delivery.id},data:{sentAt:new Date(now()),lastError:null}});
    else {
     await db.tripCallInvite.update({where:{id:delivery.id},data:{lastError:`${fresh.environment==='android-expo'?'EXPO':'APNS'}_${result.status}`}});
     if(result.permanent)await db.tripCallDevice.deleteMany({where:{id:fresh.id,generation:fresh.generation}});
    }
   } catch(e) {
    await db.tripCallInvite.update({where:{id:delivery.id},data:{lastError:['APNS_TIMEOUT','APNS_CONNECTION','APNS_REQUEST','CALL_INVITE_EXPIRED'].includes(e.code)?e.code:'APNS_DELIVERY_ERROR'}});
   }
 }
 await Promise.all(Array.from({length:Math.min(8,pending.length)},async()=>{
  while(pending.length){const item=pending.shift();try{await deliver(item.call,item.device);}catch(e){console.error('[TripCall] invite pending',e.name);}}
 }));
}
