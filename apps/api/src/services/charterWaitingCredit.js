// A service day may replace hourly waiting, never a kilometre/transition floor.
// Per-day limits make adding any day nondecreasing even after percentage
// surcharges (which exclude charter fees) and integer VND rounding.
export function calculateCharterWaitingCredit(standardHourlyWaitCost, pricePerHour, sessions, surchargePercents) {
  const percents = surchargePercents.filter(percent => percent > 0);
  const worstReduction = credit => credit + percents.reduce((sum, percent) => sum + Math.ceil(credit * percent / 100), 0);
  let remaining = standardHourlyWaitCost;
  const days = sessions.map(session => {
    // Credit actual covered minutes; do not round a short service interval up
    // to another complete billable waiting hour.
    const requestedCredit = Math.max(0, Math.round(session.coveredMinutes * pricePerHour / 60));
    let low = 0, high = requestedCredit;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (worstReduction(mid) <= session.fee) low = mid;
      else high = mid - 1;
    }
    const credit = Math.min(remaining, low);
    remaining -= credit;
    return { date: session.date, coveredMinutes: session.coveredMinutes, requestedCredit,
      maximumCredit: low, credit };
  });
  return { credit: standardHourlyWaitCost - remaining, days };
}
