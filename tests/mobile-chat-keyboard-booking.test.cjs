const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const compile=source=>ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2020}}).outputText;
function renderChat(platform,keyboardVisible=false){
 const source=read('apps/mobile-chat/TripChat.tsx');
 const snippet=source.slice(source.indexOf('export default function TripChatScreen')).replace('export default function','function');
 let state=0;const effects=[],listeners={},removed=[];
 const deps={React:{createElement:(type,props,...children)=>({type,props:props||{},children}),Fragment:'Fragment'},useIsFocused:()=>true,useLocalSearchParams:()=>({tripId:'new-trip'}),useState:initial=>{const n=state++;return[n===0?keyboardVisible:n===4?true:n===5?['Quick reply']:initial,()=>{}];},useEffect:fn=>effects.push(fn),useCallback:fn=>fn,useRef:current=>({current}),Platform:{OS:platform},Keyboard:{addListener:(name,fn)=>{listeners[name]=fn;return{remove:()=>removed.push(name)};}},requestAnimationFrame:fn=>fn(),blue:'#2563eb',ink:'#000',button:{},router:{back(){}},chatAudienceLabel:()=>'',config:{role:'RIDER'}};
 for(const name of ['SafeAreaView','KeyboardAvoidingView','View','Pressable','Text','TextInput','ScrollView','Modal','Image'])deps[name]=name;
 const component=new Function(...Object.keys(deps),compile(snippet)+';return TripChatScreen;')(...Object.values(deps));
 return{tree:component(),effects,listeners,removed};
}
function nodes(tree){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return[tree,...nodes(tree.children)];}
for(const platform of ['ios','android'])test(`${platform}: composer and controls stay inside keyboard avoidance; auxiliary content can scroll`,()=>{
 const h=renderChat(platform),all=nodes(h.tree),avoid=all.find(n=>n.type==='KeyboardAvoidingView');
 assert.equal(avoid.props.behavior,platform==='ios'?'padding':'height');
 const inside=nodes(avoid);assert(inside.some(n=>n.type==='TextInput'&&n.props.placeholder==='Nhắn tin cho chuyến…'));
 const composer=inside.find(n=>n.type==='ScrollView'&&n.props.style?.maxHeight==='65%');assert(composer);assert.equal(composer.props.keyboardShouldPersistTaps,'handled');
 assert(nodes(composer).some(n=>n.type==='Pressable'));
 const cleanup=h.effects[0]();assert.equal(Object.keys(h.listeners).length,2);cleanup();assert.equal(h.removed.length,2);
 const compact=nodes(renderChat(platform,true).tree);assert(!compact.some(n=>n.type==='ScrollView'&&n.props.horizontal));
});
test('Rider has one visible chat tab with a real icon and one hidden guest route',()=>{
 const file=ts.createSourceFile('layout.tsx',read('apps/rider-mobile/app/_layout.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let count=0,visible=0;
 function visit(node){if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(file)==='Tabs.Screen'){
 const name=node.attributes.properties.find(p=>p.name?.getText(file)==='name');
 if(name?.initializer?.text==='trip-chat'){count++;const options=node.attributes.properties.find(p=>p.name?.getText(file)==='options');if(/href: null/.test(options.getText(file)))assert.match(options.getText(file),/display: "none"/);else {visible++;assert.match(options.getText(file),/chatbubbles-outline/);}}}
 ts.forEachChild(node,visit);}
 visit(file);assert.equal(count,2);assert.equal(visible,1);
});
test('successful Rider booking navigates immediately, without waiting for an alert action',()=>{
 const source=read('apps/rider-mobile/app/booking.tsx'),start=source.indexOf('      const tripId =',source.indexOf('const res = await createTrip(payload)')),end=source.indexOf('    } catch (error: any)',start);
 for(const res of [{trip:{id:'trip-1'}},{tripId:'trip-2'},{data:{trip:{id:'trip-3'}}},{}]){
 let reset=0;const routes=[];new Function('res','router','resetFormAfterSuccess',compile(source.slice(start,end)))(res,{replace:r=>routes.push(r)},()=>reset++);
 assert.equal(reset,1);assert.equal(routes.length,1);const id=res.trip?.id||res.tripId||res.data?.trip.id;
 if(id)assert.deepEqual(routes[0],{pathname:'/trip-history',params:{focusTripId:id,justCreated:'1'}});else assert.equal(routes[0],'/trip-history');
 }
});
test('all mobile apps request Android resize and provide a vibrating chat channel',()=>{
 for(const app of ['rider','driver','admin']){
 assert.equal(JSON.parse(read(`apps/${app}-mobile/app.json`)).expo.android.softwareKeyboardLayoutMode,'resize');
 assert.match(read(`apps/${app}-mobile/services/tripChat.ts`),/trip_chat_default_v1.*enableVibrate:true,vibrationPattern:/);
 }
});

test('history focus waits for layout and includes the list offset',()=>{
 const source=read('apps/rider-mobile/app/trip-history.tsx');
 const start=source.indexOf('  useEffect(() => {\n    if (!focusTripId || !items.length');
 const end=source.indexOf('\n\n  const sortedItems',start);
 const code=compile(source.slice(start,end));
 for(const [focusCard,listTop,expected] of [[null,100,null],[{tripId:'old',y:300},100,null],[{tripId:'trip-1',y:300},null,null],[{tripId:'trip-1',y:300},100,388]]){
  const positions=[];let done=false;
  new Function('useEffect','focusTripId','items','didAutoFocus','focusCard','listTop','scrollViewRef','setTimeout','clearTimeout','setDidAutoFocus',code)(fn=>fn(),'trip-1',[{id:'trip-1'}],false,focusCard,listTop,{current:{scrollTo:p=>positions.push(p.y)}},fn=>{fn();return 1;},()=>{},v=>done=v);
  assert.deepEqual(positions,expected===null?[]:[expected]);assert.equal(done,expected!==null);
 }
});
