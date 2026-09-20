const HOLD_TYPES = new Set(["COMMISSION_HOLD", "DRIVER_VAT_HOLD", "DRIVER_PIT_HOLD"]);

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
    if (!HOLD_TYPES.has(item.type) || !item.tripId || !item.driverProfileId) continue;
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
      const held = holds.filter((hold) => eventTime(hold) > previousPenaltyAt && eventTime(hold) <= penaltyAt)
        .reduce((sum, hold) => sum + Math.abs(Number(hold.amount || 0)), 0);
      if (held > 0 && held === Math.abs(Number(penalty.amount || 0))) shadowIds.add(penalty.id);
      previousPenaltyAt = penaltyAt;
    }
  }

  const withdrawRequestMap = new Map(list
    .filter((item) => item?.type === "WITHDRAW_REQUEST" && item?.withdrawRequestId)
    .map((item) => [String(item.withdrawRequestId), item]));

  return list.filter((item) => item.type !== "WITHDRAW_REQUEST" && !shadowIds.has(item.id))
    .map((item) => {
      // Admin debit rows store a positive requested amount; the wallet balance
      // still decreases. Export the signed movement so the CSV reconciles.
      if (item.type === "ADJUST_SUBTRACT") return { ...item, amount: -Math.abs(Number(item.amount || 0)) };
      if (item.type !== "WITHDRAW_PAID") return item;
      const requestRow = item.withdrawRequestId ? withdrawRequestMap.get(String(item.withdrawRequestId)) : null;
      return {
        ...item,
        amount: -Math.abs(Number(requestRow?.amount ?? item.amount ?? 0)),
        ...(requestRow ? { balanceBefore: requestRow.balanceBefore, balanceAfter: requestRow.balanceAfter } : {}),
      };
    });
}
