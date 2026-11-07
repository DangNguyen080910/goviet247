import {readFileSync} from 'node:fs';
import {createPrivateKey,sign,randomUUID,createHash} from 'node:crypto';
import {connect} from 'node:http2';
const APPS={DRIVER:'com.goviet247.driver',RIDER:'com.goviet247.rider'};
const invalid=message=>Object.assign(new Error(message),{status:503,code:'CALL_APNS_CONFIG'});
export function readCallApnsConfig(env=process.env,read=readFileSync) {
 const keyId=env.TRIP_CALL_APNS_KEY_ID,teamId=env.TRIP_CALL_APNS_TEAM_ID,keyPath=env.TRIP_CALL_APNS_KEY_PATH;
 if(!/^[A-Z0-9]{10}$/.test(keyId || '')|| !/^[A-Z0-9]{10}$/.test(teamId || '')|| !keyPath?.startsWith('/'))throw invalid('Chưa cấu hình khóa APNs cho cuộc gọi.');
 const key=createPrivateKey(read(keyPath));
 if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw invalid('Khóa APNs phải là EC P-256.');
 return {keyId,teamId,key};
}
export function callUuid(id) {
 const value=createHash('sha256').update('goviet247-call:'+id).digest('hex');
 return `${value.slice(0,8)}-${value.slice(8,12)}-5${value.slice(13,16)}-a${value.slice(17,20)}-${value.slice(20,32)}`;
}
function apnsAuthToken(config,now) {
 const encoded=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const data=encoded({alg:'ES256',kid:config.keyId})+'.'+encoded({iss:config.teamId,iat:Math.floor(now/1000)});
 return data+'.'+sign('sha256',Buffer.from(data),{key:config.key,dsaEncoding:'ieee-p1363'}).toString('base64url');
}
export function callInviteRequest(config,{token,appKind,environment,callId,callerLabel,createdAt},now=Date.now(),jwt=apnsAuthToken(config,now)) {
 if(typeof token!=='string'|| !/^[0-9a-f]{64,256}$/i.test(token)||!APPS[appKind]||!['sandbox','production'].includes(environment))throw invalid('Thiết bị nhận cuộc gọi không hợp lệ.');
 const created=new Date(createdAt).getTime(),expiry=Math.floor((created+45000)/1000);
 if(!Number.isFinite(created)||created>now+5000||created+45000<=now)throw Object.assign(new Error('Cuộc gọi đã hết thời gian chờ.'),{code:'CALL_INVITE_EXPIRED'});
 if(typeof callId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(callId))throw invalid('Mã cuộc gọi không hợp lệ.');

 return {origin:environment==='production'?'https://api.push.apple.com':'https://api.sandbox.push.apple.com',
  headers:{':method':'POST',':path':`/3/device/${token}`,authorization:`bearer ${jwt}`,'apns-id':randomUUID(),'apns-topic':`${APPS[appKind]}.voip`,'apns-push-type':'voip','apns-priority':'10','apns-expiration':String(expiry),'content-type':'application/json'},
  body:JSON.stringify({aps:{},type:'TRIP_CALL',callId,callUUID:callUuid(callId),callerName:['Tài xế','Hành khách','Điều phối viên'].includes(callerLabel)?callerLabel:'Cuộc gọi GoViet247',hasVideo:false,expiresAt:expiry*1000,
   recordingNotice:'Cuộc gọi được ghi âm để GoViet247 hỗ trợ và xử lý phản ánh. Chỉ bộ phận quản trị được nghe lại.'})};
}
// Short-lived connections avoid leaking sockets and never log authorization or device tokens.
export function sendApnsRequest(request,{open=connect,timeoutMs=8000}={}) {
 return new Promise((resolve,reject)=>{
  let client,stream,timer,done=false,status=0,body='';
  const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);stream?.close();client?.close();client?.destroy();error?reject(error):resolve(value);};
  try {
   client=open(request.origin);
   timer=setTimeout(()=>finish(Object.assign(new Error('APNs timeout'),{code:'APNS_TIMEOUT'})),timeoutMs);
   client.on('error',()=>finish(Object.assign(new Error('APNs connection failed'),{code:'APNS_CONNECTION'})));
   stream=client.request(request.headers);
   stream.on('response',headers=>{status=Number(headers[':status']);});
   stream.setEncoding('utf8');
   stream.on('data',chunk=>{body+=chunk;if(body.length>8192)finish(new Error('APNs response too large'));});
   stream.on('error',()=>finish(Object.assign(new Error('APNs request failed'),{code:'APNS_REQUEST'})));
   stream.on('end',()=>{
    let reason;try{reason=JSON.parse(body).reason;}catch{}
    if(status===200)return finish(null,{accepted:true});
    const permanent=status===410||status===400&&['BadDeviceToken','DeviceTokenNotForTopic','Unregistered'].includes(reason);
    finish(null,{accepted:false,status,permanent,reason:typeof reason==='string'?reason.slice(0,80):'APNS_ERROR'});
   });
   stream.end(request.body);
  }catch {finish(Object.assign(new Error('APNs request could not be created'),{code:'APNS_REQUEST'}));}
 });
}
export function createCallApns(env=process.env,transport=sendApnsRequest) {
 const config=readCallApnsConfig(env);
 let token,issuedAt=0;
 return {send:invite=>{
  const now=Date.now();
  if(!token || now-issuedAt>20*60000 || now<issuedAt){token=apnsAuthToken(config,now);issuedAt=now;}
  return transport(callInviteRequest(config,invite,now,token));
 }};
}
