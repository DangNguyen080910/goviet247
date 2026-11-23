const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'apps/rider-mobile/app/booking.tsx'), 'utf8');
const ast = ts.createSourceFile('booking.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const stateNames = [];
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) &&
      node.initializer && ts.isCallExpression(node.initializer) &&
      node.initializer.expression.getText(ast) === 'useState') {
    stateNames.push(node.name.elements[0].name.getText(ast));
  }
  ts.forEachChild(node, visit);
}
visit(ast);
const now = new Date('2026-11-23T07:22:00+07:00').getTime();
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
function compile(text) {
  return ts.transpileModule(text, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  }}).outputText;
}
const timeExports = {};
vm.runInNewContext(compile(fs.readFileSync(path.join(root, 'apps/rider-mobile/utils/bookingTime.ts'), 'utf8')), { exports: timeExports, Date: Clock });
const jsx = (type, props) => ({ type, props: props || {} });
const component = name => ({ __esModule: true, default: name });
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('');
  if (tree && typeof tree === 'object') return text(tree.props?.children);
  return typeof tree === 'string' || typeof tree === 'number' ? String(tree) : '';
}
// Render the complete screen module. Only native/service boundaries and React
// hooks are replaced; use the real event handlers, validation and JSX together.
function screen(platform, initial = {}) {
  const state = new Map(Object.entries({
    direction: 'ROUND_TRIP', pickupTime: '2026-11-23T08:00', pickupTimeConfirmed: true,
    outboundDriveMinutes: '60', ...initial,
  }));
  let stateIndex = 0, refIndex = 0, tree;
  const refs = [];
  const alerts = [];
  const react = {
    useState(value) {
      const name = stateNames[stateIndex++];
      assert.ok(name, 'All state hooks are named');
      if (!state.has(name)) state.set(name, typeof value === 'function' ? value() : value);
      return [state.get(name), next => state.set(name, typeof next === 'function' ? next(state.get(name)) : next)];
    },
    useRef(value) { return refs[refIndex++] ||= { current: value }; },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect() {},
  };
  const native = { Platform: { OS: platform }, StyleSheet: { create: x => x },
    Alert: { alert: (...args) => alerts.push(args) }, AppState: {} };
  for (const name of ['KeyboardAvoidingView', 'Modal', 'Pressable', 'ScrollView', 'Text', 'TextInput', 'View']) native[name] = name;
  const deps = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': native, 'expo-router': { router: {}, useFocusEffect() {} },
    '@react-native-community/datetimepicker': component('NativeDatePicker'),
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 0, top: 0 }) },
    'expo-location': {}, 'expo-haptics': {},
    '../utils/bookingTime': timeExports,
    '../components/BookingTimePicker': component('BookingTimePicker'),
    '../components/AppBrandHeader': component('AppBrandHeader'),
    '../components/DestinationService': { ...component('DestinationService'), ServiceSummary: 'ServiceSummary' },
    '../../../packages/shared/destinationService.js': { destinationWindows: () => [], destinationConfig: () => ({}) },
    '../../api/src/shared/regionalPricing.js': {}, '../../mobile-chat/permissionHelp': {},
    '../services/authApi': {}, '../services/pricingApi': {}, '../services/tripApi': {},
    '../services/storage': {}, '../services/mapApi': {}, '../constants/vietnamLocations': {},
  };
  const exports = {};
  vm.runInNewContext(compile(source), { exports, Date: Clock, console,
    require(id) { assert.ok(id in deps, `Explicit boundary required: ${id}`); return deps[id]; },
  });
  function render() { stateIndex = 0; refIndex = 0; tree = exports.default(); return tree; }
  function act(fn) { fn(); render(); }
  function one(type) { const found = nodes(tree).filter(n => n.type === type); assert.equal(found.length, 1, type); return found[0]; }
  function field(label) {
    const all = nodes(tree), position = all.findIndex(n => n.type === 'Text' && text(n) === label);
    assert.ok(position >= 0, label);
    return all.slice(position + 1).find(n => n.type === 'Pressable');
  }
  function press(label) {
    const found = nodes(tree).find(n => n.type === 'Pressable' && text(n) === label);
    assert.ok(found, label); act(() => found.props.onPress());
  }
  render();
  return { state, alerts, render, act, one, field, press, text: () => text(tree),
    open(label) { act(() => field(label).props.onPress()); },
    chooseDate(value) { act(() => one('NativeDatePicker').props.onChange({ type: 'set' }, new Date(value + 'T00:00:00+07:00'))); },
    chooseTime(value) { act(() => { const picker = one('BookingTimePicker'); picker.props.onChange(value); picker.props.onClose(); }); },
  };
}

test('iOS: confirming the initially selected return day saves it without spinning', () => {
  const s = screen('ios'); s.open('Ngày quay về'); s.press('Xong');
  assert.equal(s.state.get('returnTime').slice(0, 10), '2026-11-23');
  assert.equal(text(s.field('Giờ bắt đầu quay về')), 'Chọn giờ và buổi');
  assert.equal(s.state.get('returnTimeConfirmed'), false);
  assert.ok(!s.text().includes('Giờ quay về phải sau thời điểm xe dự kiến đã tới điểm đến.'));
  assert.equal(s.state.get('pickerTarget'), null);
});

for (const platform of ['ios', 'android']) {
  test(`${platform}: same-day date with hidden 07:22 is accepted before selecting 15:00`, () => {
    const s = screen(platform); s.open('Ngày quay về'); s.chooseDate('2026-11-23');
    if (platform === 'ios') s.press('Xong');
    assert.equal(s.state.get('returnTime').slice(0, 10), '2026-11-23');
    assert.equal(s.state.get('returnTimeConfirmed'), false);
    assert.ok(!s.text().includes('Giờ quay về phải sau thời điểm xe dự kiến đã tới điểm đến.'));
    assert.ok(!s.text().includes('• Giờ quay về chưa hợp lệ.'));
    s.open('Giờ bắt đầu quay về'); s.chooseTime('2026-11-23T15:00');
    assert.equal(s.state.get('returnTime'), '2026-11-23T15:00');
    assert.equal(s.state.get('returnTimeConfirmed'), true);
    assert.ok(!s.text().includes('Giờ quay về phải sau thời điểm xe dự kiến đã tới điểm đến.'));
    assert.equal(s.alerts.length, 0);
  });
  test(`${platform}: a confirmed return before arrival still shows the error`, () => {
    const s = screen(platform); s.open('Giờ bắt đầu quay về'); s.chooseTime('2026-11-23T08:30');
    assert.ok(s.text().includes('Giờ quay về phải sau thời điểm xe dự kiến đã tới điểm đến.'));
    s.open('Giờ bắt đầu quay về'); s.chooseTime('2026-11-23T09:00');
    assert.ok(!s.text().includes('Giờ quay về phải sau thời điểm xe dự kiến đã tới điểm đến.'));
  });
  test(`${platform}: changing return days preserves the chosen clock and remains editable`, () => {
    const s = screen(platform, { returnTime: '2026-11-24T15:00', returnTimeConfirmed: true });
    s.open('Ngày quay về'); s.chooseDate('2026-11-23'); if (platform === 'ios') s.press('Xong');
    assert.equal(s.state.get('returnTime'), '2026-11-23T15:00');
    assert.equal(s.state.get('returnTimeConfirmed'), true);
    assert.ok(!s.text().includes('Giờ quay về phải sau thời điểm xe dự kiến đã tới điểm đến.'));
  });
}

test('return order is not reported while pickup time is still unconfirmed', () => {
  const s = screen('ios', { pickupTimeConfirmed: false, returnTime: '2026-11-23T07:30', returnTimeConfirmed: true });
  assert.ok(!s.text().includes('Giờ quay về phải sau thời điểm xe dự kiến đã tới điểm đến.'));
});

test('overnight arrival is still required when both clocks are confirmed', () => {
  const s = screen('ios', { pickupTime: '2026-11-23T23:30', outboundDriveMinutes: '120',
    returnTime: '2026-11-24T00:30', returnTimeConfirmed: true });
  assert.ok(s.text().includes('Giờ quay về phải sau thời điểm xe dự kiến đã tới điểm đến.'));
  s.open('Giờ bắt đầu quay về'); s.chooseTime('2026-11-24T01:30');
  assert.ok(!s.text().includes('Giờ quay về phải sau thời điểm xe dự kiến đã tới điểm đến.'));
});

test('an initial hidden pickup clock is not displayed as a chosen past time', () => {
  const s = screen('ios', { pickupTime: '2026-11-23T07:22', pickupTimeConfirmed: false });
  assert.equal(text(s.field('Giờ đón khách')), 'Chọn giờ và buổi');
  assert.ok(!s.text().includes('Giờ đón khách phải sau thời điểm hiện tại.'));
});

test('switching to one-way clears return clock confirmation before selecting another round trip', () => {
  const s = screen('ios', { returnTime: '2026-11-23T15:00', returnTimeConfirmed: true });
  s.press('Một chiều'); s.press('Khứ hồi');
  s.open('Ngày quay về'); s.press('Xong');
  assert.equal(s.state.get('returnTimeConfirmed'), false);
  assert.equal(text(s.field('Giờ bắt đầu quay về')), 'Chọn giờ và buổi');
  assert.ok(!s.text().includes('Giờ quay về phải sau thời điểm xe dự kiến đã tới điểm đến.'));
});

test('iOS: confirming the initial pickup day does not confirm its hidden clock', () => {
  const s = screen('ios', { pickupTimeConfirmed: false });
  s.open('Ngày đón khách'); s.press('Xong');
  assert.equal(s.state.get('pickupTime').slice(0, 10), '2026-11-23');
  assert.equal(s.state.get('pickupTimeConfirmed'), false);
  assert.equal(text(s.field('Giờ đón khách')), 'Chọn giờ và buổi');
});

test('Android: dismissing the native date dialog does not save a return date', () => {
  const s = screen('android'); s.open('Ngày quay về');
  s.act(() => s.one('NativeDatePicker').props.onChange({ type: 'dismissed' }));
  assert.equal(s.state.get('returnTime'), '');
  assert.equal(s.state.get('returnTimeConfirmed'), false);
  assert.equal(s.state.get('pickerTarget'), null);
});
