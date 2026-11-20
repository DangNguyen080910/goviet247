const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx };
function compile(source) {
  return ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
}
function load(relative, mocks = {}) {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compile(fs.readFileSync(path.join(root, relative), 'utf8')))(
    name => name === 'react/jsx-runtime' ? runtime : mocks[name] || require(name), module, module.exports);
  return module.exports;
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const money = load('packages/shared/moneySuggestions.js');

test('15 offers thousands through millions, with no shortcut of ten million or more', () => {
  assert.deepEqual(money.moneySuggestions('15'), [15000, 150000, 1500000]);
  assert.deepEqual(money.moneySuggestions('5'), [5000, 50000, 500000, 5000000]);
  assert.deepEqual(money.moneySuggestions('150'), [150000, 1500000]);
  assert.deepEqual(money.moneySuggestions('1.500'), [1500000]);
  assert.deepEqual(money.moneySuggestions('9999'), [9999000]);
  for (const value of ['', '0', '-15', '15.5', '1e3', 'abc', '10000', '10000000', null]) {
    assert.deepEqual(money.moneySuggestions(value), [], String(value));
  }
  assert.equal(money.suggestedMoneyLabel(1500000), '1.500.000 đ');
});

// Render the real component trees and invoke their handlers; no device runtime
// or wallet requests. Native keyboard interaction still needs a device check.
function fieldHarness(native, props) {
  let focused = false, focusCalls = 0;
  const input = { focus() { focusCalls++; } };
  const ref = { current: input };
  const react = { forwardRef: fn => fn, useRef: () => ref,
    useState: () => [focused, next => { focused = next; }] };
  const mocks = { react, [native ? '../../packages/shared/moneySuggestions.js' : '../../../../../packages/shared/moneySuggestions.js']: money,
    '@mui/material': { Box: 'Box', Button: 'Button', TextField: 'TextField', Typography: 'Typography' },
    'react-native': { Pressable: 'Pressable', Text: 'Text', TextInput: 'TextInput', View: 'View',
      StyleSheet: { create: x => x, flatten: x => Array.isArray(x) ? Object.assign({}, ...x) : x } } };
  const Field = load(native ? 'apps/mobile-chat/MoneyInput.tsx' : 'apps/web/src/components/common/MoneyTextField.jsx', mocks).default;
  const render = () => Field(props, null);
  const buttons = tree => nodes(tree).filter(x => x.type === (native ? 'Pressable' : 'Button'));
  const focus = () => {
    const tree = render();
    if (native) nodes(tree).find(x => x.type === 'TextInput').props.onFocus({});
    else tree.props.onFocusCapture();
    return render();
  };
  return { render, buttons, focus, focusCalls: () => focusCalls };
}
for (const native of [false, true]) {
  const platform = native ? 'mobile' : 'web';
  test(`${platform}: shortcuts only fill the amount, keep focus, and manual amounts remain unrestricted`, () => {
    let changed;
    const props = { value: '15', style: { marginBottom: 16, height: 48 },
      onChange: e => { changed = e.target.value; }, onChangeText: value => { changed = value; } };
    const h = fieldHarness(native, props);
    assert.equal(h.buttons(h.render()).length, 0);
    const tree = h.focus(), buttons = h.buttons(tree);
    assert.equal(buttons.length, 3);
    if (native) {
      buttons[1].props.onPress();
      assert.equal(tree.props.style.marginBottom, 16);
      assert.equal(nodes(tree).find(x => x.type === 'TextInput').props.style.height, 48);
    } else {
      assert.equal(buttons[1].props.type, 'button');
      let prevented = false;
      buttons[1].props.onMouseDown({ preventDefault() { prevented = true; } });
      assert.equal(prevented, true);
      buttons[1].props.onClick();
    }
    assert.equal(changed, '150000'); assert.equal(h.focusCalls(), 1);
    const control = nodes(tree).find(x => x.type === (native ? 'TextInput' : 'TextField'));
    if (native) control.props.onChangeText('20000000');
    else control.props.onChange({ target: { value: '20000000' } });
    assert.equal(changed, '20000000');
  });
  test(`${platform}: disabled and readonly amounts have no shortcuts`, () => {
    const cases = native ? [{ editable: false }, { readOnly: true }] :
      [{ disabled: true }, { InputProps: { readOnly: true } }, { inputProps: { readOnly: true } }];
    for (const props of cases) {
      const h = fieldHarness(native, { value: '15', ...props });
      assert.equal(h.buttons(h.focus()).length, 0);
    }
  });
}

for (const native of [false, true]) {
  const relative = native ? 'apps/mobile-chat/TripChat.tsx' : 'apps/web/src/components/TripChatHub.jsx';
  const source = ts.createSourceFile(relative, fs.readFileSync(path.join(root, relative), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let heart;
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(attribute =>
      ts.isJsxAttribute(attribute) && attribute.name.getText(source) === (native ? 'accessibilityLabel' : 'aria-label') && attribute.getText(source).includes('heartCount'))) heart = node.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(heart, relative);
  const render = new Function('require', 'Button', 'Pressable', 'Text', 'm', 'canSend', 'busy', 'run', 'api', 'tripId', 'setItems', 'load',
    'const exports = {};\n' + compile(`function renderHeart() { return (${heart}); }`) + ';return renderHeart();');
  test(`${native ? 'mobile' : 'web'}: others' hearts are red while each viewer adds/removes only their own vote`, async () => {
    for (const [count, own] of [[0, false], [1, false], [2, true], [1, true]]) {
      const message = { id: 'm', heartCount: count, hearted: own };
      let pending, sent, items = [message];
      const tree = render(() => runtime, 'Button', 'Pressable', 'Text', message, true, false,
        fn => (pending = fn()), async (_, options) => {
          sent = JSON.parse(options.body);
          return { heartCount: count + (own ? -1 : 1), hearted: !own };
        }, 'trip', update => { items = update(items); }, async () => {});
      const visual = native ? tree.props.children : tree;
      assert.equal((native ? visual.props.style : visual.props.sx).color, count ? '#e11d48' : '#64748b');
      assert.equal(visual.props.children[0], count ? '♥' : '♡');
      assert.equal(native ? tree.props.accessibilityState.selected : tree.props['aria-pressed'], own);
      (native ? tree.props.onPress : tree.props.onClick)(); await pending;
      assert.deepEqual(sent, { active: !own });
      assert.equal(items[0].heartCount, count + (own ? -1 : 1));
    }
  });
}
