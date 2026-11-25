const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const shared = import('../apps/api/src/shared/tripRoute.js');
const fixture = {
  id: 'route-regression', direction: 'ROUND_TRIP', status: 'IN_PROGRESS',
  pickupAddress: 'Hồ Văn Huê', dropoffAddress: 'Bạch Mai',
  stops: [{ seq: 1, address: 'Bạch Mai' }, { seq: 2, address: 'Cam Bình' }, { seq: 3, address: 'Bạch Mai' }],
};
const expected = ['Hồ Văn Huê', 'Bạch Mai', 'Cam Bình', 'Bạch Mai', 'Hồ Văn Huê'];
const source = relative => fs.readFileSync(path.join(root, relative), 'utf8');
function compile(code) {
  return ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
}
function load(relative, mocks) {
  const result = { exports: {} };
  new Function('require', 'module', 'exports', compile(source(relative)))(name => {
    assert.ok(name in mocks, `${relative}: unexpected dependency ${name}`);
    return mocks[name];
  }, result, result.exports);
  return result.exports;
}
function controller(name, deps) {
  const code = source('apps/api/src/controllers/tripController.js');
  const tree = ts.createSourceFile('controller.js', code, ts.ScriptTarget.Latest, true);
  const declaration = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === name);
  assert.ok(declaration, name);
  return new Function(...Object.keys(deps), declaration.getText(tree).replace(/^export /, '') + `;return ${name};`)(...Object.values(deps));
}
function response() {
  return { body: null, json(body) { this.body = body; return this; },
    status(code) { assert.fail(`Unexpected API status ${code}`); } };
}

for (const [file, listFunctions, detailFunction] of [
  ['pendingTripsApi', ['fetchPendingVerifyTrips', 'fetchPendingVerifyCancelledTrips'], 'fetchPendingTripDetail'],
  ['unassignedTripsApi', ['fetchUnassignedTrips', 'fetchUnassignedCancelledTrips'], 'fetchUnassignedTripDetail'],
  ['assignedTripsApi', ['fetchAssignedTrips'], 'fetchAssignedTripDetail'],
]) {
  test(`${file}: actual list/detail mappers retain all visits and return leg, including older API responses`, async () => {
    const route = await shared;
    for (const raw of [fixture, { ...fixture, direction: undefined, returnTime: '2026-11-21T12:00:00Z' }]) {
      const api = load(`apps/admin-mobile/services/${file}.ts`, {
        '../../api/src/shared/tripRoute.js': route,
        '../utils/tripVehicle': load('apps/admin-mobile/utils/tripVehicle.ts', {}),
        './adminRequest': { adminRequest: async () => ({ trips: [raw], items: [raw], trip: raw }) },
        '../../mobile-chat/driverNoteDrafts.js': { flushDriverNoteDraft: async () => {} },
      });
      for (const fn of listFunctions) {
        const [trip] = await api[fn]('IN_PROGRESS');
        assert.deepEqual(route.tripRoutePoints(trip).map(p => p.address), expected, `${file}.${fn}`);
      }
      const trip = await api[detailFunction](fixture.id);
      assert.deepEqual(route.tripRoutePoints(trip).map(p => p.address), expected, `${file}.${detailFunction}`);
    }
  });
}

test('Admin assigned endpoint selects and returns canonical direction even without returnTime', async () => {
  let select;
  const get = controller('getAssignedTrips', {
    prisma: { tripConfig: { findFirst: async () => ({}) }, trip: { findMany: async options => {
      select = options.select;
      return [Object.fromEntries(Object.entries(fixture).filter(([key]) => select[key]))];
    } } }, adminTripMoney: () => ({}), console,
  });
  const res = response(); await get({ query: { status: 'IN_PROGRESS' } }, res);
  assert.equal(select.direction, true);
  assert.equal(select.stops.orderBy.seq, 'asc');
  assert.deepEqual((await shared).tripRoutePoints(res.body.trips[0]).map(p => p.address), expected);
});

test('Driver active, available and completed serializers keep the revisited stop and return in order', async () => {
  const route = await shared;
  const { hasActiveTripContact } = await import('../apps/api/src/shared/tripContact.js');
  const serialize = controller('serializeDriverTrip', {
    dropoffIsRepresented: route.dropoffIsRepresented, hasActiveTripContact,
    normalizeDisplayAddress: value => value, maskAddress: value => value,
    maskRiderName: () => 'Khách hàng', maskRiderPhone: () => '',
  });
  for (const scope of ['active', 'available', 'history']) {
    const trip = serialize(fixture, scope);
    assert.deepEqual(route.tripRoutePoints(trip, { masked: scope !== 'active' }).map(p => p.address), expected, scope);
  }
});

test('Driver cancellation history preserves two distinct addresses masked to the same locality', async () => {
  const route = await shared;
  const get = controller('getDriverCancelHistory', {
    dropoffIsRepresented: route.dropoffIsRepresented,
    maskAddress: value => value.split(',').at(-1).trim(), console,
    prisma: { driverTripPenaltyLog: { findMany: async () => [{ id: 'log', tripId: 'trip', trip: {
      pickupAddress: '10 Road A, Town A', dropoffAddress: '20 Road B, Town B', direction: 'ROUND_TRIP',
      stops: [{ id: 's', seq: 1, address: '30 Road C, Town B' }],
    } }] } },
  });
  const res = response(); await get({ user: { id: 'driver' } }, res);
  assert.equal(res.body.items[0].dropoffAlreadyInRoute, false);
  assert.deepEqual(route.tripRoutePoints(res.body.items[0], { masked: true }).map(p => p.address), ['Town A', 'Town B', 'Town B', 'Town A']);
});

// Render the real route components, with native leaf controls replaced by nodes.
test('Rider and Driver native route components display identical labels and five addresses', async () => {
  const route = await shared;
  const element = (type, props) => ({ type, props });
  const texts = node => !node ? [] : Array.isArray(node) ? node.flatMap(texts) :
    typeof node === 'object' ? texts(node.props?.children) : [node];
  const rendered = [];
  for (const role of ['rider', 'driver']) {
    const Component = load(`apps/${role}-mobile/components/TripRoute.tsx`, {
      '../../api/src/shared/tripRoute.js': route, 'react-native': { View: 'View', Text: 'Text' },
      'react/jsx-runtime': { jsx: element, jsxs: element },
    }).default;
    const output = texts(Component({ trip: fixture }));
    assert.equal(output.filter(value => value === 'Bạch Mai').length, 2);
    assert.equal(output.filter(value => value === 'Hồ Văn Huê').length, 2);
    assert.ok(output.includes('Điểm đến 3')); assert.ok(output.includes('Quay về điểm đón'));
    rendered.push(output);
  }
  assert.deepEqual(rendered[0], rendered[1]);
});

test('chat detail shares the full five-point itinerary', async () => {
  const { chatTripDetailRows, chatTripSummary } = await import('../apps/api/src/shared/chatTripDetail.js');
  const rows = chatTripDetailRows(chatTripSummary(fixture, fixture.stops));
  const points = rows.filter(([label]) => /^(Điểm đón|Điểm đến \d+|Quay về điểm đón)$/.test(label));
  assert.deepEqual(points.map(([, address]) => address), expected);
});

test('Driver dashboard keeps the third destination and return in both waiting and my-trips cards', async () => {
  const code = source('apps/driver-mobile/app/dashboard.tsx');
  const tree = ts.createSourceFile('dashboard.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'getTripRouteDisplay') callback = node.initializer.arguments[0];
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(callback);
  const route = await shared;
  const presentation = load('apps/driver-mobile/utils/tripPresentation.ts', { '../../api/src/shared/tripRoute.js': route });
  const render = new Function('driverTripRoutePoints', compile(`const render = ${callback.getText(tree)};`) + ';return render;')(presentation.driverTripRoutePoints);
  for (const mode of ['masked', 'full']) {
    const { destinations } = render(fixture, mode);
    assert.deepEqual(destinations.map(p => p.address), expected.slice(1));
    assert.deepEqual(destinations.map(p => p.label), ['Điểm đến 1', 'Điểm đến 2', 'Điểm đến 3', 'Quay về điểm đón']);
  }
});

test('Admin feedback detail keeps the entire disputed itinerary instead of only the final dropoff', async () => {
  const api = load('apps/admin-mobile/services/adminFeedbackApi.ts', {
    './adminRequest': { adminRequest: async () => ({ feedback: { id: 'feedback', trip: fixture } }) },
  });
  const feedback = await api.fetchAdminFeedbackDetail('feedback');
  assert.deepEqual((await shared).tripRoutePoints(feedback.trip).map(p => p.address), expected);
});
