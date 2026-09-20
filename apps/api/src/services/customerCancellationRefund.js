const HOLD_TO_REFUND = [
  ["COMMISSION_HOLD", "COMMISSION_REFUND", "commissionAmountSnapshot", "phí môi giới"],
  ["DRIVER_VAT_HOLD", "DRIVER_VAT_REFUND", "driverVatAmountSnapshot", "VAT tài xế"],
  ["DRIVER_PIT_HOLD", "DRIVER_PIT_REFUND", "driverPitAmountSnapshot", "PIT tài xế"],
];

function conflict(message) {
  return Object.assign(new Error(message), { statusCode: 409 });
}

// Caller holds the driver-profile row lock and the trip row lock in one transaction.
// Every credit and the cancellation commit together, or none of them commit.
export async function refundCustomerCancellationHold(tx, trip) {
  const profileId = trip.driver?.driverProfile?.id;
  if (!trip.driverId || !profileId) return { amount: 0, transactions: [] };

  const holds = await tx.driverWalletTransaction.findMany({
    where: {
      driverProfileId: profileId, tripId: trip.id,
      type: { in: HOLD_TO_REFUND.map(([type]) => type) },
    },
    select: { type: true, amount: true },
  });
  const expected = Number(trip.requiredWalletAmountSnapshot ??
    (Number(trip.commissionAmountSnapshot || 0) + Number(trip.driverVatAmountSnapshot || 0) + Number(trip.driverPitAmountSnapshot || 0)));
  if (!Number.isSafeInteger(expected) || expected < 0) {
    throw conflict("Khoản giữ ví của chuyến không hợp lệ; chưa huỷ hay hoàn ví.");
  }

  const parts = [];
  for (const [holdType, refundType, snapshotKey, label] of HOLD_TO_REFUND) {
    const matches = holds.filter((item) => item.type === holdType);
    const snapshotAmount = Number(trip[snapshotKey] || 0);
    if (matches.length > 1 || !Number.isSafeInteger(snapshotAmount) || snapshotAmount < 0 ||
        matches.length !== (snapshotAmount > 0 ? 1 : 0) ||
        (matches.length === 1 && Number(matches[0].amount) !== -snapshotAmount)) {
      throw conflict("Khoản giữ ví không khớp chuyến hoặc tài xế đã nhận chuyến nhiều lần; chưa huỷ hay hoàn ví.");
    }
    if (snapshotAmount > 0) parts.push({ refundType, amount: snapshotAmount, label });
  }
  const amount = parts.reduce((sum, part) => sum + part.amount, 0);
  if (amount !== expected) throw conflict("Tổng khoản giữ ví không khớp chuyến; chưa huỷ hay hoàn ví.");
  if (amount === 0) return { amount: 0, transactions: [] };

  // Old manual refunds may use ADJUST_ADD. Any existing credit for this
  // driver and trip needs a human review to avoid a second refund.
  const previousCredits = await tx.driverWalletTransaction.findMany({
    where: {
      driverProfileId: profileId,
      OR: [{ tripId: trip.id }, { note: { contains: trip.id } }],
      type: { in: ["COMMISSION_REFUND", "DRIVER_VAT_REFUND", "DRIVER_PIT_REFUND", "ADJUST_ADD"] },
    },
    select: { amount: true },
  });
  if (previousCredits.length) {
    throw conflict("Chuyến đã có giao dịch cộng/hoàn ví cho tài xế. Kiểm tra lịch sử ví trước khi huỷ để tránh hoàn hai lần.");
  }

  const profile = await tx.driverProfile.update({
    where: { id: profileId },
    data: { balance: { increment: amount } },
    select: { balance: true },
  });
  let balance = Number(profile.balance) - amount;
  const transactions = [];
  for (const part of parts) {
    const balanceBefore = balance;
    balance += part.amount;
    transactions.push(await tx.driverWalletTransaction.create({
      data: {
        driverProfileId: profileId, tripId: trip.id, type: part.refundType,
        amount: part.amount, balanceBefore, balanceAfter: balance,
        note: `Hoàn khoản giữ chuyến khách huỷ - TripID: ${trip.id} (${part.label})`,
      },
    }));
  }
  return { amount, transactions, balanceAfter: balance };
}
