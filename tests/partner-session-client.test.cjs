const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync(require('node:path').join(__dirname,'../apps/web/src/components/partners/partnerSession.js'),'utf8');
function client(fetch){const values=new Map(),events=[],exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,fetch,Date,JSON,Promise,Error,atob,Event:class{constructor(type){this.type=type;}},localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},window:{dispatchEvent:event=>events.push(event.type)}});return {...exports,values,events};}
const token=(extra={})=>'x.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,...extra})).toString('base64url')+'.x';
const reply=(status,data)=>({status,ok:status<400,json:async()=>data});
test('admin clients remain untouched and regular sessions do not refresh',async()=>{
 const calls=[],c=client(async(...args)=>{calls.push(args);return reply(200,{});});
 await c.partnerFetch('base','url',{headers:{Authorization:'Bearer admin'}});assert.equal(calls[0][1].headers.Authorization,'Bearer admin');
 c.enablePartnerSessionRefresh();const normal=token();c.storePartnerToken(normal);await c.partnerFetch('base','url');assert.equal(calls.length,2);assert.equal(calls[1][1].headers.Authorization,'Bearer '+normal);
});
test('concurrent requests share one refresh and restore remembered sessions after access expiry',async()=>{
 const fresh=token({rememberUntil:Date.now()/1000+10000}),calls=[];
 const c=client(async(url,options)=>{calls.push([url,options]);return url.endsWith('/refresh')?reply(200,{success:true,token:fresh}):reply(200,{});});
 c.enablePartnerSessionRefresh();c.storePartnerToken(token({exp:1,rememberUntil:Date.now()/1000+10000}));
 await Promise.all([c.partnerFetch('base','one'),c.partnerFetch('base','two')]);
 assert.equal(calls.filter(([url])=>url.endsWith('/refresh')).length,1);assert.equal(calls[0][1].credentials,'include');assert.equal(c.values.get(c.partnerTokenKey),fresh);
});
test('network failure retains the stored session; revoked refresh clears it',async()=>{
 const c=client(async()=>{throw new Error('offline');});c.storePartnerToken('kept');await assert.rejects(c.refreshPartnerToken('base'));assert.equal(c.values.get(c.partnerTokenKey),'kept');
 const revoked=client(async()=>reply(401,{message:'revoked'}));revoked.storePartnerToken('old');await assert.rejects(revoked.refreshPartnerToken('base'));assert.equal(revoked.values.has(revoked.partnerTokenKey),false);
});
test('late refresh cannot restore a session cleared during logout',async()=>{
 let finish;const c=client(()=>new Promise(resolve=>{finish=resolve;}));c.storePartnerToken('old');const pending=c.refreshPartnerToken('base');c.clearPartnerToken();finish(reply(200,{success:true,token:'late'}));await assert.rejects(pending);assert.equal(c.values.has(c.partnerTokenKey),false);
});

test('cross-tab logout invalidates pending refresh without restoring the removed token',async()=>{
 let finish;const c=client(()=>new Promise(resolve=>{finish=resolve;}));c.storePartnerToken('old');const pending=c.refreshPartnerToken('base');
 c.values.delete(c.partnerTokenKey);c.notifyPartnerStorageChange();finish(reply(200,{success:true,token:'late'}));await assert.rejects(pending);assert.equal(c.values.has(c.partnerTokenKey),false);
});
test('a late refresh cannot replace a newer login or changed-password token',async()=>{
 let finish;const c=client(()=>new Promise(resolve=>{finish=resolve;}));c.storePartnerToken('old');const pending=c.refreshPartnerToken('base');
 c.storePartnerToken('new-login');finish(reply(200,{success:true,token:'late'}));assert.equal(await pending,'new-login');assert.equal(c.values.get(c.partnerTokenKey),'new-login');
});
