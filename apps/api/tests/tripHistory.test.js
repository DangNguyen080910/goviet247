import * as vehiclePolicy from '../src/services/tripVehiclePolicy.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeTripEvent,recordTripEvent,tripChanges,mergeTripHistory,makeTripHistoryController} from '../src/services/tripHistory.js';
import {historyTime,vietnamDay,parseHistoryDateInput,historyActor} from '../src/shared/adminHistory.js';
import {availableTripWhere} from '../src/services/tripAcceptancePolicy.js';
const at = second => new Date(Date.UTC(2026,10,22,0,0,second));
const driver = {displayName:'Tên tài khoản',phones:[{e164:'+84900000001'}],driverProfile:{id:'profile-a',fullName:'Tài xế A'}};
const trip = {id:'trip',driverId:'a',walletHoldId:'trip:1',acceptedAt:at(1),driver};
const log = (id,kind,time,extras={}) => ({id,createdAt:at(time),actorRole:'DRIVER',actorUsername:'a',fromStatus:'PENDING',toStatus:'ACCEPTED',eventData:makeTripEvent(trip,{kind,...extras})});
const response = () => ({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}});

test('assignment evidence snapshots identity, assignment and actor before a trip is reassigned',()=>{
 const original=structuredClone(trip),event=makeTripEvent(original,{kind:'DRIVER_CANCELLED',actorId:5,reason:'Nhận nhầm',resolution:'REFUND_AND_REVIEW'});
 original.driverId='b';original.driver.driverProfile.fullName='Người khác';original.driver.phones[0].e164='changed';
 assert.equal(event.driverId,'a');assert.equal(event.driverName,'Tài xế A');assert.equal(event.driverPhone,'+84900000001');
 assert.equal(event.assignmentId,'trip:1');assert.equal(event.actorId,'5');assert.equal(event.acceptedAt,at(1).toISOString());
});

test('generic trip updates work before a driver is assigned and preserve long before/after text',()=>{
 const before={note:'cũ',pickupTime:at(1),totalPrice:100},after={note:'x'.repeat(2000),pickupTime:at(2),totalPrice:120};
 const changes=tripChanges(before,after,{note:'Ghi chú',pickupTime:'Giờ đón',totalPrice:'Giá'});
 assert.equal(changes.length,3);assert.equal(changes[0].after.length,2000);assert.equal(changes[1].before,at(1).toISOString());
 assert.equal(makeTripEvent({id:'trip'},{kind:'TRIP_UPDATED',changes}).changes.length,3);
 assert.deepEqual(tripChanges(before,before,{note:'Ghi chú'}),[]);
});

test('one current acceptance record replaces the three related wallet holds in the timeline',()=>{
 const wallets=['COMMISSION_HOLD','DRIVER_VAT_HOLD','DRIVER_PIT_HOLD'].map((type,index)=>({id:String(index),type,createdAt:at(1),walletHoldId:'trip:1',driverProfileId:'profile-a',driverProfile:{userId:'a',fullName:'Tài xế A'}}));
 const items=mergeTripHistory({trip,logs:[log('accept','ACCEPTED',1)],wallets});
 assert.equal(items.length,1);assert.equal(items[0].source,'RECORDED');
});

test('repeated assignments including the same driver keep each acceptance/cancellation',()=>{
 const first=log('one','ACCEPTED',1),cancel=log('two','DRIVER_CANCELLED',3),second=log('three','ACCEPTED',5);
 second.eventData.assignmentId='trip:3';
 const items=mergeTripHistory({trip:{...trip,walletHoldId:'trip:3',acceptedAt:at(5)},logs:[first,cancel,second]});
 assert.deepEqual(items.map(item=>item.id),['log:three','log:two','log:one']);
});

test('admin handling a driver cancellation stays distinct from a customer cancellation',()=>{
 const end=log('end','DRIVER_CANCELLED',3);end.actorRole='ADMIN';end.actorUsername='Điều phối';
 const customer=log('customer','CUSTOMER_CANCELLED',5);customer.actorRole='ADMIN';customer.actorUsername='Admin';
 const items=mergeTripHistory({trip:{id:'trip'},logs:[end,customer]});
 assert.equal(items[1].kind,'DRIVER_CANCELLED');assert.equal(items[1].actorRole,'ADMIN');
 assert.equal(historyActor(items[1]),'Admin · Điều phối');assert.equal(items[0].kind,'CUSTOMER_CANCELLED');
});

test('legacy penalty approval does not prove who pressed cancel; archived actor is not invented',()=>{
 const items=mergeTripHistory({trip:{id:'trip'},penalties:[{id:'p',driverId:'a',driverNameSnapshot:'Tên đã lưu',driverPhoneSnapshot:'0900000001',createdAt:at(3),approvedByAdminId:9}],
  archives:[{id:'archive',createdAt:at(3),text:'Kết thúc lượt tài xế a. Hội thoại phía trên được lưu riêng cho Admin. Lý do: Lý do cũ'}]});
 assert.equal(items.length,2);const penalty=items.find(item=>item.kind==='PENALTY_RECORDED');assert.equal(penalty.driverName,'Tên đã lưu');assert.equal(penalty.actorRole,null);
});

test('creation, approval, status, notes, finance and partner changes share one ordered timeline',()=>{
 const items=mergeTripHistory({trip:{id:'trip',createdAt:at(0)},logs:[
  {id:'state',fromStatus:'ACCEPTED',toStatus:'CONTACTED',createdAt:at(5),actorRole:'DRIVER',actorUsername:'a',note:'Đã liên hệ'},
  {id:'note',fromStatus:'PENDING',toStatus:'PENDING',createdAt:at(2),actorRole:'STAFF',actorUsername:'Staff',note:'Sửa giờ'},
 ],drivers:[{id:'a',driverProfile:{fullName:'Tài xế A'}}],wallets:[{id:'refund',type:'COMMISSION_REFUND',createdAt:at(6),amount:120,note:'Hoàn ví'}],partnerLogs:[{id:'partner',action:'ASSIGN_TRIP',actorLabel:'Điều phối đối tác',createdAt:at(4),detail:{from:'p1',to:'p2'}}]});
 assert.deepEqual(items.map(item=>item.kind),['WALLET_UPDATED','STATUS_CHANGED','PARTNER_UPDATED','TRIP_UPDATED','CREATED']);
 assert.equal(items[1].actorName,'Tài xế A');assert.equal(items[0].amount,120);assert.equal(items[2].changes[0].after,'p2');
});

test('creation and approval fallbacks do not duplicate their immutable records',()=>{
 const items=mergeTripHistory({trip:{id:'trip',createdAt:at(0),verifiedAt:at(2)},logs:[log('created','CREATED',0),log('approved','APPROVED',2)]});
 assert.equal(items.length,2);
});

test('zero-fee legacy assignment still appears from acceptedAt, without pretending wallet evidence exists',()=>{
 const items=mergeTripHistory({trip});assert.equal(items.length,1);assert.equal(items[0].source,'CURRENT_TRIP');assert.equal(items[0].createdAt,trip.acceptedAt);
});

test('history endpoint scopes every query to the requested trip and performs no writes',async()=>{
 const queries=[];
 const findMany=async args=>{queries.push(args);return [];};
 const db={trip:{findUnique:async ({where})=>{assert.equal(where.id,'trip');return {id:'trip'};}},adminTripActionLog:{findMany},driverWalletTransaction:{findMany},driverTripPenaltyLog:{findMany},tripChatMessage:{findMany}};
 const res=response();await makeTripHistoryController(db)({params:{id:'trip'}},res);
 assert.equal(res.statusCode,200);assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(res.body.items.length,0);
 for(const query of queries){assert.equal(query.where.tripId,'trip');assert.equal(query.take,501);}
});

test('missing trip and failed history reads are explicit errors, not a misleading empty success',async()=>{
 let res=response();await makeTripHistoryController({trip:{findUnique:async()=>null}})({params:{id:'missing'}},res);assert.equal(res.statusCode,404);
 res=response();await makeTripHistoryController({trip:{findUnique:async()=>{throw {code:'DB_UNAVAILABLE'};}}})({params:{id:'trip'}},res);assert.equal(res.statusCode,503);assert.equal(res.body.success,false);
 const route=readFileSync(new URL('../src/routes/admin.js',import.meta.url),'utf8');
 assert.match(route,/router\.get\("\/trips\/:id\/history", requireAdminOrStaff/);
});

test('Vietnam dates, full timestamps and date validation do not depend on the phone timezone',()=>{
 assert.equal(vietnamDay(0,Date.parse('2026-11-21T17:10:00Z')),'2026-11-22');
 assert.equal(parseHistoryDateInput('22/11/2026'),'2026-11-22');
 for(const value of ['31/02/2026','2026-11-22','99/11/2026'])assert.throws(()=>parseHistoryDateInput(value));
 assert.match(historyTime('2026-11-21T17:10:00Z'),/00:10/);assert.match(historyTime('2026-11-21T17:10:00Z'),/22\/11\/2026/);
});

function acceptanceFixture(failHistory=false,hold=100,vehicleType='CAR_5'){
 let state={trip:{carType:'CAR_5',fuelPreference:'ANY',id:'trip',status:'PENDING',isVerified:true,verifiedAt:at(0),version:0,totalPrice:1000},profile:{vehicleType,id:'profile-a',status:'VERIFIED',balance:500,fullName:'Tài xế A',user:{displayName:'A',phones:[{e164:'+84900000001'}]}},logs:[],wallets:[]};
 const prisma={$transaction:async callback=>{
  const draft=structuredClone(state);
  const tx={trip:{findUnique:async()=>draft.trip,update:async({data})=>{draft.trip={...draft.trip,...data,version:1};return draft.trip;}},
   driverProfile:{findUnique:async()=>draft.profile,update:async({data})=>{Object.assign(draft.profile,data);return draft.profile;}},
   driverWalletTransaction:{create:async({data})=>{draft.wallets.push(data);return data;}},
   adminTripActionLog:{create:async({data})=>{if(failHistory)throw Error('history write failure');draft.logs.push(data);return data;}},
  };
  const result=await callback(tx);state=draft;return result;
 }};
 const source=readFileSync(new URL('../src/controllers/tripController.js',import.meta.url),'utf8');
 const begin=source.indexOf('export async function acceptTrip('),end=source.indexOf('\n}',begin)+2;
 const deps={...vehiclePolicy,prisma,recordTripEvent,availableTripWhere,assertCurrentContractForNewTrip:async()=>{},getDriverConfigSnapshot:async()=>({maxActiveTrips:3}),
  lockDriverProfile:async()=>{},lockTrip:async()=>{},assertTripAcceptanceAllowed:()=>{},canDriverSeeTrip:()=>true,countDriverActiveTrips:async()=>0,
  calculateDriverFinanceSnapshot:()=>({requiredWalletAmount:hold,commissionAmount:hold,driverVatAmount:0,driverPitAmount:0}),createAcceptanceChatNotices:async()=>{},createRiderTripNotification:async()=>null,
  serializeDriverTrip:trip=>trip,sendAdminPushNotification:async()=>{},sendTripStatusChangedToRider:async()=>{},console:{log(){},error(){}}};
 const accept=new Function(...Object.keys(deps),source.slice(begin,end).replace('export ','')+';return acceptTrip;')(...Object.values(deps));
 return {get state(){return state;},accept};
}
for(const vehicleType of ['CAR_5','CAR_7','CAR_16'])for(const hold of [0,100])test(`actual acceptance of CAR_5 by ${vehicleType} records driver once, including ${hold} fee`,async()=>{
 const f=acceptanceFixture(false,hold,vehicleType),res=response();await f.accept({body:{tripId:'trip'},user:{id:'a'}},res);
 assert.equal(res.statusCode,200,JSON.stringify(res.body));assert.equal(f.state.logs.length,1);
 assert.equal(f.state.logs[0].eventData.driverName,'Tài xế A');assert.equal(f.state.logs[0].eventData.assignmentId,'trip:1');
 assert.equal(f.state.profile.balance,500-hold);assert.equal(f.state.trip.totalPrice,1000);assert.equal(f.state.trip.carType,'CAR_5');
});
test('audit write failure rolls back the acceptance and wallet debit together',async()=>{
 const f=acceptanceFixture(true),res=response();await f.accept({body:{tripId:'trip'},user:{id:'a'}},res);
 assert.equal(res.statusCode,400);assert.match(res.body.message,/history write failure/);assert.equal(f.state.trip.status,'PENDING');assert.equal(f.state.profile.balance,500);assert.equal(f.state.wallets.length,0);assert.equal(f.state.logs.length,0);
});
