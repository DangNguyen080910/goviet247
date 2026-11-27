import test from 'node:test';
import assert from 'node:assert/strict';
import {chatTripSummary,chatTripDetailRows} from '../apps/api/src/shared/chatTripDetail.js';
const trip={id:'cmw-full-caseSensitive-TripCode123',status:'COMPLETED',isVerified:true,pickupAddress:'Start',dropoffAddress:'Last stop',pickupTime:'2026-11-03T07:00:00Z',direction:'ROUND_TRIP',carType:'CAR_7',distanceKm:123.4,totalPrice:500000,partnerCompanyName:'OT',riderPhone:'secret-phone',partnerManagerPhone:'secret-manager',dispatcherNote:'private',driverId:'private-driver',acceptedAt:'private'};
test('read-only chat trip summary preserves complete id and never serializes contacts/internal fields',()=>{
 const summary=chatTripSummary(trip,[{address:'Middle',seq:1},{address:'Last stop',seq:2}]);
 assert.equal(summary.id,trip.id);assert.equal(summary.stops.length,2);
 for(const field of ['riderPhone','partnerManagerPhone','dispatcherNote','driverId','acceptedAt'])assert.equal(Object.hasOwn(summary,field),false);
 assert.equal(JSON.stringify(summary).includes('secret'),false);
});
test('trip details include all stops, return leg, schedule, state and full code independent of list pagination',()=>{
 const rows=chatTripDetailRows(chatTripSummary(trip,[{address:'Middle'},{address:'Last stop'}]));
 assert.equal(rows[0][1],trip.id);assert.ok(rows.some(([label,value])=>label==='Trạng thái'&&value==='Hoàn thành'));
 assert.deepEqual(rows.filter(([label])=>label.startsWith('Điểm')||label.startsWith('Quay')).map(([,value])=>value),['Start','Middle','Last stop','Start']);
 assert.ok(rows.some(([label])=>label==='Giờ đón'));assert.ok(rows.some(([label])=>label==='Giá chuyến'));
});
test('pending display distinguishes awaiting approval from awaiting a driver',()=>{
 const rows=verified=>chatTripDetailRows({...trip,status:'PENDING',isVerified:verified});
 assert.equal(rows(false)[1][1],'Chờ duyệt');assert.equal(rows(true)[1][1],'Chờ tài xế nhận');
});

test('chat strips distance at the API boundary and hides it even for an older server response',()=>{
 const summary=chatTripSummary(trip,[]);
 assert.equal(Object.hasOwn(summary,'distanceKm'),false);
 for(const data of [summary,trip]) {
  const rows=chatTripDetailRows(data);
  assert.equal(rows.some(([label])=>label==='Quãng đường'),false);
  assert.equal(JSON.stringify(rows).includes('123,4'),false);
 }
});

test('chat trip preserves pickup order and shows return drop-offs in reverse', () => {
 const stops = [
  {seq:-2,address:'Pickup B',internalNote:'private'},
  {seq:-1,address:'Pickup C'},
  {seq:1,address:'Last stop'},
 ];
 const summary = chatTripSummary(trip,stops);
 assert.deepEqual(summary.stops.map(stop=>stop.seq),[-2,-1,1]);
 assert.equal(Object.hasOwn(summary.stops[0],'internalNote'),false);
 const rows=chatTripDetailRows(summary);
 assert.deepEqual(rows.filter(([label])=>label.startsWith('Điểm') || label.startsWith('Trả tại')),[
  ['Điểm đón 1','Start'],['Điểm đón 2','Pickup B'],['Điểm đón 3','Pickup C'],
  ['Điểm đến 1','Last stop'],
  ['Trả tại điểm đón 3','Pickup C'],['Trả tại điểm đón 2','Pickup B'],['Trả tại điểm đón 1','Start'],
 ]);
});
