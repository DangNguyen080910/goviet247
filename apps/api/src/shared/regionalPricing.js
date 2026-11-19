const labels = { NORTH: 'Miền Bắc', CENTRAL: 'Miền Trung', SOUTH: 'Miền Nam' };
export function regionalRoutePoints(pickup, destinations) {
  return [pickup, ...destinations].map(place => ({ placeId: String(place?.placeId || ''), address: String(place?.fullAddress || '').trim() }));
}
export function regionalPricingLine(snapshot) {
  if (!labels[snapshot?.appliedRegion] || !Number.isFinite(snapshot?.percent) || snapshot.percent <= 0 || !Number.isSafeInteger(snapshot?.amount) || snapshot.amount <= 0) return null;
  return `Đã gồm điều chỉnh giá ${labels[snapshot.appliedRegion]} ${snapshot.percent}%: ${snapshot.amount.toLocaleString('vi-VN')} đ`;
}
