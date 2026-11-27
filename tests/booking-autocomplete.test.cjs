const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../apps/rider-mobile/app/booking.tsx'), 'utf8');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function harness(stops) {
  const endMarker = stops ? '  }, [stops, stopPlaces, activeStopIndex, gpsLocation?.lat, gpsLocation?.lng]);' : '  }, [pickupAddress, gpsLocation?.lat, gpsLocation?.lng]);';
  const end = source.indexOf(endMarker) + endMarker.length;
  const start = source.lastIndexOf('  useEffect(() => {', end);
  assert.ok(start >= 0 && end > start);
  const js = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const timers = new Map(), requests = [], state = { options: stops ? [[]] : [], visible: false, loading: false };
  let timerId = 0, cleanup;
  const set = key => value => { state[key] = typeof value === 'function' ? value(state[key]) : value; };
  const deps = {
    useEffect: fn => { cleanup = fn(); }, gpsLocation: undefined, pickupSearchTimerRef: { current: null },
    stopSearchTimersRef: { current: {} }, suppressPickupSearchRef: { current: false }, suppressStopSearchMapRef: { current: {} },
    autocompleteCacheRef: { current: new Map() }, buildAutocompleteCacheKey: keyword => keyword,
    searchPlaces: keyword => { const d = deferred(); requests.push({ keyword, ...d }); return d.promise; },
    mergeVietnamLocationOptions: (_, items) => items,
    setPickupOptions: set('options'), setPickupLoading: set('loading'), setShowPickupOptions: set('visible'),
    setStopOptions: set('options'), setStopLoadingMap: set('loading'), setShowStopOptionsMap: set('visible'),
    setTimeout: fn => { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
    console: { warn() {} },
  };
  return {
    state, requests,
    run(keyword, suppressed = false) {
      if (cleanup) cleanup();
      if (stops) deps.suppressStopSearchMapRef.current[0] = suppressed;
      else deps.suppressPickupSearchRef.current = suppressed;
      const inputs = { pickupAddress: keyword, stops: [keyword], activeStopIndex: 0, stopPlaces: [null] };
      const context = { ...deps, ...inputs };
      new Function(...Object.keys(context), js)(...Object.values(context));
    },
    fire() { const [id, fn] = [...timers.entries()].at(-1); timers.delete(id); return fn(); },
  };
}
for (const stops of [false, true]) {
  const label = stops ? 'destination' : 'pickup';
  test(`${label}: a slow old search cannot replace newer address suggestions`, async () => {
    const h = harness(stops);
    h.run('Old address'); const old = h.fire();
    h.run('New address'); const recent = h.fire();
    h.requests[1].resolve([{ id: 'new' }]); await recent;
    h.requests[0].resolve([{ id: 'old' }]); await old;
    assert.deepEqual(h.state.options, stops ? [[{ id: 'new' }]] : [{ id: 'new' }]);
  });
  test(`${label}: choosing an address stops a pending search reopening suggestions`, async () => {
    const h = harness(stops);
    h.run('Address'); const old = h.fire();
    h.run('Selected address', true);
    h.requests[0].resolve([{ id: 'obsolete' }]); await old;
    assert.deepEqual(h.state.options, stops ? [[]] : []);
    assert.equal(stops ? h.state.visible[0] : h.state.visible, false);
  });
  test(`${label}: a failed old search cannot erase a successful newer result`, async () => {
    const h = harness(stops);
    h.run('Old address'); const old = h.fire();
    h.run('New address'); const recent = h.fire();
    h.requests[1].resolve([{ id: 'new' }]); await recent;
    h.requests[0].reject(Error('old network request failed')); await old;
    assert.deepEqual(h.state.options, stops ? [[{ id: 'new' }]] : [{ id: 'new' }]);
  });
}

test('Web additional pickup supplies suggestions, requires a selection and clears the warning after selection', async () => {
  const { ADDRESS_SELECTION_WARNING, uniquePlaceSuggestions } = require('../apps/api/src/shared/tripRoute.js');
  const web = fs.readFileSync(path.join(__dirname, '../apps/web/src/components/customer/BookingCard.jsx'), 'utf8');
  const start = web.indexOf('const hasPlaceCoords');
  const end = web.indexOf('const DEFAULT_PUBLIC_CONFIG', start);
  const js = ts.transpileModule(web.slice(start, end), { compilerOptions: { jsx: ts.JsxEmit.React } }).outputText;
  const state = [];
  const timers = [];
  const place = { placeId: 'place', name: 'Chợ mẫu', fullAddress: '10 Đường Mẫu', lat: 10, lng: 106 };
  let stateIndex;
  let row = { address: 'Chợ mẫu', place: null };
  const dependencies = {
    useState(initial) {
      const index = stateIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = value; }];
    },
    useEffect(effect, deps) { if (deps.length) effect(); },
    useRef() { return { current: 0 }; },
    setTimeout(callback) { timers.push(callback); },
    clearTimeout() {},
    searchPlaces: async () => [place, { ...place, placeId: 'duplicate' }],
    searchVietnamLocations: () => [],
    uniquePlaceSuggestions, ADDRESS_SELECTION_WARNING,
    React: { createElement: (type, props, ...children) => ({ type, props, children }) },
    Stack: 'Stack', Autocomplete: 'Autocomplete', TextField: 'TextField',
    IconButton: 'IconButton', DeleteOutlineIcon: 'DeleteOutlineIcon',
  };
  const Field = new Function(...Object.keys(dependencies), js + ';return AdditionalPickupField;')(...Object.values(dependencies));
  function autocomplete() {
    stateIndex = 0;
    return Field({ row, number: 2, normalizePlace: (_, detail) => detail, onChange: value => { row = value; } }).children[0].props;
  }
  let input = autocomplete();
  assert.equal(input.renderInput({}).props.helperText, ADDRESS_SELECTION_WARNING);
  await timers.shift()();
  input = autocomplete();
  assert.deepEqual(input.options.map(option => option.placeId), [place.placeId]);
  input.onChange(null, place, 'selectOption');
  input = autocomplete();
  assert.equal(row.place.placeId, 'place');
  assert.equal(input.renderInput({}).props.helperText, undefined);
  input.onInputChange(null, 'Một địa chỉ khác', 'input');
  assert.equal(row.place, null);
  assert.equal(autocomplete().renderInput({}).props.helperText, ADDRESS_SELECTION_WARNING);
});

test('identical suggestion labels are hidden while different places at the same address remain', () => {
  const { uniquePlaceSuggestions } = require('../apps/api/src/shared/tripRoute.js');
  const ward = { placeId: 'ward', name: 'Phường Mẫu', fullAddress: 'Phường Mẫu, Thành phố Mẫu' };
  const cafe = { placeId: 'cafe', name: 'Quán Mẫu', fullAddress: '10 Đường Mẫu' };
  const shop = { placeId: 'shop', name: 'Tiệm Mẫu', fullAddress: cafe.fullAddress };
  assert.deepEqual(uniquePlaceSuggestions([
    ward, { ...ward, placeId: 'duplicate', fullAddress: 'phường mẫu,thành phố mẫu' }, cafe, shop,
  ]), [ward, cafe, shop]);
});
