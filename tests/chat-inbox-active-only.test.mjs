import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {isRiderChatEnded,chatCanSend} from '../apps/api/src/shared/tripChat.js';
const source=fs.readFileSync(new URL('../apps/api/src/routes/tripChat.js',import.meta.url),'utf8'),ast=ts.createSourceFile('chat.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let callback;
function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='router.get'&&node.arguments[0]?.text==='/conversations')callback=node.arguments[1].arguments[0].getText(ast);ts.forEachChild(node,visit);}visit(ast);assert(callback);
async function inbox(role,listed,actual=listed){
 let query;const touched=[];const db={trip:{findMany:async args=>{query=args;return listed;}},tripChatRead:{findUnique:async()=>null},tripChatMessage:{count:async({where})=>{touched.push(where.tripId);return 2;},findFirst:async({where})=>({id:'message-'+where.tripId,createdAt:'2026-11-03T00:00:00Z',text:'test'})}};
 const deps={fields:{},prisma:db,chatTripWhere:async()=>({scope:role}),chatAccess:async(db,id)=>actual.find(t=>t.id===id),isRiderChatEnded,messageWhere:trip=>({tripId:trip.id}),chatCanSend,chatMessageForClient:m=>m};
 const js=ts.transpileModule('const handler='+callback+';',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
 const handler=new Function(...Object.keys(deps),js+';return handler;')(...Object.values(deps));let body;await handler({chatActor:{id:'actor',role},query:{}},{json:value=>{body=value;}});return {body,query,touched};
}
const trip=(id,status)=>({id,status,driverId:'actor',pickupAddress:'A',dropoffAddress:'B'});
for(const role of ['ADMIN','RIDER','DRIVER','PARTNER'])test(`${role}: terminal trips disappear from inbox and unread totals`,async()=>{
 const result=await inbox(role,[trip('active','ACCEPTED'),trip('completed','COMPLETED'),trip('cancelled','CANCELLED')]);
 assert.deepEqual(result.body.items.map(item=>item.tripId),['active']);assert.equal(result.body.unread,2);assert.deepEqual(result.touched,['active']);
 assert.ok(result.query.where.AND.some(where=>where.status?.notIn?.includes('COMPLETED')&&where.status.notIn.includes('CANCELLED')));assert.equal(result.query.take,200);
});
test('an Admin inbox with only archived trips is empty with zero unread',async()=>{
 const result=await inbox('ADMIN',[trip('done','COMPLETED'),trip('cancelled','CANCELLED')]);assert.deepEqual(result.body.items,[]);assert.equal(result.body.unread,0);assert.deepEqual(result.touched,[]);
});
test('a trip finishing between list lookup and permission lookup cannot leak back into Admin inbox',async()=>{
 const result=await inbox('ADMIN',[trip('racing','ACCEPTED')],[trip('racing','COMPLETED')]);assert.deepEqual(result.body.items,[]);assert.equal(result.body.unread,0);
});
