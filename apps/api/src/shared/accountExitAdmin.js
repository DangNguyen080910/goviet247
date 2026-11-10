export const ACCOUNT_EXIT_FILTERS = ['all', 'requested', 'pending', 'returned', 'unrecorded'];
export function matchesAccountExit(requests, filter) {
  const request = requests?.[0];
  if (filter === 'all') return true;
  if (filter === 'requested') return Boolean(request);
  if (filter === 'pending') return Boolean(request && !request.returnedAt);
  if (filter === 'returned') return Boolean(request?.returnedAt);
  return filter === 'unrecorded' && !request;
}
// Null dates always come last in both directions, before pagination.
export function compareAccountExitDates(a, b, column, direction) {
  const field = column === 'exitReturnedAt' ? 'returnedAt' : 'requestedAt';
  const av = a?.[0]?.[field] ? new Date(a[0][field]).getTime() : NaN;
  const bv = b?.[0]?.[field] ? new Date(b[0][field]).getTime() : NaN;
  if (!Number.isFinite(av)) return Number.isFinite(bv) ? 1 : 0;
  if (!Number.isFinite(bv)) return -1;
  return (av - bv) * direction;
}
