import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { formatChatTimestamp } from '../apps/api/src/shared/chatTimestamp.js';

test('includes zero-padded Vietnam hours/minutes and full date', () => {
  assert.equal(formatChatTimestamp('2026-11-21T22:15:42.123Z'), '05:15 22/11/2026');
  assert.equal(formatChatTimestamp('2026-11-22T05:15:00+07:00'), '05:15 22/11/2026');
});
test('correctly crosses midnight, year and leap-day boundaries', () => {
  assert.equal(formatChatTimestamp('2026-11-21T17:00:00Z'), '00:00 22/11/2026');
  assert.equal(formatChatTimestamp('2026-12-31T17:03:00Z'), '00:03 01/01/2027');
  assert.equal(formatChatTimestamp('2024-02-28T23:05:00Z'), '06:05 29/02/2024');
});
test('uses a 24-hour clock with no unwanted seconds', () => {
  assert.equal(formatChatTimestamp('2026-11-22T16:59:59Z'), '23:59 22/11/2026');
  assert.equal(formatChatTimestamp('2026-11-22T05:00:00Z'), '12:00 22/11/2026');
});
test('handles an explicit offset without applying Vietnam time twice', () => {
  assert.equal(formatChatTimestamp('2026-11-22T01:00:00-05:00'), '13:00 22/11/2026');
});
test('accepts Date and epoch values and preserves the original instant', () => {
  const date = new Date('2026-11-21T22:15:00Z');
  const before = date.getTime();
  assert.equal(formatChatTimestamp(date), '05:15 22/11/2026');
  assert.equal(formatChatTimestamp(before), '05:15 22/11/2026');
  assert.equal(date.getTime(), before);
  assert.equal(formatChatTimestamp(0), '07:00 01/01/1970');
});
test('missing/invalid timestamps never fabricate a send time', () => {
  for (const value of [null, undefined, '', 'bad timestamp', NaN, Infinity, new Date(NaN)]) assert.equal(formatChatTimestamp(value), '');
});
test('works when mobile locale formatters are unavailable', () => {
  const original = Date.prototype.toLocaleString;
  Date.prototype.toLocaleString = () => { throw new Error('Locale formatter unavailable'); };
  try { assert.equal(formatChatTimestamp('2026-11-21T22:15:00Z'), '05:15 22/11/2026'); }
  finally { Date.prototype.toLocaleString = original; }
});
test('is independent of the device or server timezone', () => {
  const moduleUrl = new URL('../apps/api/src/shared/chatTimestamp.js', import.meta.url).href;
  const source = `import { formatChatTimestamp } from ${JSON.stringify(moduleUrl)}; process.stdout.write(formatChatTimestamp('2026-11-21T22:15:00Z'));`;
  for (const tz of ['UTC', 'Asia/Ho_Chi_Minh', 'America/Los_Angeles', 'Asia/Tokyo']) {
    assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', source], { env: { ...process.env, TZ: tz }, encoding: 'utf8' }), '05:15 22/11/2026');
  }
});
