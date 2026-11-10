import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesAccountExit, compareAccountExitDates } from '../src/shared/accountExitAdmin.js';

const pending = [{ requestedAt: '2026-11-10T09:00:00Z', returnedAt: null }];
const returned = [{ requestedAt: '2026-11-09T09:00:00Z', returnedAt: '2026-11-10T10:00:00Z' }];
test('filters distinguish any request, pending, returned and no recorded request', () => {
  const rows = [[], pending, returned];
  assert.deepEqual(rows.filter(x => matchesAccountExit(x, 'all')), rows);
  assert.deepEqual(rows.filter(x => matchesAccountExit(x, 'requested')), [pending, returned]);
  assert.deepEqual(rows.filter(x => matchesAccountExit(x, 'pending')), [pending]);
  assert.deepEqual(rows.filter(x => matchesAccountExit(x, 'returned')), [returned]);
  assert.deepEqual(rows.filter(x => matchesAccountExit(x, 'unrecorded')), [[]]);
  assert.equal(matchesAccountExit(undefined, 'unrecorded'), true);
  assert.equal(matchesAccountExit([], 'invalid'), false);
});
test('sort uses selected event timestamp and puts missing dates last in either direction', () => {
  const rows = [[], pending, returned];
  assert.deepEqual([...rows].sort((a,b) => compareAccountExitDates(a,b,'exitRequestedAt',-1)), [pending,returned,[]]);
  assert.deepEqual([...rows].sort((a,b) => compareAccountExitDates(a,b,'exitRequestedAt',1)), [returned,pending,[]]);
  for (const direction of [-1,1]) {
    assert.equal([...rows].sort((a,b) => compareAccountExitDates(a,b,'exitReturnedAt',direction))[0], returned);
    assert.equal(compareAccountExitDates([],pending,'exitReturnedAt',direction), 0);
  }
});
