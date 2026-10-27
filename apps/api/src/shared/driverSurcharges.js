export function driverSurchargeLines(trip) {
  const saved = trip?.destinationService?.tourDisplay;
  const holiday = saved?.holidaySurcharge ?? trip?.holidaySurcharge;
  const lines = [];
  const valid = (percent, amount) => typeof percent === 'number' && Number.isFinite(percent) && percent > 0 && typeof amount === 'number' && Number.isFinite(amount) && amount > 0;
  if (valid(saved?.fuelSurchargePercent, saved?.fuelSurchargeAmount)) lines.push(`Đã gồm phụ thu xe xăng ${saved.fuelSurchargePercent}%: ${saved.fuelSurchargeAmount.toLocaleString('vi-VN')} đ`);
  if (valid(holiday?.percent, holiday?.amount)) lines.push(`Đã gồm phụ thu lễ, Tết ${holiday.percent}%: ${holiday.amount.toLocaleString('vi-VN')} đ`);
  return lines;
}
