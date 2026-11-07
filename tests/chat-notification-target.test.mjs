import {chatVisibleFrom} from '../apps/api/src/shared/chatAssignmentHistory.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {chatNotificationRoute,claimNotificationResponse} from '../apps/api/src/shared/chatNotificationNavigation.js';
test('message and missed call taps retain exact trip, message, and call identifiers',()=>{
 const data={type:'TRIP_CALL_MISSED',tripId:'trip/a',messageId:'message+42',callId:'call-1'};
 const url=new URL(chatNotificationRoute(data),'https://example.test');
 assert.equal(url.pathname,'/trip-chat');assert.equal(url.searchParams.get('tripId'),data.tripId);assert.equal(url.searchParams.get('messageId'),data.messageId);assert.equal(url.searchParams.get('callId'),data.callId);
 assert.equal(chatNotificationRoute({type:'TRIP_CHAT',tripId:'trip1',messageId:'m1'}),'/trip-chat?tripId=trip1&messageId=m1');
 assert.equal(chatNotificationRoute({type:'SYSTEM_NOTIFICATION',tripId:'trip1'}),null);
});
test('cold-start response and live listener cannot navigate twice for one tap',()=>{
 const response={notification:{request:{identifier:'unique-target-test'}},actionIdentifier:'default'};
 assert.equal(claimNotificationResponse(null),false);assert.equal(claimNotificationResponse(response,1000),true);assert.equal(claimNotificationResponse(response,1001),false);
 assert.equal(claimNotificationResponse(response,5000),true,'a later intentional tap can reopen the same notification');
 assert.equal(claimNotificationResponse({...response,notification:{request:{identifier:'unique-target-test2'}}}),true);
});
const source=readFileSync(new URL('../apps/api/src/routes/tripChat.js',import.meta.url),'utf8');
const ast=ts.createSourceFile('routes.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let handler;
function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='router.get'&&node.arguments[0]?.text==='/:tripId/messages')handler=node.arguments[1].arguments[0].getText(ast);ts.forEachChild(node,visit);}visit(ast);
async function page(query){
 const all=Array.from({length:125},(_,i)=>({id:`m${String(i).padStart(3,'0')}`,createdAt:new Date(i*1000),tripId:'trip1',audience:'ALL'}));
 let queried=false;const prisma={tripChatMessage:{
  findFirst:async({where})=>all.find(m=>m.id===where.id&&where.tripId===m.tripId)||null,
  findMany:async({where,orderBy,take})=>{if(where.deletedAt)return [];queried=true;const cursor=where.AND[1];let rows=all.filter(m=>!cursor||cursor.OR.some(c=>{
    if(c.createdAt?.lt)return m.createdAt<c.createdAt.lt;if(c.createdAt?.gt)return m.createdAt>c.createdAt.gt;
    return +m.createdAt===+c.createdAt&&(c.id.lte?m.id<=c.id.lte:c.id.gt?m.id>c.id.gt:m.id<c.id.lt);
  }));if(orderBy[0].createdAt==='desc')rows.reverse();return rows.slice(0,take);}
 }};
 const deps={prisma,chatVisibleFrom,chatAccess:async()=>({id:'trip1',status:'ACCEPTED'}),messageWhere:()=>({tripId:'trip1',audience:'ALL'}),fields:{},chatMessageForClient:m=>m,chatHeartsForClient:m=>m,chatCanSend:()=>true,CHAT_QUICK_REPLIES:{RIDER:[]}};
 const fn=new Function(...Object.keys(deps),`return (${handler});`)(...Object.values(deps));
 let status=200,result;const res={status:n=>{status=n;return res;},set:()=>res,json:x=>{result=x;return res;}};
 await fn({chatActor:{role:'RIDER'},params:{tripId:'trip1'},query},res);return{status,result,queried};
}
test('target outside the newest 50 is fetched inclusively, with older pagination intact',async()=>{
 const {result}=await page({around:'m030'});assert.equal(result.items.at(-1).id,'m030');assert.equal(result.items[0].id,'m000');
 const older=await page({before:'m030'});assert.equal(older.result.items.at(-1).id,'m029');
});
test('forward polling backfills each next page without skipping messages after an old target',async()=>{
 const one=await page({after:'m030'});assert.equal(one.result.items[0].id,'m031');assert.equal(one.result.items.at(-1).id,'m080');assert.equal(one.result.hasMore,true);
 const two=await page({after:'m080'});assert.equal(two.result.items[0].id,'m081');assert.equal(two.result.items.at(-1).id,'m124');assert.equal(two.result.hasMore,false);
});
test('missing or inaccessible target cannot be used as a cursor',async()=>{
 const result=await page({around:'private-other-trip'});assert.equal(result.status,400);assert.equal(result.queried,false);
});
