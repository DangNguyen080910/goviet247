const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

test('Driver hides the phone/copy/dial controls even when an older API response contains the partner number', async () => {
  const source = fs.readFileSync(path.join(root, 'apps/driver-mobile/app/dashboard.tsx'), 'utf8');
  const tree = ts.createSourceFile('dashboard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let guard, label;
  function visit(node) {
    if (ts.isJsxExpression(node) && node.expression && ts.isBinaryExpression(node.expression)
      && ts.isJsxFragment(node.expression.right) && node.expression.right.getText(tree).includes('callCustomer(trip.riderPhone)')) {
      guard = node.expression.left.getText(tree);
    }
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === 'TripChatButton') {
      const attribute = node.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(tree) === 'label');
      if (attribute?.initializer?.expression?.getText(tree).includes('trip.isPartnerTrip')) label = attribute.initializer.expression.getText(tree);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(guard); assert.ok(label);
  const { phoneCallUrl } = await import('../apps/api/src/shared/tripContact.js');
  const visible = new Function('trip', 'phoneCallUrl', `return (${guard});`);
  const chatLabel = new Function('trip', `return (${label});`);
  assert.equal(visible({ isPartnerTrip: true, riderPhone: '0903333333' }, phoneCallUrl), false);
  assert.equal(visible({ isPartnerTrip: false, riderPhone: '0901111111' }, phoneCallUrl), true);
  assert.equal(visible({ isPartnerTrip: false, riderPhone: '' }, phoneCallUrl), false);
  assert.equal(chatLabel({ isPartnerTrip: true }), 'Chat / Gọi điều phối viên');
});

test('in-app calling still resolves the assigned coordinator privately without needing a number in the Driver payload', async () => {
  const { tripCallParties, callView } = await import('../apps/api/src/services/tripCallPolicy.js');
  let lookup;
  const db = { driverProfile: { findUnique: async () => ({ status: 'VERIFIED' }) },
    partnerMember: { findUnique: async () => ({ id: 'assigned', companyId: 'company', isActive: true,
      mustChangePassword: false, company: { isActive: true }, phone: '0903333333' }) },
    phone: { findMany: async options => { lookup = options; return [{ userId: 'coordinator' }]; } } };
  const parties = await tripCallParties(db, { status: 'ACCEPTED', driverId: 'driver',
    partnerCompanyId: 'company', partnerAssignedToId: 'assigned', riderPhone: '' });
  assert.equal(parties.receiver.id, 'partner-assigned');
  assert.ok(parties.receiver.aliases.includes('coordinator'));
  assert.equal(parties.receiver.label, 'Điều phối viên');
  assert.equal(lookup.where.isVerified, true);
  assert.doesNotMatch(JSON.stringify(parties), /0903333333/);
  const result = callView({ id: 'call', tripId: 'trip', status: 'RINGING',
    callerLabel: 'Tài xế', calleeLabel: 'Điều phối viên', phone: '0903333333' });
  assert.doesNotMatch(JSON.stringify(result), /0903333333/);
});
