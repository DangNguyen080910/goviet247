import {createCallApns,callUuid} from './tripCallApns.js';
export function androidCallInvite(invite,now=Date.now()) {
 const {token,callId,callerLabel,createdAt}=invite;
 if(typeof token!=='string'|| !/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{8,200}\]$/.test(token))throw Object.assign(new Error('Invalid call device'),{code:'CALL_DEVICE'});
 if(typeof callId!=='string'|| !/^[A-Za-z0-9_-]{1,100}$/.test(callId))throw Object.assign(new Error('Invalid call ID'),{code:'CALL_DEVICE'});
 const expiry=new Date(createdAt).getTime()+45000;
 if(!Number.isFinite(expiry)||expiry<=now||expiry>now+50000)throw Object.assign(new Error('Expired call'),{code:'CALL_INVITE_EXPIRED'});
 return {to:token,priority:'high',ttl:Math.max(1,Math.ceil((expiry-now)/1000)),_contentAvailable:true,
  data:{type:'TRIP_CALL',callId,callUUID:callUuid(callId),callerName:['Tài xế','Hành khách','Điều phối viên'].includes(callerLabel)?callerLabel:'Cuộc gọi GoViet247',expiresAt:expiry,hasVideo:false}};
}
export function createCallPush(env=process.env,{fetchImpl=fetch,createApns=createCallApns}={}) {
 let apns;
 return {async send(invite){
  if(invite.environment!=='android-expo')return (apns ||= createApns(env)).send(invite);
  const body=androidCallInvite(invite);
  const response=await fetchImpl('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json',...(env.EXPO_ACCESS_TOKEN?{Authorization:`Bearer ${env.EXPO_ACCESS_TOKEN}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
  const result=await response.json(),ticket=Array.isArray(result.data)?result.data[0]:result.data;
  if(!response.ok||result.errors?.length)return {accepted:false,status:response.status,permanent:false};
  if(ticket?.status==='ok'&&typeof ticket.id==='string')return {accepted:true};
  return {accepted:false,status:400,permanent:ticket?.details?.error==='DeviceNotRegistered'};
 }};
}
