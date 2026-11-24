// Estimate server time using a monotonic clock: changing the phone's wall clock
// after synchronization cannot move the acceptance countdown.
export function createServerClock({
  monotonicNow = () => globalThis.performance?.now?.() ?? Date.now(),
  wallNow = () => Date.now(),
} = {}) {
  let sample = null;

  function sync(payload, requestStartedAt) {
    const receivedAt = monotonicNow();
    const serverTime = typeof payload?.serverTime === "string" ? Date.parse(payload.serverTime) : NaN;
    const serverReceivedAt = typeof payload?.serverReceivedAt === "string" ? Date.parse(payload.serverReceivedAt) : NaN;
    const roundTripMs = receivedAt - requestStartedAt;
    const processingMs = serverTime - serverReceivedAt;
    if (![receivedAt, requestStartedAt, serverTime, serverReceivedAt].every(Number.isFinite)
      || roundTripMs < 0 || roundTripMs > 10000 || processingMs < 0
      || processingMs > roundTripMs + 5) return false;

    const networkMs = Math.max(0, roundTripMs - processingMs);
    // Ignore older overlapping responses and prefer low-latency samples for one minute.
    if (sample && (requestStartedAt < sample.requestStartedAt
      || (receivedAt - sample.receivedAt < 60000 && networkMs > sample.networkMs))) return false;
    sample = { requestStartedAt, receivedAt, networkMs, serverTime: serverTime + networkMs / 2 };
    return true;
  }

  function now() {
    if (!sample) return wallNow(); // Compatibility before the first response / with an older API.
    return sample.serverTime + Math.max(0, monotonicNow() - sample.receivedAt);
  }

  return { now, sync, monotonicNow };
}

export function acceptCountdownSeconds(openAt, nowMs) {
  const deadline = typeof openAt === "string" ? Date.parse(openAt) : NaN;
  if (!Number.isFinite(deadline) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.ceil((deadline - nowMs) / 1000));
}
