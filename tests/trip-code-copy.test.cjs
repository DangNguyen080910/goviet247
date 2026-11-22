const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const compile=(file,jsx=false)=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const full='cmw-full-CaseSensitive-TripCode123';
function nativeCopy(fail=false) {
  const exports={},writes=[],alerts=[],stopped=[];
  const jsx=(type,props)=>({type,props});
  vm.runInNewContext(compile('apps/mobile-chat/CopyTripIdButton.tsx'),{exports,require:name=>name==='expo-clipboard'?{setStringAsync:async value=>{writes.push(value);if(fail===true)throw Error('Denied');if(fail==='false')return false;}}:name==='react'?{useState:()=>[false,()=>{}],useEffect:()=>{}}:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:{Alert:{alert:(...args)=>alerts.push(args)},Pressable:'Pressable',Text:'Text'}});
  return {button:exports.default({tripId:full}),empty:exports.default({tripId:null}),writes,alerts,event:{stopPropagation:()=>stopped.push(true)},stopped};
}
test('native copy writes the full case-sensitive ID and stops card navigation/acceptance',async()=>{
  const h=nativeCopy();await h.button.props.onPress(h.event);assert.deepEqual(h.writes,[full]);assert.equal(h.stopped.length,1);assert.equal(h.alerts[0][0],'Đã sao chép');assert.equal(h.empty,null);
});
test('clipboard failure never reports success',async()=>{
  const h=nativeCopy(true);await h.button.props.onPress(h.event);assert.equal(h.alerts.length,1);assert.equal(h.alerts[0][0],'Không thể sao chép');
});
function browserCopy({clipboard=false,denied=false,fallback=true}={}) {
  const exports={},writes=[],fields=[];let removed=0,focused=0,selected=0;
  const document={activeElement:{focus:()=>focused++},body:{appendChild:field=>fields.push(field)},createElement:()=>({style:{},select:()=>selected++,remove:()=>removed++}),execCommand:command=>{assert.equal(command,'copy');return fallback;}};
  const navigator=clipboard?{clipboard:{writeText:async value=>{writes.push(value);if(denied)throw Error('Denied');}}}:{};
  vm.runInNewContext(compile('apps/web/src/utils/clipboard.js'),{exports,document,navigator,globalThis:{navigator}});
  return {copy:exports.copyText,writes,fields,get removed(){return removed;},get focused(){return focused;},get selected(){return selected;}};
}
test('web uses async clipboard and preserves full IDs',async()=>{
  const h=browserCopy({clipboard:true});await h.copy(full);assert.deepEqual(h.writes,[full]);assert.equal(h.fields.length,0);
});
test('web fallback works when clipboard is absent or denied, removes temporary text and restores focus',async()=>{
  for(const opts of [{},{clipboard:true,denied:true}]) {const h=browserCopy(opts);await h.copy(full);assert.equal(h.fields[0].value,full);assert.equal(h.removed,1);assert.equal(h.focused,1);assert.equal(h.selected,1);}
});
test('failed browser fallback rejects instead of claiming a successful copy',async()=>{
  const h=browserCopy({fallback:false});await assert.rejects(()=>h.copy(full),/Không thể sao chép/);assert.equal(h.removed,1);assert.equal(h.focused,1);
});

test('Expo web clipboard returning false is treated as failure',async()=>{
 const h=nativeCopy('false');await h.button.props.onPress(h.event);assert.equal(h.alerts[0][0],'Không thể sao chép');
});
