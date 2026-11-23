import test from 'node:test';
import assert from 'node:assert/strict';
import { createBookingQuoteService } from '../src/services/bookingQuotes.js';
const input={carType:'CAR_5',direction:'ONE_WAY',pickupTime:'2099-01-01T08:00:00+07:00',historyContext:{pickupAddress:'123 Đường A, Phường B, Thành phố Hồ Chí Minh',stops:['456 Đường C, Phường D, Tỉnh Tây Ninh']},distanceKm:1,driveMinutes:1};
function fixture(overrides={}){
 const details={'vietmap|a':{fullAddress:input.historyContext.pickupAddress,lat:10,lng:106},'vietmap|b':{fullAddress:input.historyContext.stops[0],lat:11,lng:107}};
 return createBookingQuoteService({knownPlace:()=>null,search:async address=>[{placeId:address===input.historyContext.pickupAddress?'vietmap|a':'vietmap|b',fullAddress:'Tên địa điểm trong danh sách gợi ý'}],detail:async id=>details[id],route:async coords=>{assert.deepEqual(coords,[{lat:10,lng:106},{lat:11,lng:107}]);return{distanceKm:100,durationMinutes:120,outboundDurationMinutes:120,returnDurationMinutes:0};},...overrides});
}
test('released Rider payload without place IDs resolves canonical detail addresses even when suggestion text differs',async()=>{
 const route=await fixture().verifiedRoute(input);assert.equal(route.distanceKm,100);assert.equal(route.driveMinutes,120);
});
test('released Rider can use the provider-verified selection registry when a repeated address search returns no exact prediction',async()=>{
 let searched=0;const service=fixture({knownPlace:address=>({fullAddress:address,lat:address===input.historyContext.pickupAddress?10:11,lng:address===input.historyContext.pickupAddress?106:107}),search:async()=>{searched++;return[];}});
 assert.equal((await service.verifiedRoute(input)).distanceKm,100);assert.equal(searched,0);
});
test('unverified legacy text still fails; client distance and coordinates are never accepted as a fallback',async()=>{
 await assert.rejects(fixture({search:async()=>[],knownPlace:()=>null}).verifiedRoute({...input,pickupLat:10,pickupLng:106}),{status:409});
});
test('raw legacy Goong IDs and prefixed IDs match the same server autocomplete result',async()=>{
 const points=[{placeId:'a',address:input.historyContext.pickupAddress},{placeId:'b',address:input.historyContext.stops[0]}];
 const service=fixture({search:async address=>[{placeId:address===points[0].address?'goong|a':'goong|b',fullAddress:address}],detail:async id=>id.includes('|')?{fullAddress:'Canonical provider address',lat:id.endsWith('a')?10:11,lng:id.endsWith('a')?106:107}:null});
 assert.equal((await service.verifiedRoute({...input,routePricingPoints:points})).distanceKm,100);
});
