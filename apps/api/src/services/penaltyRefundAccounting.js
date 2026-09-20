export function summarizeApprovedPenaltyRefunds(refunds, penalties) {
  const approvedPairs = new Set(
    penalties.map((item) => `${item.tripId}:${item.driverProfileId}`),
  );
  const matched = refunds.filter((item) => {
    const tripId = item.tripId || item.note?.match(/TripID:\s*([a-z0-9]+)/i)?.[1];
    return tripId && approvedPairs.has(`${tripId}:${item.driverProfileId}`);
  });
  return {
    amount: matched.reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0),
    count: matched.length,
    otherHoldRefundAmount: refunds.reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0) -
      matched.reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0),
    otherHoldRefundCount: refunds.length - matched.length,
  };
}
