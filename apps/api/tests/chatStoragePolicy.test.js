import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {S3Client} from '@aws-sdk/client-s3';
import {hasPrivateChatPrefixPolicy} from '../src/shared/chatStoragePolicy.js';
import {privateAudioBucket} from '../src/services/tripChatService.js';
const bucket='goviet247-prod',account='122610490382';
const policy=JSON.parse(fs.readFileSync(new URL('../../../docs/goviet247-prod-chat-bucket-policy.json',import.meta.url),'utf8'));
test('shared bucket policy preserves both existing public prefixes and denies other-account/anonymous chat access',()=>{
 assert.equal(policy.Statement.length,3);
 assert.deepEqual(policy.Statement.slice(0,2).map(s=>s.Resource),[`arn:aws:s3:::${bucket}/public/*`,`arn:aws:s3:::${bucket}/system-config/*`]);
 assert.equal(hasPrivateChatPrefixPolicy(JSON.stringify(policy),bucket,account),true);
 const deny=policy.Statement[2];assert.equal(deny.Resource,`arn:aws:s3:::${bucket}/trip-chat/*`);
 for(const principal of ['anonymous','999999999999',account])assert.equal(principal!==deny.Condition.StringNotEquals['aws:PrincipalAccount'],principal!==account);
});
test('malformed or weakened privacy policies cannot enable shared storage',()=>{
 for(const mutate of [p=>p.Statement.pop(),p=>p.Statement[2].Effect='Allow',p=>p.Statement[2].Resource=`arn:aws:s3:::${bucket}/trip-chat/some/*`,p=>p.Statement[2].Action='s3:GetObject',p=>p.Statement[2].Principal={AWS:account},p=>p.Statement[2].Condition.StringNotEquals['aws:PrincipalAccount']='*',p=>p.Statement[2].Condition.Bool={'aws:SecureTransport':'false'}]){const p=structuredClone(policy);mutate(p);assert.equal(hasPrivateChatPrefixPolicy(p,bucket,account),false);}
 for(const bad of [null,'{bad',{},[]])assert.equal(hasPrivateChatPrefixPolicy(bad,bucket,account),false);
 assert.equal(hasPrivateChatPrefixPolicy(policy,bucket,'wrong'),false);
});
test('backend fails closed, requires explicit shared mode, and sends expected owner to S3',async()=>{
 const keys=['TRIP_CHAT_AUDIO_BUCKET','TRIP_CHAT_STORAGE_MODE','TRIP_CHAT_AWS_ACCOUNT_ID'];const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const original=S3Client.prototype.send;let privateBucket=false,currentPolicy=JSON.stringify(policy),calls=[];
 S3Client.prototype.send=async function(command){calls.push(command);if(command.constructor.name==='GetPublicAccessBlockCommand')return{PublicAccessBlockConfiguration:Object.fromEntries(['BlockPublicAcls','IgnorePublicAcls','BlockPublicPolicy','RestrictPublicBuckets'].map(k=>[k,privateBucket]))};if(command.constructor.name==='GetBucketPolicyCommand')return{Policy:currentPolicy};throw Error('Unexpected S3 operation');};
 try{
  delete process.env.TRIP_CHAT_AUDIO_BUCKET;await assert.rejects(privateAudioBucket,/Chưa cấu hình/);
  process.env.TRIP_CHAT_AUDIO_BUCKET=bucket;delete process.env.TRIP_CHAT_STORAGE_MODE;await assert.rejects(privateAudioBucket,/bảo vệ riêng/);
  privateBucket=true;assert.equal(await privateAudioBucket(),bucket);privateBucket=false;
  process.env.TRIP_CHAT_STORAGE_MODE='shared-prefix';process.env.TRIP_CHAT_AWS_ACCOUNT_ID=account;assert.equal(await privateAudioBucket(),bucket);assert.equal(calls.at(-1).input.ExpectedBucketOwner,account);
  currentPolicy='{"Statement":[]}';await assert.rejects(privateAudioBucket,/Thiếu chính sách/);
 }finally{S3Client.prototype.send=original;for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}}
});
