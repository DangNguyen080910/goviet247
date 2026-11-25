const MINUTE = 60000;
const DAY = 86400000;
const VN_OFFSET = 7 * 60 * MINUTE;

export const DEFAULT_WAITING_RULES = Object.freeze({
  freeWaitingMinutes: 60,
  nightStartHour: 22,
  nightEndHour: 6,
  nightMinWaitHours: 4,
});

export function validateWaitingRules(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Cấu hình chờ/qua đêm không hợp lệ.";
  for (const [key, max] of [["freeWaitingMinutes", 1440], ["nightStartHour", 23], ["nightEndHour", 23]]) {
    if (typeof value[key] !== "number" || !Number.isInteger(value[key]) || value[key] < 0 || value[key] > max) return `${key} không hợp lệ.`;
  }
  const hours = (24 + value.nightEndHour - value.nightStartHour) % 24;
  if (!hours || typeof value.nightMinWaitHours !== "number" || !Number.isFinite(value.nightMinWaitHours) || value.nightMinWaitHours <= 0 || value.nightMinWaitHours > hours) return "Số giờ chờ tối thiểu qua đêm phải lớn hơn 0 và không vượt độ dài khung nghỉ đêm.";
  const rate = value.overnightPricePerHour;
  if (rate != null && (typeof rate !== "number" || !Number.isSafeInteger(rate) || rate < 0 || rate > 2147483647)) return "Giá chờ lưu trú qua đêm phải là số nguyên không âm hoặc để trống.";
  return "";
}

export function validateOvernightWaitingPrice(rules, overnightFee) {
  if (rules?.overnightPricePerHour == null) return "";
  // A newly qualifying night removes up to ceil(threshold) hourly charges.
  // Its fee must cover those hours, otherwise later nights could lower the fare.
  const minimum = Math.ceil(rules.nightMinWaitHours) * rules.overnightPricePerHour;
  return Number(overnightFee) < minimum
    ? `Phụ phí mỗi đêm phải từ ${minimum.toLocaleString("vi-VN")}đ khi dùng giá chờ lưu trú này để giá không giảm lúc đủ điều kiện nghỉ đêm.`
    : "";
}

// Only waiting at the destination qualifies. Driving across midnight does not.
// Use Vietnam calendar windows, including the preceding day's overnight window.
export function calculateWaitingTime(arrival, returnTime, configuredRules, excludedIntervals = []) {
  const rules = configuredRules || DEFAULT_WAITING_RULES;
  const error = validateWaitingRules(rules);
  if (error) throw new Error(error);
  const start = arrival.getTime();
  const end = returnTime.getTime();
  const waitMinutes = Math.max(0, Math.round((end - start) / MINUTE));
  const windowHours = (24 + rules.nightEndHour - rules.nightStartHour) % 24;
  const threshold = rules.nightMinWaitHours * 60 * MINUTE;
  const firstDay = Math.floor((start + VN_OFFSET) / DAY) - 1;
  const lastDay = Math.floor((end + VN_OFFSET) / DAY);
  let overnightCount = 0;
  let coveredMs = 0;
  let firstOvernightAt = null;
  const nightIntervals = [];
  for (let day = firstDay; day <= lastDay; day++) {
    const windowStart = day * DAY - VN_OFFSET + rules.nightStartHour * 60 * MINUTE;
    const windowEnd = windowStart + windowHours * 60 * MINUTE;
    const overlap = Math.max(0, Math.min(end, windowEnd) - Math.max(start, windowStart));
    if (overlap > 0 && overlap >= threshold) {
      firstOvernightAt ??= new Date(Math.max(start, windowStart) + threshold).toISOString();
      overnightCount++;
      coveredMs += overlap;
      nightIntervals.push([Math.max(start, windowStart), Math.min(end, windowEnd)]);
    }
  }
  const overnightCoveredMinutes = Math.round(coveredMs / MINUTE);
  const intervals = [...nightIntervals, ...excludedIntervals.flatMap(i => {
    const from = Math.max(start, new Date(i.start).getTime()), to = Math.min(end, new Date(i.end).getTime());
    let segments = [[from, to]];
    for (const [a,b] of nightIntervals) segments = segments.flatMap(([x,y]) => y <= a || x >= b ? [[x,y]] : [[x,Math.min(y,a)],[Math.max(x,b),y]].filter(([u,v]) => v > u));
    let remaining = i.flexible ? Math.max(0, Number(i.hours) * 60 * MINUTE) : Infinity;
    return segments.flatMap(([a,b]) => { const length = Math.min(Math.max(0,b-a), remaining); remaining -= length; return length > 0 ? [[a,a+length]] : []; });
  })].filter(([a,b]) => b>a).sort((a,b)=>a[0]-b[0]);
  let unionMs=0, cursorStart=null, cursorEnd=null;
  for (const [a,b] of intervals) {
    if (cursorStart === null) { cursorStart=a; cursorEnd=b; }
    else if (a <= cursorEnd) cursorEnd=Math.max(cursorEnd,b);
    else { unionMs+=cursorEnd-cursorStart; cursorStart=a; cursorEnd=b; }
  }
  if (cursorStart !== null) unionMs+=cursorEnd-cursorStart;
  const serviceCoveredMinutes = Math.max(0, Math.round((unionMs-coveredMs)/MINUTE));
  const hourlyWaitMinutes = Math.max(0, waitMinutes - overnightCoveredMinutes - serviceCoveredMinutes);
  const billableWaitMinutes = Math.max(0, hourlyWaitMinutes - rules.freeWaitingMinutes);
  return { serviceCoveredMinutes, waitMinutes, overnightCount, firstOvernightAt, overnightCoveredMinutes, hourlyWaitMinutes,
    freeWaitingMinutes: rules.freeWaitingMinutes, billableWaitMinutes,
    billableWaitHours: Math.ceil(billableWaitMinutes / 60), waitingRules: rules };
}

// The lower boundary belongs to the previous tier (0–50, >50–100).
export function waitingRateForDistance(km, tiers, fallback) {
  const tier = tiers.find(t => km >= t.from && (t.to == null || km <= t.to));
  return Number(tier?.pricePerWaitHour ?? fallback);
}

export function calculateTieredWaitingCost(km, hours, tiers, fallback, distanceCostAt, overnight = {}) {
  if (overnight.count > 0 && overnight.pricePerHour != null) {
    const pricePerHour = overnight.pricePerHour;
    const hourlyWaitCost = hours * pricePerHour;
    // A fixed first-night transition floor prevents a few extra minutes from
    // making the trip cheaper. It never grows with additional waiting days.
    const beforeNight = calculateTieredWaitingCost(km, overnight.beforeNightHours ?? 0, tiers, fallback, distanceCostAt);
    const nightTransitionAdjustment = Math.max(0, beforeNight.waitCost - hourlyWaitCost - overnight.count * overnight.fee);
    return { pricePerHour, hourlyWaitCost, waitingTierAdjustment: 0, nightTransitionAdjustment,
      waitingPricingMode: "OVERNIGHT_FLAT", waitCost: hourlyWaitCost + nightTransitionAdjustment };
  }
  const pricePerHour = waitingRateForDistance(km, tiers, fallback);
  const hourlyWaitCost = hours * pricePerHour;
  let combinedCost = distanceCostAt(km) + hourlyWaitCost;
  // Carry forward the fare immediately before each crossed boundary. This
  // prevents a cheaper hourly tier from making a longer trip cost less.
  for (const tier of tiers) {
    if (tier.to == null || tier.to >= km) continue;
    const boundaryCost = distanceCostAt(tier.to) + hours * Number(tier.pricePerWaitHour ?? fallback);
    combinedCost = Math.max(combinedCost, boundaryCost);
  }
  const waitingTierAdjustment = Math.max(0, Math.round(combinedCost - distanceCostAt(km) - hourlyWaitCost));
  return { pricePerHour, hourlyWaitCost, waitingTierAdjustment, nightTransitionAdjustment: 0, waitingPricingMode: "DISTANCE_TIER",
    waitCost: hourlyWaitCost + waitingTierAdjustment };
}
