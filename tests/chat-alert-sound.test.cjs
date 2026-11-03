const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function transpile(file){return ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;}
function mobile(){
 const shared={};vm.runInNewContext(transpile(path.join(root,'apps/api/src/shared/chatAlerts.js')),{exports:shared,Set,Date});
 let now=0,plays=0,unloads=0,vibrations=0;const app={currentState:'active'};let callback;
 const sound={setOnPlaybackStatusUpdate:fn=>callback=fn,unloadAsync:async()=>{unloads++;}};
 const mocks={'react-native':{AppState:app},'expo-av':{Audio:{setAudioModeAsync:async()=>{},Sound:{createAsync:async()=>{plays++;return {sound};}}}},'expo-haptics':{NotificationFeedbackType:{Success:'success'},notificationAsync:async()=>{vibrations++;}},'../api/src/shared/chatAlerts.js':{createChatAlertGate:()=>shared.createChatAlertGate(()=>now)}};
 const exports={};vm.runInNewContext(transpile(path.join(root,'apps/mobile-chat/chatAlerts.ts')),{exports,require:id=>{if(id.endsWith('.wav'))return 1;assert.ok(id in mocks,id);return mocks[id];},String});
 return{exports,app,setTime:n=>now=n,get plays(){return plays;},get vibrations(){return vibrations;},get unloads(){return unloads;},finish:()=>callback({isLoaded:true,didJustFinish:true})};
}
test('foreground polling plays bundled chat sound and unloads it after playback',async()=>{
 const m=mobile();await m.exports.playChatAlert('m1');assert.equal(m.plays,1);assert.equal(m.vibrations,1);m.finish();assert.equal(m.unloads,1);
 assert.equal(await m.exports.chatPushShouldPlaySound({type:'TRIP_CHAT',messageId:'m1'}),false);
});
test('push-first and poll-first paths do not ring twice for the same message',async()=>{
 const m=mobile();assert.equal(await m.exports.chatPushShouldPlaySound({type:'TRIP_CHAT',messageId:'m1'}),false);await m.exports.playChatAlert('m1');assert.equal(m.plays,1);assert.equal(m.vibrations,1);
 m.setTime(2000);await m.exports.playChatAlert('m2');assert.equal(m.plays,2);assert.equal(await m.exports.chatPushShouldPlaySound({type:'TRIP_CHAT',messageId:'m2'}),false);
});
test('background polling never plays local audio; remote pushes remain eligible',async()=>{
 const m=mobile();m.app.currentState='background';await m.exports.playChatAlert('m1');assert.equal(m.plays,0);assert.equal(await m.exports.chatPushShouldPlaySound({type:'TRIP_CHAT',messageId:'m1'}),true);
});
test('notification asset is a valid bundled WAV',()=>{
 const data=fs.readFileSync(path.join(root,'apps/mobile-chat/assets/chat_notice.wav'));assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WAVE');assert.ok(data.length>1000);
});
test('web unlock resumes suspended AudioContext before enabling chat sound',async()=>{
 const source=fs.readFileSync(path.join(root,'apps/web/src/components/TripChatHub.jsx'),'utf8');const start=source.indexOf('  async function unlockSound()'),end=source.indexOf('  async function enableAlerts()',start);let resumes=0,ready;
 class AudioContext{constructor(){this.state='suspended';}async resume(){resumes++;this.state='running';}}
 const ref={current:null},unlock=new Function('window','toneContext','setSoundReady',source.slice(start,end)+';return unlockSound;')({AudioContext},ref,v=>ready=v);
 await unlock();assert.equal(resumes,1);assert.equal(ready,true);const ctx=ref.current;await unlock();assert.equal(ref.current,ctx);assert.equal(resumes,1);
});
