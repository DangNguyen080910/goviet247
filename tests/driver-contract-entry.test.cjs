const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'apps/driver-mobile/services/contractEntryGate.ts'), 'utf8');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: exportsObject });
const { createContractEntryChecker, requiresContractEntryCheck } = exportsObject;
const accepted = { profile: { id: 'driver' }, needsAcceptance: false };
const pending = { profile: { id: 'driver' }, needsAcceptance: true };
function harness(overrides = {}) {
  const states = [];
  const checker = createContractEntryChecker({
    getToken: async () => 'existing-session', loadAgreement: async () => accepted,
    ...overrides, onState: state => states.push({ ...state }),
  });
  return { checker, states };
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('normal app/deep links require checking; signing, support and registration remain accessible', () => {
  for (const route of ['/dashboard', '/dashboard/', '/trip-chat', '/wallet', '/trip-history', '/driver-profile', '/rules']) {
    assert.equal(requiresContractEntryCheck(route), true, route);
  }
  for (const route of ['/', '/otp', '/bootstrap', '/driver-contract', '/support', '/driver-profile/create',
    '/driver-profile/pending', '/driver-profile/rejected', '/driver-profile/suspended']) {
    assert.equal(requiresContractEntryCheck(route), false, route);
  }
});

test('missing consent opens signing directly before allowing the trip screen', async () => {
  const { checker, states } = harness({ loadAgreement: async () => pending });
  await checker.check('/dashboard');
  assert.deepEqual(states, [
    { path: '/dashboard', phase: 'checking' },
    { path: '/dashboard', phase: 'redirecting', destination: '/driver-contract?required=1' },
  ]);
});

test('accepted consent unlocks only the route that was checked', async () => {
  const { checker, states } = harness();
  await checker.check('/trip-chat');
  assert.deepEqual(states.at(-1), { path: '/trip-chat', phase: 'allowed' });
});

test('returning from background rechecks even with the same token', async () => {
  let current = accepted;
  const { checker, states } = harness({ loadAgreement: async () => current });
  await checker.check('/dashboard');
  checker.cancel();
  current = pending;
  await checker.check('/dashboard');
  assert.equal(states.at(-1).destination, '/driver-contract?required=1');
});

test('network error keeps access blocked; retry uses the existing session without OTP', async () => {
  let fail = true;
  const tokens = [];
  const { checker, states } = harness({ loadAgreement: async token => {
    tokens.push(token);
    if (fail) throw new Error('offline');
    return accepted;
  } });
  await checker.check('/dashboard');
  assert.equal(states.at(-1).phase, 'error');
  assert.equal(states.some(state => state.destination === '/'), false);
  fail = false;
  await checker.check('/dashboard');
  assert.equal(states.at(-1).phase, 'allowed');
  assert.deepEqual(tokens, ['existing-session', 'existing-session']);
});

test('missing session and missing profile return to the appropriate existing flow', async () => {
  const noSession = harness({ getToken: async () => null, loadAgreement: async () => { assert.fail('must not fetch'); } });
  await noSession.checker.check('/dashboard');
  assert.equal(noSession.states.at(-1).destination, '/');
  const noProfile = harness({ loadAgreement: async () => ({ profile: null, needsAcceptance: false }) });
  await noProfile.checker.check('/dashboard');
  assert.equal(noProfile.states.at(-1).destination, '/bootstrap');
});

test('malformed consent response never unlocks a screen', async () => {
  const { checker, states } = harness({ loadAgreement: async () => ({ profile: { id: 'driver' } }) });
  await checker.check('/dashboard');
  assert.equal(states.at(-1).phase, 'error');
});

test('old request cannot unlock after leaving the route or backgrounding', async () => {
  const response = deferred();
  const started = deferred();
  const { checker, states } = harness({ loadAgreement: () => { started.resolve(); return response.promise; } });
  const request = checker.check('/dashboard');
  await started.promise;
  checker.cancel();
  response.resolve(accepted);
  await request;
  assert.deepEqual(states.map(state => state.phase), ['checking']);
});

test('a slower previous route cannot override the current consent result', async () => {
  const response = deferred();
  const started = deferred();
  let calls = 0;
  const { checker, states } = harness({ loadAgreement: () => {
    if (++calls === 1) { started.resolve(); return response.promise; }
    return Promise.resolve(pending);
  } });
  const first = checker.check('/dashboard');
  await started.promise;
  await checker.check('/wallet');
  response.resolve(accepted);
  await first;
  assert.deepEqual(states.at(-1), { path: '/wallet', phase: 'redirecting', destination: '/driver-contract?required=1' });
  assert.equal(states.some(state => state.phase === 'allowed'), false);
});

test('old account response is discarded and the new account is checked', async () => {
  let token = 'old-account';
  const response = deferred();
  const started = deferred();
  const seen = [];
  const { checker, states } = harness({ getToken: async () => token, loadAgreement: next => {
    seen.push(next);
    if (next === 'old-account') { started.resolve(); return response.promise; }
    return Promise.resolve(pending);
  } });
  const request = checker.check('/dashboard');
  await started.promise;
  token = 'new-account';
  response.resolve(accepted);
  await request;
  assert.deepEqual(seen, ['old-account', 'new-account']);
  assert.equal(states.at(-1).destination, '/driver-contract?required=1');
  assert.equal(states.some(state => state.phase === 'allowed'), false);
});

function mountGate(loadAgreement, initialPath = '/dashboard') {
  const effects = [];
  const destinations = [];
  let snapshot;
  let memo;
  let listener;
  let removed = false;
  const jsx = (type, props) => ({ type, props });
  const modules = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: {
      useEffect: effect => effects.push(effect), useMemo: factory => memo ??= factory(),
      useState: initial => { snapshot ??= initial; return [snapshot, next => { snapshot = next; }]; },
    },
    'react-native': {
      View: 'View', Text: 'Text', ActivityIndicator: 'Spinner', TouchableOpacity: 'Button',
      StyleSheet: { create: styles => styles, absoluteFillObject: {} },
      AppState: { currentState: 'active', addEventListener: (_, callback) => {
        listener = callback; return { remove: () => { removed = true; } };
      } },
    },
    'expo-router': { router: { replace: next => destinations.push(next), push: next => destinations.push(next) },
      usePathname: () => initialPath, useRootNavigationState: () => ({ key: 'mounted-navigator' }) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeArea' },
    '../services/driverProfileApi': { getDriverContract: loadAgreement },
    '../services/storage': { getDriverToken: async () => 'existing-session' },
    '../services/contractEntryGate': exportsObject,
  };
  const componentExports = {};
  const code = fs.readFileSync(path.join(root, 'apps/driver-mobile/components/DriverContractGate.tsx'), 'utf8');
  vm.runInNewContext(ts.transpileModule(code, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { exports: componentExports, require: name => {
    assert.ok(modules[name], name); return modules[name];
  } });
  const render = () => componentExports.default({ children: 'mounted navigator' });
  const initialTree = render();
  const cleanup = effects[0]();
  return { initialTree, render, destinations, getState: () => snapshot,
    changeAppState: next => listener(next), unmount: () => cleanup(), removed: () => removed };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('mounted gate hides retained UI until checked, then checks again on foreground', async () => {
  let current = accepted;
  let calls = 0;
  const mounted = mountGate(async () => { calls += 1; return current; });
  assert.equal(mounted.initialTree.props.children[0].props.pointerEvents, 'none');
  assert.equal(mounted.initialTree.props.children[0].props.children, 'mounted navigator');
  await flush();
  assert.equal(mounted.render().props.children[0].props.pointerEvents, 'auto');
  mounted.changeAppState('background');
  assert.equal(mounted.render().props.children[0].props.pointerEvents, 'none');
  current = pending;
  mounted.changeAppState('active');
  await flush();
  assert.equal(calls, 2);
  assert.equal(mounted.render().props.children[0].props.pointerEvents, 'none');
  assert.deepEqual(mounted.destinations, ['/driver-contract?required=1']);
  mounted.unmount();
  assert.equal(mounted.removed(), true);
});

test('direct chat notification entry cannot bypass signing; signing/support themselves stay accessible', async () => {
  const chat = mountGate(async () => pending, '/trip-chat');
  await flush();
  assert.deepEqual(chat.destinations, ['/driver-contract?required=1']);
  chat.unmount();
  for (const route of ['/driver-contract', '/support']) {
    const mounted = mountGate(async () => { assert.fail('must not block the signing/support screen'); }, route);
    assert.equal(mounted.initialTree.props.children[0].props.pointerEvents, 'auto');
    assert.deepEqual(mounted.destinations, []);
  }
});
