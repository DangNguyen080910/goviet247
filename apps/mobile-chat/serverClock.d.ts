export type ServerClock = {
  now(): number;
  monotonicNow(): number;
  sync(payload: { serverTime?: unknown; serverReceivedAt?: unknown } | null | undefined, requestStartedAt: number): boolean;
};
export function createServerClock(options?: { monotonicNow?: () => number; wallNow?: () => number }): ServerClock;
export function acceptCountdownSeconds(openAt: string | null | undefined, nowMs: number): number;
