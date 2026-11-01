import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import sharp from 'sharp';
import {S3Client} from '@aws-sdk/client-s3';

// Exercise real middleware/routes/transaction authorization with in-memory DB/S3;
// no database, real credentials, bucket or external network is used.
process.env.JWT_SECRET='chat-image-test-only';process.env.ADMIN_JWT_SECRET='chat-image-admin-test-only';
process.env.AWS_REGION='ap-southeast-1';process.env.AWS_ACCESS_KEY_ID='test-only';process.env.AWS_SECRET_ACCESS_KEY='test-only';process.env.TRIP_CHAT_AUDIO_BUCKET='chat-image-test-only';
let trip, rows, objects, audit, revokeOnUpload=false, sequence=0;
const matches=(m,w)=>m.tripId===w.tripId && (!w.id || m.id===w.id) && (!w.kind || m.kind===w.kind) && (w.deletedAt !== null || !m.deletedAt) && (!w.createdAt?.gte || m.createdAt>=w.createdAt.gte);
const db={
 trip:{findUnique:async({where})=>where.id===trip.id?trip:null},
 driverProfile:{findUnique:async()=>({status:'VERIFIED'})},phone:{findMany:async()=>[]},session:{findUnique:async()=>null},admin_users:{findUnique:async()=>({id:1,is_active:true,role:'ADMIN',username:'test'})},
 $queryRaw:async()=>[], $transaction:async fn=>fn(db),
 tripChatMessage:{
  count:async()=>0,
  findMany:async({select})=>select?.imageDeleteKey ? rows.filter(m=>m.imageDeleteKey || m.audioDeleteKey) : [],
  findUnique:async({where})=>{const k=where.tripId_senderId_clientId;return rows.find(m=>m.tripId===k.tripId&&m.senderId===k.senderId&&m.clientId===k.clientId)||null;},
  findFirst:async({where})=>rows.find(m=>matches(m,where))||null,
  create:async({data})=>{const m={id:`photo-${++sequence}`,createdAt:new Date(),...data};rows.push(m);return m;},
  update:async({where,data})=>{const m=rows.find(m=>m.id===where.id);Object.assign(m,data);return m;}
 },tripChatAccess:{create:async({data})=>audit.push(data)}
};
globalThis.__prisma__=db;
S3Client.prototype.send=async command=>{
 const name=command.constructor.name, data=command.input;
 if(name==='GetPublicAccessBlockCommand')return {PublicAccessBlockConfiguration:{BlockPublicAcls:true,IgnorePublicAcls:true,BlockPublicPolicy:true,RestrictPublicBuckets:true}};
 if(name==='PutObjectCommand'){objects.set(data.Key,data.Body);if(revokeOnUpload)trip.status='COMPLETED';return {};}
 if(name==='DeleteObjectCommand'){objects.delete(data.Key);return {};}
 throw new Error(`Unexpected S3 operation ${name}`);
};
const {signToken,signAdminToken}=await import('../src/utils/jwt.js');
const {default:router}=await import('../src/routes/tripChat.js');
const {deliverChatPush}=await import('../src/services/tripChatService.js');
const app=express();app.use(express.json());app.use('/api/trip-chat',router);
const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
const base=`http://127.0.0.1:${server.address().port}/api/trip-chat`;
const photo=await sharp({create:{width:30,height:20,channels:3,background:'#aabbcc'}}).jpeg().toBuffer();
function reset(){trip={id:'trip-test',riderId:'booker',riderPhone:'0901234567',driverId:'driver',status:'ACCEPTED',acceptedAt:new Date(Date.now()-60000)};rows=[];objects=new Map();audit=[];revokeOnUpload=false;}
const token=id=>signToken({id});const admin=signAdminToken({id:1,role:'ADMIN'});
async function upload(id,clientId='client_photo_123',bytes=photo){const form=new FormData();form.append('image',new Blob([bytes],{type:'image/jpeg'}),'photo.jpg');form.append('clientId',clientId);return fetch(`${base}/trip-test/image`,{method:'POST',headers:{Authorization:`Bearer ${token(id)}`},body:form});}
async function read(id,authorization=token('booker')){return fetch(`${base}/trip-test/image/${id}`,{headers:{Authorization:`Bearer ${authorization}`}});}

test('HTTP image routes authorize uploads and signed reads; retries create one photo; admin deletion removes access',async()=>{
 reset();
 assert.equal((await upload('stranger')).status,403);assert.equal(objects.size,0);
 assert.equal((await upload('booker','invalid_image_123',Buffer.from('fake-jpeg'))).status,400);assert.equal(objects.size,0);
 const sent=await upload('driver');assert.equal(sent.status,201);const {id}=await sent.json();assert.equal(rows.length,1);assert.equal(objects.size,1);
 assert.equal((await upload('driver')).status,201);assert.equal(rows.length,1);assert.equal(objects.size,1,'retry must clean orphan upload');
 const image=await read(id);assert.equal(image.status,200);assert.match((await image.json()).url,/X-Amz-Expires=60/);
 assert.equal((await read(id,token('stranger'))).status,403);
 // Reassignment prevents the old driver and the new driver from reading the former driver's photo.
 trip.driverId='replacement';trip.acceptedAt=new Date(Date.now()+1000);
 assert.equal((await read(id,token('driver'))).status,403);assert.equal((await read(id,token('replacement'))).status,404);
 assert.equal((await read(id,admin)).status,200);assert.equal(audit.at(-1).action,'VIEW_IMAGE');
 const removed=await fetch(`${base}/trip-test/messages/${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${admin}`}});assert.equal(removed.status,200);
 assert.equal((await read(id,admin)).status,404);assert.equal(rows[0].imageKey,null);assert.ok(rows[0].imageDeleteKey);
 await deliverChatPush();assert.equal(objects.size,0,'delivery worker cleans deleted image object');assert.equal(rows[0].imageDeleteKey,null);
});
test('HTTP rechecks trip access after upload and cleans private file if trip closes in flight',async()=>{
 reset();revokeOnUpload=true;assert.equal((await upload('booker')).status,403);assert.equal(rows.length,0);assert.equal(objects.size,0);
 assert.equal((await upload('booker','closed_photo_123')).status,403);assert.equal((await read('missing')).status,403);
});
test.after(()=>new Promise(resolve=>server.close(resolve)));
