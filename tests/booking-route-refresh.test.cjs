const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const pickup = { placeId: 'pickup', lat: 10, lng: 106 };
const a = { placeId: 'a', lat: 11, lng: 107 };
const b = { placeId: 'b', lat: 12, lng: 108 };
const deferred = () => { let resolve, reject; const promise = new Promise((r,j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };
function source(mobile) { return fs.readFileSync(path.join(root, mobile ? 'apps/rider-mobile/app/booking.tsx' : 'apps/web/src/components/customer/BookingCard.jsx'), 'utf8'); }
function routeHarness(mobile, getRoute) {
  const text = source(mobile);
  const start = text.indexOf(mobile ? '  async function refreshRouteFromPlaces' : '  const refreshRouteFromPlaces');
  const end = text.indexOf(mobile ? '  async function handleSelectPickupOption' : '  const resetFormAfterSuccess', start);
  const state = {};
  const deps = { getRoute, latestRouteRequestRef: { current: 0 }, routeInputKeyRef: { current: 'old' }, setToast() {}, Alert: { alert() {} } };
  for (const name of ['DistanceKm', 'DriveMinutes', 'OutboundDriveMinutes', 'ReturnDriveMinutes', 'IsRouteLoading', 'RouteReadyKey']) deps['set' + name] = value => { state[name] = value; };
  deps.resetRouteState = () => { for (const name of ['DistanceKm','DriveMinutes','OutboundDriveMinutes','ReturnDriveMinutes']) state[name] = ''; };
  const js = ts.transpileModule(text.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const refresh = new Function(...Object.keys(deps), js + ';return refreshRouteFromPlaces;')(...Object.values(deps));
  return { state, deps, refresh };
}
for (const mobile of [false, true]) {
 const label = mobile ? 'Mobile' : 'Web';
 test(label + ': deleting an intermediate/final stop sends only the remaining points', async () => {
   const calls = [];
   const h = routeHarness(mobile, async points => { calls.push(points); return { distanceKm: points.length * 10, durationMinutes: points.length * 20 }; });
   await h.refresh(pickup, [a,b], ['A','B'], 'ONE_WAY'); assert.equal(h.state.DistanceKm, '30');
   h.deps.routeInputKeyRef.current = 'removed';
   await h.refresh(pickup, [b], ['B'], 'ONE_WAY'); assert.equal(h.state.DistanceKm, '20');
   assert.deepEqual(calls[1], [{lat:10,lng:106},{lat:12,lng:108}]);
   await h.refresh(pickup, [a], ['A'], 'ROUND_TRIP');
   assert.deepEqual(calls[2], [{lat:10,lng:106},{lat:11,lng:107},{lat:10,lng:106}]);
   assert.match(source(mobile), /\[pickupPlace, stopPlaces, stops, direction\]/);
 });
 test(label + ': delayed old route cannot restore distance after a newer route', async () => {
   const old = deferred(), fresh = deferred(); let count = 0;
   const h = routeHarness(mobile, () => ++count === 1 ? old.promise : fresh.promise);
   const first = h.refresh(pickup,[a,b],['A','B'],'ONE_WAY');
   h.deps.routeInputKeyRef.current = 'new';
   const second = h.refresh(pickup,[b],['B'],'ONE_WAY');
   fresh.resolve({distanceKm:80,durationMinutes:90}); await second;
   old.resolve({distanceKm:112.2,durationMinutes:109}); await first;
   assert.equal(h.state.DistanceKm,'80'); assert.equal(h.state.RouteReadyKey,'new');
 });
 test(label + ': invalid/failed route clears old distance and cannot remain ready', async () => {
   let fail = false, calls = 0;
   const h = routeHarness(mobile, async () => { calls++; if(fail) throw Error('network'); return {distanceKm:100,durationMinutes:120}; });
   await h.refresh(pickup,[a],['A'],'ONE_WAY');
   h.deps.routeInputKeyRef.current = 'blank'; await h.refresh(pickup,[null],[''],'ONE_WAY');
   assert.equal(h.state.DistanceKm,''); assert.equal(h.state.RouteReadyKey,''); assert.equal(calls,1);
   fail=true; h.deps.routeInputKeyRef.current='failure'; await h.refresh(pickup,[b],['B'],'ONE_WAY',{silent:true});
   assert.equal(h.state.DistanceKm,''); assert.equal(h.state.RouteReadyKey,'');
 });
 test(label + ': late quote after editing the itinerary is ignored', async () => {
   const text=source(mobile), start=text.indexOf(mobile ? '  async function handleEstimate()' : '  const handleEstimate =');
   const end=text.indexOf(mobile ? '  async function handleCreateTrip()' : '  const buildTripPayload',start);
   const pending=deferred(); let quoted=false, requested=false;
   const deps={destinationServiceDates:[],serviceAnchor:'B',pickupPlace:{fullAddress:'A'},pickupAddress:'A',stops:['B'],stopPlaces:[{fullAddress:'B'}],riderName:'Test',riderPhone:'0900000000',canEstimate:true,isEstimating:false,hasValidPickupSelection:true,hasAtLeastOneSelectedStop:true,hasValidStopSelections:true,isPickupTimeValid:true,isReturnTimeValid:true,isDistanceValid:true,isPickupTimeInPast:false,pickupTime:'2099-01-01T08:00',pickupTimeConfirmed:true,pickupPeriod:'AM',returnPeriod:'AM',direction:'ONE_WAY',carType:'CAR_5',fuelPreference:'ANY',distanceKm:'100',driveMinutes:'120',outboundDriveMinutes:'120',pickupDate:new Date(),pickupTimeOnly:'08:00',combineDateTime:()=>'',toIsoFromDatetimeLocal:()=>'',setIsEstimating(){},setSubmitTouched(){},setToast(){},Alert:{alert(){}},quotePrice:()=>{ requested=true; return pending.promise; },quoteInputKeyRef:{current:'old'},setQuote(){quoted=true;}};
   const js=ts.transpileModule(text.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
   const estimate=new Function(...Object.keys(deps),js+';return handleEstimate;')(...Object.values(deps));
   const work=estimate(); assert.equal(requested,true); deps.quoteInputKeyRef.current='edited';pending.resolve({finalPrice:790000});await work;assert.equal(quoted,false);
 });
}
