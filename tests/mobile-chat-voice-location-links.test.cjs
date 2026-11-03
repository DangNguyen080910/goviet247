const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function recordingHarness({denied=false,failures=0,inactive=false}={}){
 let clock=0,created=0,starts=0,stops=0;const app={currentState:inactive?'inactive':'active'},modes=[];
 class Recording{constructor(){created++;}async prepareToRecordAsync(){assert.equal(app.currentState,'active');if(failures-->0)throw Error('This experience is currently in the background, so the audio session could not be activated.');}async startAsync(){starts++;}async stopAndUnloadAsync(){stops++;}}
 const Audio={Recording,RecordingOptionsPresets:{HIGH_QUALITY:{}},requestPermissionsAsync:async()=>({granted:!denied}),setIsEnabledAsync:async()=>{},setAudioModeAsync:async mode=>modes.push(mode)};
 const exports={};vm.runInNewContext(compile(read('apps/mobile-chat/audioRecording.ts')),{exports,require:n=>n==='react-native'?{AppState:app}:{Audio},Date:{now:()=>clock},setTimeout:fn=>{clock+=300;app.currentState='active';fn();}});
 return{exports,modes,get created(){return created;},get starts(){return starts;},get stops(){return stops;}};
}
test('recording waits for foreground after permission and retries the transient iOS session error once',async()=>{
 const h=recordingHarness({inactive:true,failures:1});const rec=await h.exports.createChatRecording(()=>true);assert(rec);assert.equal(h.created,2);assert.equal(h.starts,1);assert.equal(h.stops,1);assert(h.modes.every(m=>m.allowsRecordingIOS&&m.staysActiveInBackground===false));
});
test('recording denial or leaving the conversation never opens a recorder',async()=>{
 for(const [opts,current] of [[{denied:true},true],[{},false]]){const h=recordingHarness(opts);await assert.rejects(()=>h.exports.createChatRecording(()=>current));assert.equal(h.created,0);}
});
test('persistent iOS activation error is bounded and translated for the user',async()=>{
 const h=recordingHarness({failures:10});await assert.rejects(()=>h.exports.createChatRecording(()=>true),/Micro chưa sẵn sàng/);assert.equal(h.created,2);assert.equal(h.stops,2);
});
const links={};vm.runInNewContext(compile(read('apps/mobile-chat/chatLinks.ts')),{exports:links,URL});
test('pasted Maps and other web links preserve query strings, open separately and leave text intact',()=>{
 const text='Hẹn tại https://maps.app.goo.gl/LJcx1DbSPj5ZFaFz9?g_st=ic, hoặc https://maps.apple.com/?ll=10.1,106.2 nhé.';
 const parts=links.splitChatLinks(text);assert.equal(parts.map(p=>p.text).join(''),text);assert.deepEqual(Array.from(parts.filter(p=>p.url),p=>p.url),['https://maps.app.goo.gl/LJcx1DbSPj5ZFaFz9?g_st=ic','https://maps.apple.com/?ll=10.1,106.2']);
 assert.equal(links.splitChatLinks('javascript:alert(1) tel:0901234567 https://user:password@example.com').filter(p=>p.url).length,0);
});
function chatFunction(name,next,deps){const s=read('apps/mobile-chat/TripChat.tsx'),start=s.indexOf(`  async function ${name}(`),end=s.indexOf(`  ${next}`,start);return new Function(...Object.keys(deps),compile(s.slice(start,end))+`;return ${name};`)(...Object.values(deps));}
test('GPS action posts only current coordinates; denial/cancel sends nothing',async()=>{
 for(const [granted,current,expected] of [[true,true,1],[false,true,0],[true,false,0]]){
 const posts=[];const deps={generation:{current:1},mounted:{current},Keyboard:{dismiss(){}},Location:{requestForegroundPermissionsAsync:async()=>({granted}),getCurrentPositionAsync:async()=>({coords:{latitude:10.5,longitude:106.5}}),Accuracy:{High:1}},tripId:'trip-1',id:()=> 'message-123',post:async(...args)=>posts.push(args),load:async()=>{}};
 const fn=chatFunction('currentLocation','function openMap',deps);if(!granted)await assert.rejects(fn,/Cài đặt/);else await fn();assert.equal(posts.length,expected);if(expected)assert.deepEqual(posts[0][1],{kind:'LOCATION',latitude:10.5,longitude:106.5,locationLabel:'Định vị hiện tại',clientId:'message-123'});
 }
 assert.doesNotMatch(read('apps/mobile-chat/TripChat.tsx'),/Tìm địa chỉ \/ điểm hẹn|async function search\(/);
});
test('voice upload retains the draft and client ID when BE storage is unavailable',async()=>{
 let draft={uri:'file:///voice.m4a',clientId:'message-123',durationMs:5000},cleared=0;const fields=[];
 class FormData{append(...args){fields.push(args);}}
 const deps={draft,sound:{current:null},setPlaying(){},generation:{current:1},mounted:{current:true},FormData,Platform:{OS:'android'},tripId:'trip-1',api:async()=>{throw Error('Chưa cấu hình kho tệp hội thoại riêng tư.');},setDraft:()=>cleared++,load:async()=>{}};
 await assert.rejects(chatFunction('sendAudio','async function chooseImage',deps),/kho tệp/);assert.equal(cleared,0);assert(fields.some(([name,value])=>name==='clientId'&&value==='message-123'));assert(fields.some(([name,value])=>name==='audio'&&value.type==='audio/mp4'));
});
