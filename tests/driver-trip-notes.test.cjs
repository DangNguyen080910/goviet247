const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const routeModule = import('../apps/api/src/shared/tripRoute.js');
function load(relative, mocks) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`);
    return mocks[name];
  }, module, module.exports);
  return module.exports;
}
async function presentation() {
  return load('apps/driver-mobile/utils/tripPresentation.ts', { '../../api/src/shared/tripRoute.js': await routeModule });
}
async function serializeAvailable(trip) {
  const source = fs.readFileSync(path.join(root, 'apps/api/src/controllers/tripController.js'), 'utf8');
  const tree = ts.createSourceFile('controller.js', source, ts.ScriptTarget.Latest, true);
  const fn = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'serializeDriverTrip');
  const serialize = new Function('dropoffIsRepresented', 'maskAddress', 'maskRiderName', 'maskRiderPhone', fn.getText(tree) + ';return serializeDriverTrip;')(
    (await routeModule).dropoffIsRepresented, value => value, () => 'Khách hàng', () => '',
  );
  return serialize(trip, 'available');
}
const trip = {
  id: 'note-order', direction: 'ROUND_TRIP', pickupAddress: 'A', dropoffAddress: 'B',
  stops: [{ id: '1', seq: 1, address: 'B' }, { id: '2', seq: 2, address: 'C' }, { id: '3', seq: 3, address: 'B' }],
  dispatcherNote: 'Điều hành dặn tài xế', note: 'Khách yêu cầu chụp ODO',
};
test('available API notes are displayed once after every destination and return, without changing its legacy payload', async () => {
  const raw = await serializeAvailable(trip);
  const before = JSON.stringify(raw);
  const display = await presentation();
  for (const masked of [true, false]) {
    const points = display.driverTripRoutePoints(raw, { masked });
    assert.deepEqual(points.map(p => p.address), ['A', 'B', 'C', 'B', 'A']);
    assert.equal(points.at(-1).label, 'Quay về điểm đón');
    const blocks = [...points.map(p => p.address), ...display.driverTripNotes(raw).map(n => n.text)];
    assert.deepEqual(blocks.slice(-3), ['A', trip.dispatcherNote, trip.note]);
    assert.equal(blocks.filter(v => v.includes(trip.note)).length, 1);
  }
  assert.equal(JSON.stringify(raw), before);
  assert.ok(raw.stops.at(-1).address.includes('📝 Ghi chú khách:'));
});
test('one-way trips and payloads without embedded notes preserve all destinations', async () => {
  const display = await presentation();
  const raw = { ...trip, direction: 'ONE_WAY' };
  assert.deepEqual(display.driverTripRoutePoints(raw).map(p => p.address), ['A', 'B', 'C', 'B']);
  assert.deepEqual(display.driverTripNotes(raw).map(n => n.kind), ['dispatcher', 'customer']);
});
test('long available notes use the exact API truncation without dropping route addresses', async () => {
  const raw = await serializeAvailable({ ...trip, note: '  ' + 'n'.repeat(499) + ' ' + 'n'.repeat(200) + '  ' });
  assert.equal(raw.note.length, 500);
  const display = await presentation();
  assert.deepEqual(display.driverTripRoutePoints(raw, { masked: true }).map(p => p.address), ['A', 'B', 'C', 'B', 'A']);
  assert.equal(display.driverTripNotes(raw)[1].text.length, 499);
});
test('only an exact matching legacy note suffix is removed; unrelated address content remains intact', async () => {
  const display = await presentation();
  const address = 'B\n📝 Ghi chú khách: Nội dung khác';
  const raw = { ...trip, direction: 'ONE_WAY', stops: [], dropoffAddress: address };
  assert.deepEqual(display.driverTripRoutePoints(raw).map(p => p.address), ['A', address]);
});
test('masked destinations remain masked and distinct visits are retained', async () => {
  const display = await presentation();
  const raw = { ...trip, dropoffAlreadyInRoute: true, pickupAddressMasked: 'Khu A',
    stops: [{ seq: 1, address: '10 B', addressMasked: 'Khu B' }, { seq: 2, address: '20 B', addressMasked: 'Khu B' }] };
  assert.deepEqual(display.driverTripRoutePoints(raw, { masked: true }).map(p => p.address), ['Khu A', 'Khu B', 'Khu B', 'Khu A']);
});
test('missing and whitespace-only notes produce no blank note blocks', async () => {
  const { driverTripNotes } = await presentation();
  assert.deepEqual(driverTripNotes({ note: ' \n', dispatcherNote: null }), []);
  assert.deepEqual(driverTripNotes({ dispatcherNote: ' D ' }).map(n => [n.kind, n.text]), [['dispatcher', 'D']]);
  assert.deepEqual(driverTripNotes({ note: ' K ' }).map(n => [n.kind, n.text]), [['customer', 'K']]);
});
test('rendered note cards put the dispatcher heading and text above customer heading and text', async () => {
  const jsx = (type, props) => typeof type === 'function' ? type(props) : { type, props };
  const common = { 'react-native': { View: 'View', Text: 'Text' }, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' } };
  const dispatcher = load('apps/driver-mobile/components/TripDispatcherNote.tsx', common);
  const Notes = load('apps/driver-mobile/components/TripNotes.tsx', { ...common,
    '../utils/tripPresentation': await presentation(), './TripDispatcherNote': dispatcher }).default;
  const text = value => value == null ? [] : Array.isArray(value) ? value.flatMap(text) : typeof value === 'object' ? text(value.props?.children) : [value];
  assert.deepEqual(text(Notes({ trip })), ['Ghi chú từ điều hành GoViet247', trip.dispatcherNote, 'Ghi chú khách', trip.note]);
  assert.deepEqual(text(Notes({ trip: {} })), []);
});
