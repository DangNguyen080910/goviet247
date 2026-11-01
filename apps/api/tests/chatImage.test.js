import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {prepareChatImage, CHAT_IMAGE_MAX_BYTES} from '../src/services/chatImage.js';
import {chatMessageForClient, validateChatPayload} from '../src/shared/tripChat.js';
import {deleteChatMessage} from '../src/services/tripChatService.js';

test('photo normalization shrinks dimensions, respects orientation and strips private metadata', async () => {
  const input = await sharp({create:{width:2500,height:1200,channels:3,background:'#123456'}}).jpeg().withMetadata({orientation:6}).toBuffer();
  const photo = await prepareChatImage(input), meta = await sharp(photo.buffer).metadata();
  assert.equal(photo.mimetype,'image/jpeg');assert.equal(meta.format,'jpeg');
  assert.ok(meta.width <= 1920 && meta.height <= 1920);assert.ok(meta.height > meta.width);
  assert.equal(meta.exif,undefined);assert.equal(meta.orientation,undefined);
});
test('accepts PNG and WebP but refuses fake images, SVG, oversized, corrupt and multi-frame files', async () => {
  const source=sharp({create:{width:20,height:10,channels:4,background:'#ff000080'}});
  for (const format of ['png','webp']) assert.equal((await sharp((await prepareChatImage(await source.clone().toFormat(format).toBuffer())).buffer).metadata()).format,'jpeg');
  const corrupt=Buffer.from([0xff,0xd8,0xff,0xe0,0,0]);
  const gif=Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64');
  for (const input of [Buffer.from('not an image'),Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'),corrupt,gif,Buffer.alloc(CHAT_IMAGE_MAX_BYTES+1)]) await assert.rejects(()=>prepareChatImage(input), e=>e.status===400);
});
test('legacy clients see a safe text placeholder; new clients see IMAGE; clients cannot forge storage keys via JSON', () => {
  const m={id:'m',kind:'IMAGE',text:null};
  assert.equal(chatMessageForClient(m,false).kind,'TEXT');assert.match(chatMessageForClient(m,false).text,/cập nhật/);
  assert.equal(chatMessageForClient(m,true),m);
  assert.equal(chatMessageForClient({...m,deletedAt:new Date()},false).text,null);
  assert.throws(()=>validateChatPayload({clientId:'test_12345',kind:'IMAGE',imageKey:'someone-elses-file'}));
});
test('image deletion removes access, queues private-object cleanup and audits only once', async () => {
  let message={id:'image-1',tripId:'t',kind:'IMAGE',imageKey:'private/photo.jpg',imageMime:'image/jpeg'};
  const audit=[];
  const tx={$queryRaw:async()=>[],trip:{findUnique:async()=>({id:'t'})},tripChatMessage:{findFirst:async()=>message,update:async({data})=>{message={...message,...data};}},tripChatAccess:{create:async({data})=>audit.push(data)}};
  const db={$transaction:fn=>fn(tx)};
  for(const role of ['RIDER','DRIVER']) await assert.rejects(()=>deleteChatMessage(db,'t',message.id,{id:'x',role}),e=>e.status===403);
  await deleteChatMessage(db,'t',message.id,{id:'admin-1',role:'ADMIN'});
  assert.equal(message.imageKey,null);assert.equal(message.imageMime,null);assert.equal(message.imageDeleteKey,'private/photo.jpg');assert.ok(message.deletedAt);assert.equal(audit.length,1);
  await deleteChatMessage(db,'t',message.id,{id:'admin-1',role:'ADMIN'});assert.equal(audit.length,1);
});
