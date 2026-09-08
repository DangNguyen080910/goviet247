// Run: node --test tests/session-safety.test.cjs
// Execute the actual startup components with mocked device/network boundaries.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const flush = () => new Promise(resolve => setImmediate(resolve));
class ApiError extends Error { constructor(status) { super('API failure'); this.status = status; } }
function load(file, mocks, globals = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
    .replace(/import\.meta\.env\.VITE_API_BASE/g, '"https://test.invalid"');
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, allowJs: true,
  }}).outputText;
  const context = { exports: {}, console: { log(){}, warn(){}, error(){} },
    require: id => { assert.ok(id in mocks, `Missing mock: ${id}`); return mocks[id]; }, ...globals };
  vm.runInNewContext(js, context, { filename: file });
  return context.exports;
}
function hooks() {
  let cursor = 0;
  const state = [], effects = [];
  return { state, effects, reset: () => {cursor = 0; effects.length = 0;},
    react: {
      useState(initial) { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
        return [state[i], value => state[i] = typeof value === 'function' ? value(state[i]) : value]; },
      useEffect: fn => effects.push(fn), useCallback: fn => fn, useRef: value => ({current: value}),
      createContext: () => ({Provider: 'Provider'}),
    }
  };
}
const jsx = { jsx: (type, props) => ({type, props}), jsxs: (type, props) => ({type, props}) };
function mobile(app, options = {}) {
  const h = hooks(); let removed = 0, route, token = 'saved';
  const value = async v => { if (v instanceof Error) throw v; return v; };
  const opts = { me: {user: {id:'u',role:'DRIVER'}}, profile: {hasDriverProfile:true,profile:{status:'VERIFIED'}}, ...options };
  const storage = { getRiderToken:async()=>token, getDriverToken:async()=>token,
    removeRiderToken:async()=>{removed++;token=null;}, removeDriverToken:async()=>{removed++;token=null;} };
  const component = load(`apps/${app}-mobile/app/bootstrap.tsx`, {
    react: h.react, 'react/jsx-runtime': jsx,
    'expo-router': {router: {replace: r => route=r}},
    'expo-notifications': {getPermissionsAsync:async()=>{if(opts.notificationError) throw new Error('permission failure');return {status:'granted'};}},
    'expo-device': {isDevice:true}, 'react-native': {StyleSheet:{create:x=>x}},
    'react-native-safe-area-context': {},
    '../services/authApi': {ApiError, getMe:()=>value(opts.me)},
    '../services/storage': storage,
    '../services/driverProfileApi': {getMyDriverProfile:()=>value(opts.profile)},
    '../services/pushRegister': {registerPushToken:async()=>{}},
    '../services/notify': {prepareNotificationUx:async()=>{},configureRiderAudioMode:async()=>{}},
  }).default;
  const run = () => {h.reset();component();return h.effects[0]();};
  return {h,opts,run,get removed(){return removed;},get route(){return route;},get token(){return token;}};
}
for (const app of ['rider','driver']) {
  for (const [name, me] of [['network',new TypeError('offline')],['503',new ApiError(503)],['malformed',{}]]) {
    test(`${app}: ${name} retains token; retry succeeds without OTP`,async()=>{
      const m=mobile(app,{me});m.run();await flush();
      assert.equal(m.removed,0);assert.equal(m.route,undefined);assert.equal(m.h.state[1],true);
      m.opts.me={user:{id:'u',role:'DRIVER'}};m.h.state[1]=false;m.run();await flush();
      assert.equal(m.route,app==='rider'?'/home':'/dashboard');assert.equal(m.removed,0);
    });
  }
  test(`${app}: confirmed 401 clears token`,async()=>{
    const m=mobile(app,{me:new ApiError(401)});m.run();await flush();
    assert.equal(m.removed,1);assert.equal(m.route,'/');
  });
  test(`${app}: notification failure never clears token`,async()=>{
    const m=mobile(app,{notificationError:true});m.run();await flush();assert.equal(m.removed,0);
  });
  test(`${app}: late response after unmount does not log out`,async()=>{
    let reject;const m=mobile(app,{me:new Promise((_,r)=>reject=r)});const cleanup=m.run();
    await flush();cleanup();reject(new ApiError(401));await flush();assert.equal(m.removed,0);assert.equal(m.route,undefined);
  });
}
test('driver: profile outage retains token; suspension still routes away from dashboard',async()=>{
  const m=mobile('driver',{profile:new ApiError(503)});m.run();await flush();assert.equal(m.removed,0);assert.equal(m.route,undefined);
  m.opts.profile={hasDriverProfile:true,profile:{status:'SUSPENDED'}};m.run();await flush();assert.equal(m.route,'/driver-profile/suspended');
});
function web(response) {
  const h=hooks(), data=new Map([['gv247_customer_token','saved'],['gv247_customer_user',JSON.stringify({id:'u'})]]), listeners={};
  const opts={response};
  const mod=load('apps/web/src/context/CustomerAuthContext.jsx',{
    react:h.react,'react/jsx-runtime':jsx,
    '../api/auth':{logoutSession:async()=>{},getMe:async()=>{if(opts.response instanceof Error)throw opts.response;return opts.response;}},
    '../api/systemNotificationsPublic':{},
  },{localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},
    window:{addEventListener:(n,f)=>listeners[n]=f,removeEventListener:n=>delete listeners[n]}});
  const tree=mod.CustomerAuthProvider({children:null});const cleanup=h.effects[0]();
  return {data,listeners,opts,cleanup,tree};
}
test('web: offline keeps session, online retries, logout still clears',async()=>{
  const w=web(new TypeError('offline'));await flush();assert.equal(w.data.get('gv247_customer_token'),'saved');
  w.opts.response={id:'u',displayName:'Updated'};await w.listeners.online();
  assert.equal(JSON.parse(w.data.get('gv247_customer_user')).displayName,'Updated');
  await w.tree.props.value.logout();assert.equal(w.data.has('gv247_customer_token'),false);w.cleanup();
});
test('web: confirmed 401 clears session',async()=>{
  const w=web(Object.assign(new Error('expired'),{status:401}));await flush();assert.equal(w.data.has('gv247_customer_token'),false);w.cleanup();
});
test('web: stale 401 cannot clear a replacement session',async()=>{
  let reject;const w=web(new Promise((_,r)=>reject=r));await flush();w.cleanup();w.data.set('gv247_customer_token','replacement');reject(Object.assign(new Error('expired'),{status:401}));await flush();assert.equal(w.data.get('gv247_customer_token'),'replacement');
});
test('web API: non-JSON 401 preserves status; malformed 200 is not authentication failure',async()=>{
  let status=401;const api=load('apps/web/src/api/auth.js',{}, {fetch:async()=>({ok:status===200,status,json:async()=>{throw Error('not JSON');}})});
  await assert.rejects(api.getMe('token'),e=>e.status===401);status=200;
  await assert.rejects(api.getMe('token'),e=>e.status===undefined);
});
for (const [name, storedToken, expected] of [['saved session','saved','/home'],['no session',null,'/login']]) {
  test(`admin startup: notification failure with ${name}`,async()=>{
    const h=hooks();let route;
    const screen=load('apps/admin-mobile/app/index.tsx',{
      react:h.react,'react/jsx-runtime':jsx,'react-native':{StyleSheet:{create:x=>x}},
      'expo-router':{router:{replace:r=>route=r}},
      '../services/storage':{getAdminToken:async()=>storedToken},
      'expo-notifications':{getLastNotificationResponseAsync:async()=>{throw Error('native failure');}},
      '../services/adminNotificationNavigation':{},
    }).default;
    screen();h.effects[0]();await flush();assert.equal(route,expected);
  });
}
test('admin startup: storage failure offers retry without routing to login',async()=>{
  const h=hooks();let route;
  const screen=load('apps/admin-mobile/app/index.tsx',{
    react:h.react,'react/jsx-runtime':jsx,'react-native':{StyleSheet:{create:x=>x}},
    'expo-router':{router:{replace:r=>route=r}},
    '../services/storage':{getAdminToken:async()=>{throw Error('storage unavailable');}},
    'expo-notifications':{},'../services/adminNotificationNavigation':{},
  }).default;
  screen();h.effects[0]();await flush();assert.equal(route,undefined);assert.equal(h.state[1],true);
});

for (const [app, role] of [['rider-mobile','Rider'],['driver-mobile','Driver']]) {
  function client() {
    let token='legacy', request;
    const storage={};
    storage[`get${role}Token`]=async()=>token;
    storage[`set${role}Token`]=async value=>{token=value;};
    storage[`remove${role}Token`]=async()=>{token=null;};
    const mod=load(`apps/${app}/services/authApi.ts`,{
      './storage':storage,'../constants/api':{API_BASE_URL:'https://test.invalid'},
    },{fetch:(...args)=>request(...args)});
    return {mod,get token(){return token;},set request(value){request=value;}};
  }
  test(`${app}: valid session upgrades locally without OTP`,async()=>{
    const c=client(); c.request=async(url,init)=>{
      assert.equal(init.headers['X-Session-Mode'],'persistent-v1');
      return {ok:true,status:200,json:async()=>({success:true,user:{id:'u'},access_token:'persistent'})};
    };
    await c.mod.getMe('legacy');assert.equal(c.token,'persistent');
  });
  test(`${app}: failed logout retains token; confirmed logout clears`,async()=>{
    const c=client();c.request=async()=>{throw new TypeError('offline');};
    await assert.rejects(c.mod.logoutSession());assert.equal(c.token,'legacy');
    c.request=async()=>({ok:true,status:200,json:async()=>({success:true})});
    await c.mod.logoutSession();assert.equal(c.token,null);
  });
  test(`${app}: late getMe cannot resurrect token after logout`,async()=>{
    const c=client();let resolve;
    c.request=async url=>url.endsWith('/me')?new Promise(r=>resolve=r):({ok:true,status:200,json:async()=>({success:true})});
    const pending=c.mod.getMe('legacy');await c.mod.logoutSession();
    resolve({ok:true,status:200,json:async()=>({success:true,user:{id:'u'},access_token:'persistent'})});
    await pending;assert.equal(c.token,null);
  });
}
