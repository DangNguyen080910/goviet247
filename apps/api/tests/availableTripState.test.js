import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AvailableTripState, confirmsTripUnavailable } from '../src/shared/availableTripState.js';

const trip = { id: 'trip-1', status: 'PENDING' };
const event = { tripId: trip.id, toStatus: 'ACCEPTED', driverId: 'other-driver' };

test('acceptance blocks further taps immediately, before any HTTP response', () => {
  const state = new AvailableTripState();
  assert.equal(state.handleEvent(event), trip.id);
  assert.equal(state.canAccept(trip.id), false);
  assert.equal(state.canAccept('unrelated'), true);
});

test('an in-flight list cannot restore an accepted or cancelled trip', () => {
  for (const status of ['ACCEPTED', 'CONTACTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']) {
    const state = new AvailableTripState();
    const request = state.beginRequest();
    state.handleEvent({ tripId: trip.id, toStatus: status });
    assert.equal(state.applySnapshot(request, [trip]), null);
    assert.deepEqual(state.applySnapshot(state.beginRequest(), []), []);
    assert.equal(state.canAccept(trip.id), false);
  }
});

test('a slower older refresh cannot overwrite a newer response', () => {
  const state = new AvailableTripState();
  const older = state.beginRequest();
  const newer = state.beginRequest();
  assert.deepEqual(state.applySnapshot(newer, []), []);
  assert.equal(state.applySnapshot(older, [trip]), null);
});

test('returned trips reopen only after a fresh authoritative response', () => {
  const state = new AvailableTripState();
  state.handleEvent(event);
  const beforeReturn = state.beginRequest();
  assert.equal(state.handleEvent({ tripId: trip.id, toStatus: 'PENDING', driverId: null }), null);
  assert.equal(state.canAccept(trip.id), false);
  assert.equal(state.applySnapshot(beforeReturn, []), null);
  assert.deepEqual(state.applySnapshot(state.beginRequest(), [trip]), [trip]);
  assert.equal(state.canAccept(trip.id), true);
});

test('fresh response on reconnect recovers a missed trip-return event', () => {
  const state = new AvailableTripState();
  state.handleEvent(event);
  assert.deepEqual(state.applySnapshot(state.beginRequest(), [trip]), [trip]);
  assert.equal(state.canAccept(trip.id), true);
});

test('new trips and note-only events do not remove valid cards', () => {
  const state = new AvailableTripState();
  for (const payload of [undefined, {}, { id: trip.id, status: 'PENDING' }, { tripId: trip.id, reason: 'dispatcher_note_updated' }]) {
    assert.equal(state.handleEvent(payload), null);
    assert.equal(state.canAccept(trip.id), true);
  }
  assert.equal(state.handleEvent({ id: trip.id, status: 'CANCELLED' }), trip.id);
});

test('confirmed accept results invalidate old refreshes; uncertain failures do not hide trips', () => {
  const state = new AvailableTripState();
  const request = state.beginRequest();
  state.markUnavailable(trip.id);
  assert.equal(state.applySnapshot(request, [trip]), null);
  for (const code of ['TRIP_ALREADY_ACCEPTED', 'TRIP_ALREADY_YOURS', 'TRIP_CANCELLED', 'TRIP_NOT_FOUND', 'TRIP_NOT_AVAILABLE']) {
    assert.equal(confirmsTripUnavailable({ code }), true);
  }
  for (const code of ['NETWORK_UNCONFIRMED', 'INSUFFICIENT_BALANCE', 'ACTIVE_TRIP_LIMIT', 'AUTH_REQUIRED', 'TRIP_NOT_OPEN', 'TRIP_CHANGED']) {
    assert.equal(confirmsTripUnavailable({ code }), false);
  }
});

// Exercise the actual dashboard callbacks with a deliberately stalled network.
const dashboard = readFileSync(new URL('../../driver-mobile/app/dashboard.tsx', import.meta.url), 'utf8');
const availableLoader = dashboard.slice(dashboard.indexOf('  const loadAvailableTrips ='), dashboard.indexOf('  const loadMyTrips ='));
const changedHandler = dashboard.slice(dashboard.indexOf('        socket.on("trip:changed"'), dashboard.indexOf('        socket.on("admin:dashboard_changed"'));

test('dashboard removes the card before reload finishes, and rejects a late pre-event response', async () => {
  let cards = [trip, { id: 'unrelated', status: 'PENDING' }];
  const stateRef = { current: new AvailableTripState() };
  let finishOldRequest;
  const oldResponse = new Promise(resolve => { finishOldRequest = resolve; });
  const setCards = next => { cards = typeof next === 'function' ? next(cards) : next; };
  const loader = new Function('useCallback', 'availableTripStateRef', 'getAvailableTrips', 'setAvailableTrips', 'setAvailableError', 'setLoadingAvailable', `${availableLoader}; return loadAvailableTrips;`)(fn => fn, stateRef, () => oldResponse, setCards, () => {}, () => {});
  let listener;
  let finishRefresh;
  const refresh = new Promise(resolve => { finishRefresh = resolve; });
  new Function('socket', 'availableTripStateRef', 'setAvailableTrips', 'reloadTripsFromRealtime', 'appStateRef', 'playTripChangedNotify', changedHandler)(
    { on: (_, fn) => { listener = fn; } }, stateRef, setCards, () => refresh, { current: 'active' }, () => {},
  );
  const oldLoad = loader();
  const handlingEvent = listener(event);
  assert.deepEqual(cards.map(card => card.id), ['unrelated']);
  assert.equal(stateRef.current.canAccept(trip.id), false);
  finishOldRequest([trip]);
  await oldLoad;
  assert.deepEqual(cards.map(card => card.id), ['unrelated']);
  finishRefresh();
  await handlingEvent;
});

const acceptHandlerSource = dashboard.slice(dashboard.indexOf('  const handleAcceptTrip ='), dashboard.indexOf('  const handleConfirmStatusChange ='))
  .replace('async (tripId: string)', 'async (tripId)')
  .replace('catch (error: any)', 'catch (error)');
function acceptanceFixture(accept) {
  let cards = [trip];
  let calls = 0;
  const state = new AvailableTripState();
  const handler = new Function('deps', `const {useCallback, availableTrips, availableTripStateRef, acceptingTripRef, getAcceptLockRemainingSeconds, setAcceptingTripId, acceptDriverTrip, setAvailableTrips, loadAvailableTrips, loadMyTrips, setActiveTab, showSuccess, confirmsTripUnavailable, tripAcceptFeedback, showTripAcceptError} = deps; ${acceptHandlerSource}; return handleAcceptTrip;`)({
    useCallback: fn => fn, availableTrips: cards, availableTripStateRef: { current: state }, acceptingTripRef: { current: null },
    getAcceptLockRemainingSeconds: () => 0, setAcceptingTripId: () => {},
    acceptDriverTrip: async () => { ++calls; return accept(); },
    setAvailableTrips: next => { cards = typeof next === 'function' ? next(cards) : next; },
    loadAvailableTrips: async () => {}, loadMyTrips: async () => {}, setActiveTab: () => {}, showSuccess: () => {},
    confirmsTripUnavailable, tripAcceptFeedback: () => 'failure', showTripAcceptError: () => {},
  });
  return { handler, state, cards: () => cards, calls: () => calls };
}

test('rapid repeated taps send only one acceptance request', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const f = acceptanceFixture(() => pending);
  const first = f.handler(trip.id);
  await f.handler(trip.id);
  assert.equal(f.calls(), 1);
  finish();
  await first;
  assert.deepEqual(f.cards(), []);
  await f.handler(trip.id); // Even the pre-render handler must reject this tap.
  assert.equal(f.calls(), 1);
});

test('another driver acceptance removes the card and stops repeated requests after an error', async () => {
  const f = acceptanceFixture(() => { throw { code: 'TRIP_ALREADY_ACCEPTED' }; });
  await f.handler(trip.id);
  assert.deepEqual(f.cards(), []);
  await f.handler(trip.id);
  assert.equal(f.calls(), 1);
});

test('an uncertain network error keeps the trip and releases the tap lock', async () => {
  const f = acceptanceFixture(() => { throw { code: 'NETWORK_UNCONFIRMED' }; });
  await f.handler(trip.id);
  assert.deepEqual(f.cards(), [trip]);
  assert.equal(f.state.canAccept(trip.id), true);
  await f.handler(trip.id);
  assert.equal(f.calls(), 2);
});
