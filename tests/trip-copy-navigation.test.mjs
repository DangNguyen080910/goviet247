import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from '../node_modules/typescript/lib/typescript.js';
import {tripNotificationContent} from '../apps/api/src/shared/tripNotificationContent.js';
import {tripCallActionLabel} from '../apps/api/src/shared/tripCallLabels.js';
function sourceFunction(file,name,bindings) {
 const source=readFileSync(new URL(file,import.meta.url),'utf8');
 const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
 let found;function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text===name)found=node;ts.forEachChild(node,visit);}visit(tree);
 assert.ok(found,`${name} exists`);
 return new Function(...Object.keys(bindings),`${found.getText(tree)}; return ${name};`)(...Object.values(bindings));
}
function booking(partner=null){const calls=[];const finish=sourceFunction('../apps/web/src/components/customer/BookingCard.jsx','finishCreatedTrip',{partner,resetFormAfterSuccess:()=>calls.push('reset'),navigate:(...args)=>calls.push(args)});return{calls,finish};}
test('customer booking goes directly to its exact trip, preserving success state',()=>{
 const {calls,finish}=booking();finish('trip/a');assert.equal(calls[0],'reset');
 assert.deepEqual(calls[1],['/ho-so?focusTripId=trip%2Fa&justCreated=1',{replace:true,state:{focusTripId:'trip/a',justCreated:true}}]);
});
test('partner booking opens the new trip detail even outside the visible list page',()=>{
 const {calls,finish}=booking({successPath:'/chuyen-xe'});finish('trip-2');assert.equal(calls[1][0],'/chuyen-xe/trip-2');
});
test('embedded Admin booking delegates opening detail without navigating away from company',()=>{
 let opened;const {calls,finish}=booking({onCreated:id=>opened=id});finish('trip-3');assert.equal(opened,'trip-3');assert.deepEqual(calls,['reset']);
});
test('CONTACTED realtime event says contact confirmed instead of announcing acceptance again',()=>{
 const change=sourceFunction('../apps/web/src/pages/customer/CustomerProfile.jsx','getTripRealtimeChangeInfo',{tripNotificationContent});
 assert.equal(change(null,{id:'trip1',status:'ACCEPTED'}),null);
 const got=change({id:'trip1',status:'ACCEPTED'},{id:'trip1',status:'CONTACTED'});
 assert.equal(got.message,tripNotificationContent({id:'trip1',status:'CONTACTED'}).message);
 assert.match(got.message,/xác nhận liên hệ/);assert.doesNotMatch(got.message,/đã có tài xế nhận/);
 assert.equal(change({id:'trip1',status:'CONTACTED'},{id:'trip1',status:'CONTACTED'}),null);
});
test('status copy normalizes legacy cancellation and directs acceptance to trip chat',()=>{
 assert.deepEqual(tripNotificationContent({id:'trip1',status:' canceled '}),tripNotificationContent({id:'trip1',status:'CANCELLED'}));
 assert.match(tripNotificationContent({status:'ACCEPTED'}).message,/Liên hệ chuyến/);
 assert.match(tripNotificationContent({status:'PENDING'},' admin_verify_trip ').message,/tìm tài xế/);
 assert.doesNotMatch(tripNotificationContent({status:'IN_PROGRESS'}).message,/đón bạn/);
});
test('call label follows actual passenger, assigned dispatcher, or driver',()=>{
 assert.equal(tripCallActionLabel('Hành khách'),'Gọi khách');
 assert.equal(tripCallActionLabel('Điều phối viên'),'Gọi điều phối');
 assert.equal(tripCallActionLabel('Tài xế'),'Gọi tài xế');
});
