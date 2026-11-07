const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ts=require('typescript');
function harness({enabled=true,already=false,mic=true,agree=true,holdConsent=false,platform='ios'}={}){
 let token='session-a',alerts=0,configured=0,cleared=0,microphones=0,release;
 const store=new Map();
 const native={matchesSession:async()=>already,microphone:async()=>{microphones++;return mic;},configure:async()=>{configured++;},clear:async()=>{cleared++;}};
 const react={useState:()=>{},useEffect:()=>{}};
 const modules={'../api/src/shared/tripCallLabels.js':{tripCallActionLabel:v=>v},react,'react/jsx-runtime':{jsx:()=>{},jsxs:()=>{}},'react-native':{Platform:{OS:platform},Alert:{alert(_title,_message,buttons){alerts++;if(holdConsent)release=()=>buttons[agree?1:0].onPress();else buttons?.[agree?1:0]?.onPress();}}},'react-native-safe-area-context':{},'expo-modules-core':{requireOptionalNativeModule:()=>native},'expo-secure-store':{getItemAsync:async k=>store.get(k)||null,setItemAsync:async(k,v)=>store.set(k,v)},'@expo/vector-icons':{},'expo-notifications':{getExpoPushTokenAsync:async()=>({data:'ExpoPushToken[androidTokenCaseSensitive]'})},'expo-constants':{default:{easConfig:{projectId:'test-project'}}},'./chatAlerts':{setChatCallActive:()=>{}}};
 const filename=path.join(__dirname,'../apps/mobile-chat/TripCalls.tsx');
 const source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const context={exports:{},require:name=>{if(!(name in modules))throw Error(name);return modules[name];},__DEV__:false,process:{env:{}},setTimeout,clearTimeout,AbortController,fetch:async()=>({ok:enabled,json:async()=>enabled?{items:[]}:{message:'Chưa mở',code:'CALL_NOT_ENABLED'}})};
 vm.runInNewContext(source+'\nexports.setup=ensureConfigured;exports.device=deviceId;',context,{filename});
 context.exports.configureCalls({base:'https://api.example.test',role:'DRIVER',getToken:async()=>token});
 return {...context.exports,stats:()=>({alerts,configured,cleared,microphones}),setToken:v=>{token=v;},release:()=>release(),hasConsent:()=>!!release};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('disabled API never prompts, asks for microphone, or stores a native session',async()=>{const h=harness({enabled:false});await assert.rejects(h.setup());assert.deepEqual(h.stats(),{alerts:0,configured:0,cleared:0,microphones:0});});
test('native setup requires explicit recording consent and microphone permission',async()=>{const h=harness();assert.equal(await h.setup(),true);assert.deepEqual(h.stats(),{alerts:1,configured:1,cleared:0,microphones:1});assert.equal(await h.setup(),true);assert.equal(h.stats().alerts,1);});
test('declining does not keep prompting in the same login session',async()=>{const h=harness({agree:false});assert.equal(await h.setup(),false);assert.equal(await h.setup(),false);assert.deepEqual(h.stats(),{alerts:1,configured:0,cleared:0,microphones:0});});
test('microphone refusal never registers calling',async()=>{const h=harness({mic:false});assert.equal(await h.setup(),false);assert.equal(h.stats().configured,0);});
test('existing secure native consent restores after restart without asking again',async()=>{const h=harness({already:true});assert.equal(await h.setup(),true);assert.deepEqual(h.stats(),{alerts:0,configured:1,cleared:0,microphones:0});});
test('logout while the consent dialog is open cannot resurrect the old call session',async()=>{const h=harness({holdConsent:true});const pending=h.setup();await tick();assert(h.hasConsent());h.setToken(null);await h.clearCallSession();h.release();assert.equal(await pending,false);assert.equal(h.stats().configured,0);assert.equal(h.stats().cleared,1);});
test('switching account during consent cannot register the previous account',async()=>{const h=harness({holdConsent:true});const pending=h.setup();await tick();h.setToken('session-b');h.release();assert.equal(await pending,false);assert.equal(h.stats().configured,0);});
test('concurrent setup shares one consent dialog and one native registration',async()=>{const h=harness({holdConsent:true});const a=h.setup(),b=h.setup();await tick();h.release();assert.equal(await a,true);assert.equal(await b,true);assert.equal(h.stats().alerts,1);assert.equal(h.stats().configured,1);});
test('installation identity remains stable across call-session clear',async()=>{const h=harness();const first=await h.device();await h.clearCallSession();assert.equal(await h.device(),first);assert.match(first,/^[a-zA-Z0-9_-]{16,100}$/);});
test('web builds do not enable an unavailable native calling module',async()=>{const h=harness({platform:'web'});assert.equal(await h.setup(),false);assert.equal(h.stats().configured,0);});

test("Android shares consent/setup and registers the native module",async()=>{const h=harness({platform:"android"});assert.equal(await h.setup(),true);assert.equal(h.stats().configured,1);});
