const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const root = path.resolve(__dirname, '../../..');

// Exercise the real components and their callbacks without a native runtime.
// Leaf controls expose the event handlers; native keyboard behavior still needs
// a device check. No backend, credentials or external requests are involved.
function load(relative, mocks) {
  const filename = path.join(root, relative);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const result = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => mocks[name] || require(name), result, result.exports);
  return result.exports.default;
}

function web(props) {
  const seen = { focused: 0 };
  const field = { focus() { seen.focused++; } };
  const mocks = {
    '@mui/material': {
      TextField: input => {
        seen.input = input;
        input.inputRef(field);
        return React.createElement('div', null, input.InputProps.startAdornment, input.InputProps.endAdornment);
      },
      InputAdornment: input => React.createElement('span', null, input.children),
      IconButton: input => { seen.button = input; return React.createElement('button', { type: input.type, disabled: input.disabled, 'aria-label': input['aria-label'] }, input.children); },
    },
    '@mui/icons-material/Close': () => React.createElement('span', null, '×'),
  };
  const Field = load('apps/web/src/components/common/ClearableSearchField.jsx', mocks);
  seen.html = renderToStaticMarkup(React.createElement(Field, props));
  return seen;
}

function mobile(props) {
  const seen = { focused: 0 };
  const flatten = value => Array.isArray(value) ? Object.assign({}, ...value.map(flatten)) : value || {};
  const mocks = {
    'react-native': {
      TextInput: React.forwardRef((input, ref) => { seen.input = input; ref({ focus() { seen.focused++; } }); return React.createElement('input', { value: input.value, readOnly: true }); }),
      View: input => { seen.container = input; return React.createElement('div', null, input.children); },
      Text: input => React.createElement('span', null, input.children),
      Pressable: input => { seen.button = input; return React.createElement('button', { disabled: input.disabled, 'aria-label': input.accessibilityLabel }, input.children); },
      StyleSheet: { flatten, create: value => value },
    },
  };
  const Field = load('apps/mobile-chat/ClearableSearchInput.tsx', mocks);
  renderToStaticMarkup(React.createElement(Field, props));
  return seen;
}

test('web clear is accessible, never submits its form, preserves adornments and refocuses the field', () => {
  let cleared = 0, changed = '', prevented = false;
  const view = web({ value: 'Cà Mau', onClear: () => { cleared++; }, onChange: event => { changed = event.target.value; },
    InputProps: { startAdornment: React.createElement('span', null, 'Search'), endAdornment: React.createElement('span', null, 'Existing') } });
  assert.match(view.html, /Xoá nội dung tìm kiếm/);
  assert.match(view.html, /Search/); assert.match(view.html, /Existing/);
  assert.equal(view.button.type, 'button');
  view.button.onMouseDown({ preventDefault() { prevented = true; } });
  view.button.onClick();
  assert.equal(cleared, 1); assert.equal(view.focused, 1); assert.equal(prevented, true);
  view.input.onChange({ target: { value: 'Hà Nội' } });
  assert.equal(changed, 'Hà Nội');
  assert.equal(web({ value: '', onClear() {} }).button, undefined);
});

test('disabled or read-only fields cannot be cleared on either platform', () => {
  for (const props of [{ disabled: true }, { InputProps: { readOnly: true } }, { inputProps: { readOnly: true } }]) {
    const view = web({ value: 'Đã chọn', ...props, onClear: () => assert.fail('Disabled clear') });
    assert.equal(view.button.disabled, true); view.button.onClick(); assert.equal(view.focused, 0);
  }
  for (const props of [{ editable: false }, { readOnly: true }]) {
    const view = mobile({ value: 'Đã chọn', ...props, onChangeText: () => assert.fail('Disabled clear') });
    assert.equal(view.button.disabled, true); view.button.onPress(); assert.equal(view.focused, 0);
  }
});

test('mobile clear delegates to existing search logic and keeps layout spacing', () => {
  let query = 'Tài xế', page = 4;
  const view = mobile({ value: query, onChangeText: value => { query = value; page = 1; },
    style: [{ height: 48, paddingHorizontal: 14, marginBottom: 16 }, { borderWidth: 1 }] });
  view.button.onPress();
  assert.equal(query, ''); assert.equal(page, 1); assert.equal(view.focused, 1);
  assert.equal(view.input.clearButtonMode, 'never');
  assert.equal(view.container.style[0].marginBottom, 16);
  assert.equal(view.input.style[0].marginBottom, undefined);
  assert.ok(view.input.style[1].paddingRight >= 44);
  assert.equal(view.input.style[0].height, 48);
  assert.equal(view.input.style[0].borderWidth, 1);
  assert.equal(mobile({ value: '', onChangeText() {} }).button, undefined);
});

test('mobile explicit clear resets both the draft and the applied driver query', () => {
  let draft = 'An', applied = 'An', page = 3;
  const view = mobile({ value: draft, onChangeText: () => assert.fail('Explicit reset should be used'),
    onClear: () => { draft = ''; applied = ''; page = 1; } });
  view.button.onPress();
  assert.equal(draft, ''); assert.equal(applied, ''); assert.equal(page, 1); assert.equal(view.focused, 1);
});

test('all web clear callbacks preserve unrelated filters and reset the appropriate page', () => {
  const files = [
    'pages/admin/AdminCustomers.jsx', 'pages/admin/AdminDrivers.jsx', 'pages/admin/AdminDriverWallets.jsx',
    'pages/admin/AdminFeedback.jsx', 'pages/admin/AdminNotifications.jsx', 'pages/admin/AdminPendingTrips.jsx',
    'pages/admin/AdminQuoteHistory.jsx', 'pages/admin/AdminTrips.jsx', 'pages/admin/AdminTripsAssigned.jsx',
    'components/admin/TripAudienceDialog.jsx', 'components/partners/PartnerConsole.jsx',
  ];
  let checked = 0;
  for (const relative of files) {
    const filename = path.join(root, 'apps/web/src', relative);
    const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'ClearableSearchField') {
        const attribute = node.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.getText(source) === 'onClear');
        assert.ok(attribute, relative);
        const state = { filters: { q: 'abc', status: 'VERIFIED', carType: 'CAR_7' }, ledgerFilters: { q: 'abc', type: 'TOPUP' },
          ledgerMeta: { page: 4, total: 99 }, draft: { q: 'abc', from: '2026-11-01' }, page: 4 };
        const scope = {};
        for (const name of ['SearchText', 'QInput', 'Q', 'PendingWithdrawSearch', 'ApprovedWithdrawSearch', 'PaidWithdrawSearch', 'Search', 'Filters', 'LedgerFilters', 'LedgerMeta', 'Draft', 'Page']) {
          const key = name[0].toLowerCase() + name.slice(1);
          scope[`set${name}`] = update => { state[key] = typeof update === 'function' ? update(state[key]) : update; };
        }
        const callback = new Function(...Object.keys(scope), `return (${attribute.initializer.expression.getText(source)});`)(...Object.values(scope));
        callback();
        const value = node.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.getText(source) === 'value').initializer.expression.getText(source);
        const read = value => value.split('.').reduce((obj, key) => obj?.[key], state);
        assert.equal(read(value), '', `${relative}: ${value}`);
        assert.equal(state.filters.status, 'VERIFIED'); assert.equal(state.filters.carType, 'CAR_7');
        assert.equal(state.ledgerFilters.type, 'TOPUP'); assert.equal(state.draft.from, '2026-11-01');
        if (['AdminCustomers.jsx', 'AdminDrivers.jsx', 'AdminFeedback.jsx', 'PartnerConsole.jsx'].some(file => relative.endsWith(file))) assert.equal(state.page, 1);
        if (value === 'qInput') assert.equal(state.q, '');
        if (value === 'ledgerFilters.q') assert.equal(state.ledgerMeta.page, 1);
        if (value === 'draft.q') { assert.equal(state.filters.q, ''); assert.equal(state.page, 0); }
        checked++;
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.equal(checked, 15);
});
