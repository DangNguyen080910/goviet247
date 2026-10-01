const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('apps/rider-mobile/services/metaAds.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(status, platform='ios', enabled=true, native=true) {
 const calls=[]; const exports={};
 const Settings={setAdvertiserTrackingEnabled:async value=>calls.push(['tracking',value]),setAdvertiserIDCollectionEnabled:value=>calls.push(['identifier',value]),setAutoLogAppEventsEnabled:value=>calls.push(['events',value]),initializeSDK:()=>calls.push(['init'])};
 const modules={
  'react-native':{AppState:{currentState:'active',addEventListener:()=>({remove(){}})},Platform:{OS:platform},NativeModules:native?{FBSettings:{}}:{}},
  'expo-constants':{default:{expoConfig:{extra:{metaAdsEnabled:enabled}}}},
  'react-native-fbsdk-next':{Settings},
  'expo-tracking-transparency':{getTrackingPermissionsAsync:async()=>({status}),requestTrackingPermissionsAsync:async()=>{calls.push(['request']);return {status:'denied'};}},
 };
 vm.runInNewContext(code,{exports,require:name=>modules[name],console});return {api:exports,calls};
}
test('ATT denied initializes aggregate events without enabling identifiers',async()=>{
 const f=fixture('denied');await f.api.syncMetaAds();assert.deepEqual(f.calls,[['tracking',false],['identifier',false],['events',true],['init']]);
 await f.api.syncMetaAds();assert.equal(f.calls.filter(c=>c[0]==='init').length,1);
});
test('ATT granted enables identifiers; Android does not request ATT',async()=>{
 const f=fixture('granted');await f.api.syncMetaAds();assert.ok(f.calls.some(c=>c[0]==='identifier'&&c[1]));
 const a=fixture('undetermined','android');await a.api.syncMetaAds();assert.equal(a.calls.some(c=>c[0]==='request'||c[0]==='tracking'),false);assert.ok(a.calls.some(c=>c[0]==='init'));
});
test('undetermined requests permission and respects denial',async()=>{const f=fixture('undetermined');await f.api.syncMetaAds();assert.equal(f.calls[0][0],'request');assert.ok(f.calls.some(c=>c[0]==='identifier'&&c[1]===false));});
test('web, missing config and Expo Go safely skip native SDK',async()=>{for(const args of [['granted','web'],['granted','ios',false],['granted','ios',true,false]]){const f=fixture(...args);await f.api.syncMetaAds();assert.equal(f.calls.length,0);}});
