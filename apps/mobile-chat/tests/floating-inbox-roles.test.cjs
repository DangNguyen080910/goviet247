const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../TripChat.tsx'),'utf8');
const start=source.indexOf('export function ChatInboxBadge('),end=source.indexOf('\ntype Msg =',start);
const snippet=source.slice(start,end).replace('export function','function');
const code=ts.transpileModule(snippet,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2020}}).outputText;
function render(role,inline=false){
 let state=0;const calls=[];
 const component=new Function('React','useState','useRef','useEffect','usePathname','config','Pressable','Text','DraggableFloatingAction','router','blue',code+';return ChatInboxBadge;')(
  {createElement:(type,props,...children)=>({type,props:props||{},children})},()=>[state++===0?3:true,()=>{}],v=>({current:v}),()=>{},()=>'/dashboard',{role},'Pressable','Text','DraggableFloatingAction',{push:path=>calls.push(path)},'#2563eb');
 return{tree:component({inline}),calls};
}
test('driver floating inbox uses draggable control and its own saved position',()=>{
 const {tree,calls}=render('DRIVER');assert.equal(tree.type,'DraggableFloatingAction');assert.equal(tree.props.storageKey,'goviet247_driver_inbox_position_v1');
 const button=tree.children[0];assert.match(button.props.accessibilityLabel,/có thể kéo/);button.props.onPress();assert.deepEqual(calls,['/trip-chat']);
});
test('admin floating inbox keeps its existing saved position',()=>{
 const {tree}=render('ADMIN');assert.equal(tree.type,'DraggableFloatingAction');assert.equal(tree.props.storageKey,'goviet247_admin_inbox_position_v1');
});
test('inline driver inbox and rider inbox remain ordinary buttons',()=>{
 for(const [role,inline] of [['DRIVER',true],['ADMIN',true],['RIDER',false]]){
  const {tree}=render(role,inline);assert.equal(tree.type,'Pressable');assert.doesNotMatch(tree.props.accessibilityLabel,/có thể kéo/);
 }
});
