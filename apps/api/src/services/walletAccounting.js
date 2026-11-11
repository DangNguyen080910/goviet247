const HOLD_TYPES = new Set(["COMMISSION_HOLD", "DRIVER_VAT_HOLD", "DRIVER_PIT_HOLD"]);
const REFUND_TYPES = new Set(["COMMISSION_REFUND", "DRIVER_VAT_REFUND", "DRIVER_PIT_REFUND"]);

function eventTime(item) {
  return new Date(item.createdAt || 0).getTime();
}

function walletKey(item) {
  return `${item.driverProfileId || ""}:${item.tripId || ""}`;
}

// Penalty rows created by the legacy driver-cancellation flow reclassify an
// existing hold. They are not another wallet debit. Keep any unmatched row.
export function normalizeDriverWalletItemsForAccounting(items = [], holdReferences = []) {
  const list = Array.isArray(items) ? items : [];
  const references = [...list, ...(Array.isArray(holdReferences) ? holdReferences : [])];
  const holdsByKey = new Map();
  for (const item of references) {
    if ((!HOLD_TYPES.has(item.type) && !REFUND_TYPES.has(item.type)) || !item.tripId || !item.driverProfileId) continue;
    const key = walletKey(item);
    if (!holdsByKey.has(key)) holdsByKey.set(key, new Map());
    holdsByKey.get(key).set(item.id, item);
  }
  const penaltiesByKey = new Map();
  for (const item of list) {
    if (item.type !== "TRIP_CANCEL_PENALTY" || !item.tripId || !item.driverProfileId) continue;
    const key = walletKey(item);
    if (!penaltiesByKey.has(key)) penaltiesByKey.set(key, []);
    penaltiesByKey.get(key).push(item);
  }
  const shadowIds = new Set();
  for (const [key, penalties] of penaltiesByKey) {
    const holds = [...(holdsByKey.get(key)?.values() || [])].sort((a, b) => eventTime(a) - eventTime(b));
    let previousPenaltyAt = -Infinity;
    for (const penalty of penalties.sort((a, b) => eventTime(a) - eventTime(b))) {
      const penaltyAt = eventTime(penalty);
      const held = holds.filter((hold) => eventTime(hold) <= penaltyAt &&
        (penalty.walletHoldId ? hold.walletHoldId === penalty.walletHoldId : eventTime(hold) > previousPenaltyAt))
        .reduce((sum, hold) => sum + (HOLD_TYPES.has(hold.type) ? Math.abs(Number(hold.amount || 0)) : -Math.abs(Number(hold.amount || 0))), 0);
      if (held > 0 && held === Math.abs(Number(penalty.amount || 0))) shadowIds.add(penalty.id);
      previousPenaltyAt = penaltyAt;
    }
  }

  return list.filter((item) => !shadowIds.has(item.id)).map((item) => {
    // The wallet moves when funds are reserved or refunded. A payout only
    // settles the reservation and is recorded as cash out in the company book.
    if (item.type === "WITHDRAW_PAID") return { ...item, amount: 0 };
    if (item.type === "WITHDRAW_REQUEST" || item.type === "ADJUST_SUBTRACT") {
      return { ...item, amount: -Math.abs(Number(item.amount || 0)) };
    }
    return item;
  });
}
