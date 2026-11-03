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
