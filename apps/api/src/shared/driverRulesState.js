// Never let an earlier in-flight response erase a newer acknowledgement or release.
export function mergeDriverRulesStatus(previous, next) {
  if (!previous || previous.driverProfileId !== next.driverProfileId) return next;
  if (previous.release?.version > (next.release?.version || 0)) return previous;
  if (previous.release?.id === next.release?.id && previous.acceptance && !next.acceptance) return previous;
  return next;
}
