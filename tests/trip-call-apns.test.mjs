import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readCallApnsConfig,callInviteRequest,callUuid,sendApnsRequest,createCallApns} from '../apps/api/src/services/tripCallApns.js';
const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'P-256'});
const pem=privateKey.export({type:'pkcs8',format:'pem'}),folder=mkdtempSync(join(tmpdir(),'goviet-apns-test-')),path=join(folder,'test.p8');writeFileSync(path,pem,{mode:0o600});
after(()=>rmSync(folder,{recursive:true,force:true}));
const env={TRIP_CALL_APNS_KEY_ID:'ABCDEFGHIJ',TRIP_CALL_APNS_TEAM_ID:'1234567890',TRIP_CALL_APNS_KEY_PATH:path};
const config=readCallApnsConfig(env),now=Date.now(),invite={token:'a'.repeat(64),appKind:'DRIVER',environment:'production',callId:'call_test_1',callerLabel:'Hành khách',createdAt:new Date(now)};
test('APNs config validates signing key and identity without depending on upload AWS keys',()=>{
 assert.equal(config.key.asymmetricKeyType,'ec');assert.throws(()=>readCallApnsConfig({...env,TRIP_CALL_APNS_KEY_ID:''}));assert.throws(()=>readCallApnsConfig({...env,TRIP_CALL_APNS_KEY_PATH:'relative.p8'}));
 const rsa=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'});assert.throws(()=>readCallApnsConfig(env,()=>rsa));
});
test('JWT is a valid ES256/P1363 signature with correct team/key, not the private key',()=>{
 const r=callInviteRequest(config,invite,now),jwt=r.headers.authorization.slice(7),[header,payload,sig]=jwt.split('.');
 assert.deepEqual(JSON.parse(Buffer.from(header,'base64url')),{alg:'ES256',kid:'ABCDEFGHIJ'});
 assert.deepEqual(JSON.parse(Buffer.from(payload,'base64url')),{iss:'1234567890',iat:Math.floor(now/1000)});
 assert.equal(Buffer.from(sig,'base64url').length,64);
 assert.equal(verify('sha256',Buffer.from(header+'.'+payload),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(sig,'base64url')),true);
 assert.equal(JSON.stringify(r).includes('PRIVATE KEY'),false);
});
for(const [appKind,bundle] of [['DRIVER','driver'],['RIDER','rider']])test(`VoIP topic is app-specific: ${appKind}`,()=>{
 const r=callInviteRequest(config,{...invite,appKind},now);assert.equal(r.headers['apns-topic'],`com.goviet247.${bundle}.voip`);assert.equal(r.headers['apns-push-type'],'voip');assert.equal(r.headers['apns-priority'],'10');assert.equal(r.headers['apns-expiration'],String(Math.floor((now+45000)/1000)));
 const body=JSON.parse(r.body);assert.equal(body.hasVideo,false);assert.equal(body.type,'TRIP_CALL');assert.ok(body.recordingNotice);assert.equal('joinToken' in body,false);
});
test('sandbox and production stay separate',()=>{
 assert.equal(callInviteRequest(config,{...invite,environment:'sandbox'},now).origin,'https://api.sandbox.push.apple.com');assert.equal(callInviteRequest(config,invite,now).origin,'https://api.push.apple.com');
});
for(const bad of [{appKind:'ADMIN'},{environment:'other'},{token:'ExpoPushToken[abc]'},{token:'bad/path'},{callId:'../../file'}])test('rejects invalid destination '+JSON.stringify(bad),()=>assert.throws(()=>callInviteRequest(config,{...invite,...bad},now)));
test('expired or future invitations never produce a push request',()=>{
 for(const createdAt of [new Date(now-45001),new Date(now+10000),'bad'])assert.throws(()=>callInviteRequest(config,{...invite,createdAt},now),e=>e.code==='CALL_INVITE_EXPIRED');
});
test('call UUID is stable across retries and devices and changes for another call',()=>{
 const uuid=callUuid('call-1');assert.match(uuid,/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);assert.equal(uuid,callUuid('call-1'));assert.notEqual(uuid,callUuid('call-2'));
});
function transport(status,reason,{hang=false,error=false,tooLarge=false}={}) {
 const client=new EventEmitter(),stream=new EventEmitter();let closed=0,destroyed=0;
 stream.setEncoding=()=>{};stream.close=()=>{closed++;};client.close=()=>{};client.destroy=()=>{destroyed++;};
 stream.end=()=>queueMicrotask(()=>{if(error)return stream.emit('error',new Error('secret-token-must-not-leak'));if(hang)return;stream.emit('response',{':status':status});stream.emit('data',tooLarge?'x'.repeat(9000):JSON.stringify(reason?{reason}:{}));stream.emit('end');});
 client.request=()=>stream;
 return {open:()=>client,get closed(){return closed;},get destroyed(){return destroyed;}};
}
test('successful HTTP/2 push is accepted and resources close',async()=>{
 const t=transport(200);assert.deepEqual(await sendApnsRequest(callInviteRequest(config,invite,now),t),{accepted:true});assert.equal(t.closed,1);assert.equal(t.destroyed,1);
});
for(const [status,reason,permanent] of [[410,'Unregistered',true],[400,'BadDeviceToken',true],[400,'DeviceTokenNotForTopic',true],[403,'InvalidProviderToken',false],[429,'TooManyRequests',false],[503,'ServiceUnavailable',false]])test(`APNs ${status} ${reason} is classified without deleting valid keys`,async()=>{
 const result=await sendApnsRequest(callInviteRequest(config,invite,now),transport(status,reason));assert.equal(result.accepted,false);assert.equal(result.permanent,permanent);assert.equal(result.status,status);
});
test('timeouts and stream errors are sanitized and close sockets',async()=>{
 for(const opts of [{hang:true},{error:true},{tooLarge:true}]){
  const t=transport(200,null,opts);await assert.rejects(sendApnsRequest(callInviteRequest(config,invite,now),{...t,timeoutMs:5}),e=>!e.message.includes('secret-token'));
  assert.equal(t.destroyed,1);
 }
});
test('factory reuses provider JWT across deliveries',async()=>{
 const requests=[],sender=createCallApns(env,async r=>{requests.push(r);return {accepted:true};});
 await sender.send({...invite,createdAt:new Date()});await sender.send({...invite,token:'b'.repeat(64),createdAt:new Date()});assert.equal(requests[0].headers.authorization,requests[1].headers.authorization);
});
