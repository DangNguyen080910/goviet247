import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {chatConversationRoute} from '../apps/api/src/shared/chatTripDetail.js';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const compile=source=>ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const React={createElement:(type,props,...children)=>({type,props:props||{},children}),Fragment:'Fragment'};
function nodes(tree){if(tree==null||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return [tree,...nodes(tree.children)];}
function text(tree){if(tree==null)return '';if(Array.isArray(tree))return tree.map(text).join('');if(typeof tree!=='object')return String(tree);return text(tree.children);}
const conversation={tripId:'full-trip-CaseSensitive123',pickupAddress:'123 Nguyễn Huệ',dropoffAddress:'Sân bay Tân Sơn Nhất',unread:2,last:{senderLabel:'Người đặt chuyến',kind:'TEXT',text:'Tôi đang ra.'}};
function native(params={}) {
 const source=read('apps/mobile-chat/TripChat.tsx'),snippet=source.slice(source.indexOf('export default function TripChatScreen')).replace('export default function','function');
 const ast=ts.createSourceFile('chat.tsx',snippet,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),names=[];
 function visit(node){if(ts.isVariableDeclaration(node)&&ts.isArrayBindingPattern(node.name)&&node.initializer&&ts.isCallExpression(node.initializer)&&node.initializer.expression.getText(ast)==='useState')names.push(node.name.elements[0].name.getText(ast));ts.forEachChild(node,visit);}visit(ast);
 let index=0;const routes=[],requests=[],states=[];
 const deps={React,useIsFocused:()=>true,useLocalSearchParams:()=>params,useState:initial=>{const name=names[index++];return [name==='inbox'?[conversation]:initial,value=>states.push({name,value})];},useEffect(){},useCallback:fn=>fn,useRef:current=>({current}),Platform:{OS:'ios'},router:{push:value=>routes.push(value),back(){}},Keyboard:{dismiss(){}},blue:'#1976d2',ink:'#000',button:{},config:{role:'RIDER'},chatConversationRoute,api:async path=>{requests.push(path);return {trip:{id:conversation.tripId}};}};
 for(const name of ['SafeAreaView','KeyboardAvoidingView','View','Pressable','Text','TextInput','ScrollView','Modal','Image'])deps[name]=name;
 const screen=new Function(...Object.keys(deps),compile(snippet)+';return TripChatScreen;')(...Object.values(deps));
 return {tree:screen(),routes,requests,states};
}
test('mobile inbox row shows full code and route; card and message button both open chat, never trip details',()=>{
 const h=native(),all=nodes(h.tree);assert.ok(text(h.tree).includes(conversation.tripId));assert.ok(text(h.tree).includes(chatConversationRoute(conversation)));
 assert.ok(!all.some(node=>node.type==='Pressable'&&text(node)==='Xem chuyến'));
 const card=all.find(node=>node.props.key===conversation.tripId);assert.ok(card);card.props.onPress();
 let stopped=false;const action=all.find(node=>node.type==='Pressable'&&text(node)==='Xem tin nhắn');assert.ok(action);action.props.onPress({stopPropagation(){stopped=true;}});
 assert.equal(stopped,true);assert.deepEqual(h.routes,[`/trip-chat?tripId=${conversation.tripId}`,`/trip-chat?tripId=${conversation.tripId}`]);assert.deepEqual(h.requests,[]);
});
test('inside the mobile conversation Xem chuyến still fetches that trip rather than navigating to another chat',async()=>{
 const h=native({tripId:conversation.tripId}),button=nodes(h.tree).find(node=>node.type==='Pressable'&&text(node)==='Xem chuyến');assert.ok(button);button.props.onPress();await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(h.routes,[]);assert.deepEqual(h.requests,[`/${conversation.tripId}/trip`]);assert.ok(h.states.some(s=>s.name==='tripView'&&s.value.trip?.id===conversation.tripId));
});
test('web inbox message button and preview open the conversation; route remains visible',()=>{
 const source=read('apps/web/src/components/TripChatHub.jsx'),ast=ts.createSourceFile('chat.jsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let callback;
 function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='inbox.map')callback=node.arguments[0].getText(ast);ts.forEachChild(node,visit);}visit(ast);assert(callback);
 const opened=[],deps={React,Box:'Box',Button:'Button',Typography:'Typography',chatConversationRoute,setTripId:id=>opened.push(id),showTrip(){throw new Error('Inbox must not open trip details');}};
 const render=new Function(...Object.keys(deps),compile('const render='+callback+';')+';return render;')(...Object.values(deps)),tree=render(conversation),all=nodes(tree);
 assert.ok(text(tree).includes(chatConversationRoute(conversation)));assert.ok(!all.some(node=>node.type==='Button'&&text(node)==='Xem chuyến'));
 const buttons=all.filter(node=>node.type==='Button');assert.equal(buttons.length,2);for(const button of buttons)button.props.onClick();assert.deepEqual(opened,[conversation.tripId,conversation.tripId]);
});
test('old API responses without addresses still render a working inbox and no invented route',()=>{
 assert.equal(chatConversationRoute({tripId:'old-client'}),'');assert.equal(chatConversationRoute({pickupAddress:' A ',dropoffAddress:' B '}),'A → B');
});

test('inbox API includes route from the authorized trip, preserving code and message preview',()=>{
 const source=read('apps/api/src/routes/tripChat.js'),ast=ts.createSourceFile('chat.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let object;
 function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='items.push'&&node.arguments[0]&&ts.isObjectLiteralExpression(node.arguments[0]))object=node.arguments[0].getText(ast);ts.forEachChild(node,visit);}visit(ast);assert(object);
 const deps={trip:{id:'full-code',status:'ACCEPTED',pickupAddress:'stale',dropoffAddress:'stale'},authorizedTrip:{pickupAddress:'Current pickup',dropoffAddress:'Current destination'},unread:2,last:{text:'Message preview'},chatMessageForClient:value=>value,req:{query:{media:'images'}},chatCanSend:()=>true,a:{role:'RIDER'}};
 const result=new Function(...Object.keys(deps),`return (${object});`)(...Object.values(deps));
 assert.equal(result.tripId,'full-code');assert.equal(chatConversationRoute(result),'Current pickup → Current destination');assert.equal(result.last.text,'Message preview');assert.equal(result.unread,2);
});
