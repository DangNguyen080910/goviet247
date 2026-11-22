import fs from 'node:fs';
import ts from 'typescript';
import test from 'node:test';
import assert from 'node:assert/strict';
import {chatMapLinks,openChatMap} from '../apps/api/src/shared/chatMap.js';

function harness({os='ios',installed=true,queryError=false,fail=[]}={}) {
  const opened=[],queried=[];
  return {opened,queried,options:{os,canOpenURL:async url=>{queried.push(url);if(queryError)throw Error('Query unavailable');return installed;},openURL:async url=>{opened.push(url);if(fail.some(prefix=>url.startsWith(prefix)))throw Error('Cannot open');}}};
}
test('iPhone opens installed Google Maps with the exact sent coordinates',async()=>{
  const h=harness();await openChatMap(10.765,106.701,h.options);
  assert.deepEqual(h.queried,['comgooglemaps://']);assert.equal(h.opened.length,1);
  assert.equal(new URL(h.opened[0]).searchParams.get('q'),'10.765,106.701');assert.match(h.opened[0],/^comgooglemaps:/);
});
test('iPhone without Google Maps opens Apple Maps; no redirects after a successful open',async()=>{
  const h=harness({installed:false});await openChatMap(0,-180,h.options);
  assert.deepEqual(h.opened,[chatMapLinks(0,-180).apple]);
});
test('failed iOS query or Google launch falls back to Apple Maps',async()=>{
  for(const options of [{queryError:true},{fail:['comgooglemaps:']}]) {
    const h=harness(options);await openChatMap(10,106,h.options);assert.equal(h.opened.at(-1),chatMapLinks(10,106).apple);
  }
});
test('iPhone falls back to Google web if Apple Maps also fails',async()=>{
  const h=harness({installed:false,fail:['https://maps.apple.com']});await openChatMap(10,106,h.options);
  assert.deepEqual(h.opened,[chatMapLinks(10,106).apple,chatMapLinks(10,106).google]);
});
test('Android uses the universal Google Maps link and can fall back to a map handler',async()=>{
  const h=harness({os:'android',fail:['https://www.google.com']});await openChatMap(10,106,h.options);
  assert.deepEqual(h.queried,[]);assert.deepEqual(h.opened,[chatMapLinks(10,106).google,chatMapLinks(10,106).geo]);
});
test('invalid coordinates never open a map; web links use api=1 and exact coordinates',async()=>{
  for(const coords of [[null,106],['',106],[91,0],[0,181],[NaN,0],['bad',0]]) {
    const h=harness();await assert.rejects(()=>openChatMap(...coords,h.options),/Định vị không hợp lệ/);assert.equal(h.opened.length,0);
  }
  const url=new URL(chatMapLinks(-90,180).google);assert.equal(url.searchParams.get('api'),'1');assert.equal(url.searchParams.get('query'),'-90,180');
});

test('the real chat action keeps React Native Linking methods bound to their module',async()=>{
 const source=fs.readFileSync(new URL('../apps/mobile-chat/TripChat.tsx',import.meta.url),'utf8');
 const start=source.indexOf('  function openMap('),end=source.indexOf('\n  return <SafeAreaView',start);
 assert(start>0&&end>start);
 const code=ts.transpileModule(source.slice(start,end),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const opened=[],linking={canOpenURL(url){assert.equal(this,linking);assert.equal(url,'comgooglemaps://');return Promise.resolve(true);},openURL(url){assert.equal(this,linking);opened.push(url);return Promise.resolve();}};
 const fn=new Function('openChatMap','Platform','Linking',code+';return openMap;')(openChatMap,{OS:'ios'},linking);
 await fn(10,106);assert.deepEqual(opened,[chatMapLinks(10,106).googleIos]);
});
