const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function harness(storageKey,saved={}) {
 const slots=[],pending=[],listeners=new Map(),storage=new Map(Object.entries(saved));let cursor=0,dirty=false;
 const react={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>{const next=typeof v==='function'?v(slots[i]):v;if(next!==slots[i]){slots[i]=next;dirty=true;}}];},
  useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
  useEffect(fn,deps){const i=cursor++,prior=slots[i];if(!prior||deps.some((d,j)=>d!==prior.deps[j])){slots[i]={deps};pending.push(()=>{prior?.cleanup?.();slots[i].cleanup=fn();});}}
 };
 const win={innerWidth:400,innerHeight:800,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const source=fs.readFileSync(path.join(__dirname,'../apps/web/src/components/useDraggableInbox.js'),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,require:id=>{assert.equal(id,'react');return react;},window:win,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}});
 let hook;function render(){let loops=0;do{dirty=false;cursor=0;hook=exports.default(true,storageKey);while(pending.length)pending.shift()();assert.ok(++loops<10);}while(dirty);return hook;}
 const captured=new Set();const node={getBoundingClientRect:()=>({width:172,height:48}),setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)};
 render().ref(node);render();
 const event=(x,y)=>({isPrimary:true,button:0,pointerId:1,clientX:x,clientY:y,currentTarget:node});
 return {get hook(){return hook;},render,storage,win,listeners,event};
}
test('partner inbox drags to screen edges, saves a separate position and suppresses click after drag',()=>{
 const h=harness('goviet247-partner-inbox-position');
 h.hook.startDrag(h.event(200,500));h.hook.moveDrag(h.event(-500,1000));h.render();h.hook.finish(h.event(-500,1000));h.render();
 assert.equal(h.hook.style.left,16);assert.equal(h.hook.style.top,736);
 const saved=JSON.parse(h.storage.get('goviet247-partner-inbox-position'));assert.equal(saved.x,16);assert.equal(saved.y,736);assert.equal(h.storage.has('goviet247-admin-inbox-position'),false);
 let prevented=false;assert.equal(h.hook.consumeClick({detail:1,preventDefault(){prevented=true;},stopPropagation(){}}),true);assert.equal(prevented,true);
});
test('a tap still opens normally and keyboard clicks remain usable',()=>{
 const h=harness('partner');h.hook.startDrag(h.event(200,500));h.hook.moveDrag(h.event(202,502));h.hook.finish(h.event(202,502));
 const click={detail:1,preventDefault(){throw Error('tap blocked');},stopPropagation(){}};assert.equal(h.hook.consumeClick(click),false);
 assert.equal(h.hook.consumeClick({...click,detail:0}),false);
});
test('restored partner position is clamped after viewport resizing',()=>{
 const h=harness('partner',{partner:JSON.stringify({x:210,y:730})});assert.equal(h.hook.style.top,730);
 h.win.innerWidth=320;h.win.innerHeight=500;h.listeners.get('resize')();h.render();
 assert.equal(h.hook.style.top,436);assert.ok(h.hook.style.left+172<=304);
});
test('admin inbox retains its existing storage key',()=>{
 const h=harness(undefined,{'goviet247-admin-inbox-position':JSON.stringify({x:16,y:200})});assert.equal(h.hook.style.left,16);assert.equal(h.hook.style.top,200);
});
