import { normalizeDriverWalletItemsForAccounting } from "./walletAccounting.js";

const FEE_TYPES = {
  COMMISSION_HOLD: "COMMISSION_HOLD",
  DRIVER_VAT_HOLD: "COMMISSION_HOLD",
  DRIVER_PIT_HOLD: "COMMISSION_HOLD",
  COMMISSION_REFUND: "COMMISSION_REFUND",
  DRIVER_VAT_REFUND: "COMMISSION_REFUND",
  DRIVER_PIT_REFUND: "COMMISSION_REFUND",
};

function feeGroupKey(item) {
  // Older assignments wrote the parts in one transaction with the same timestamp.
  const assignment = item.walletHoldId ||
    (item.tripId ? [item.tripId, new Date(item.createdAt).getTime()] : item.id);
  return JSON.stringify([FEE_TYPES[item.type], assignment]);
}

export async function loadDriverWalletHistory(db, driverProfileId, limit, include) {
  const wallet = db.driverWalletTransaction;
  const orderBy = [{ createdAt: "desc" }, { id: "desc" }];
  const items = await wallet.findMany({
    where: { driverProfileId },
    orderBy,
    take: limit * 3,
    include,
  });

  // Complete the groups even if the last page row falls inside a split charge.
  const scopedIds = new Set();
  const legacyTripIds = new Set();
  for (const item of items) {
    if (!FEE_TYPES[item.type] && item.type !== "TRIP_CANCEL_PENALTY") continue;
    if (item.walletHoldId) scopedIds.add(item.walletHoldId);
    else if (item.tripId) legacyTripIds.add(item.tripId);
  }
  const scopes = [];
  if (scopedIds.size) scopes.push({ walletHoldId: { in: [...scopedIds] } });
  if (legacyTripIds.size) scopes.push({ tripId: { in: [...legacyTripIds] } });
  const related = scopes.length ? await wallet.findMany({
    where: {
      driverProfileId,
      type: { in: [...Object.keys(FEE_TYPES), "TRIP_CANCEL_PENALTY"] },
      OR: scopes,
    },
  }) : [];

  const groups = new Map();
  const referenceRows = new Map([...related, ...items].map(item => [item.id, item]));
  for (const item of referenceRows.values()) {
    if (!FEE_TYPES[item.type]) continue;
    const key = feeGroupKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  const accountingIds = new Set(normalizeDriverWalletItemsForAccounting([...referenceRows.values()]).map(item => item.id));
  const visible = [];
  const shown = new Set();
  for (const item of items) {
    const type = FEE_TYPES[item.type];
    if (type) {
      const key = feeGroupKey(item);
      if (shown.has(key)) continue;
      shown.add(key);
      const group = groups.get(key);
      const isHold = type === "COMMISSION_HOLD";
      visible.push({
        ...item,
        type,
        note: null,
        amount: group.reduce((total, row) => total + row.amount, 0),
        balanceBefore: (isHold ? Math.max : Math.min)(...group.map(row => row.balanceBefore)),
        balanceAfter: (isHold ? Math.min : Math.max)(...group.map(row => row.balanceAfter)),
      });
    } else if (item.type === "TRIP_CANCEL_PENALTY" && !accountingIds.has(item.id)) {
      visible.push({
        ...item,
        amount: Math.abs(item.amount),
        balanceBefore: item.balanceAfter,
        note: "Đã giữ từ phí nhận chuyến.",
        balanceUnchanged: true,
      });
    } else {
      visible.push(item);
    }
    if (visible.length === limit) break;
  }
  return visible;
}
