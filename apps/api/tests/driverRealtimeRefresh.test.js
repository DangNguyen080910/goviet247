import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('an event arriving during a driver list refresh schedules another fetch', async () => {
  const source = readFileSync(new URL('../../driver-mobile/app/dashboard.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('  const reloadTripsFromRealtime = useCallback(');
  const end = source.indexOf(', [loadAvailableTrips, loadMyTrips]);', start);
  const fn = source.slice(start, end).split('useCallback(')[1];
  let release;
  let availableLoads = 0;
  let mineLoads = 0;
  const firstFetch = new Promise(resolve => { release = resolve; });
  const refresh = new Function('realtimeLoadingRef', 'realtimeReloadPendingRef', 'loadAvailableTrips', 'loadMyTrips', `return (${fn});`)(
    { current: false }, { current: false },
    async () => { if (++availableLoads === 1) await firstFetch; },
    async () => { mineLoads++; },
  );
  const running = refresh();
  await refresh();
  await refresh();
  assert.equal(availableLoads, 1, 'overlapping events must not run parallel loads');
  release();
  await running;
  assert.equal(availableLoads, 2, 'must fetch the newest state after the in-flight request');
  assert.equal(mineLoads, 2);
  await refresh();
  assert.equal(availableLoads, 3, 'subsequent events must still work');
});
