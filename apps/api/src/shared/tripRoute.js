// Display-only itinerary. Never changes stored stops or fare calculations.
export function tripRoutePoints(trip, { masked = false } = {}) {
  const address = (full, hidden) => String((masked ? hidden || full : full || hidden) || '').trim();
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
  const pickup = address(trip?.pickupAddress, trip?.pickupAddressMasked);
  const points = [];
  const add = (value, label) => {
    if (value && (!points.length || normalize(points[points.length - 1].address) !== normalize(value))) points.push({ address: value, label });
  };
  add(pickup, 'Điểm đón');
  for (const stop of trip?.stops || []) add(address(stop.address, stop.addressMasked), 'Điểm đến');
  add(address(trip?.dropoffAddress, trip?.dropoffAddressMasked), 'Điểm đến');
  if (String(trip?.direction || '').toUpperCase() === 'ROUND_TRIP' && pickup && points.length > 1) {
    add(pickup, 'Quay về điểm đón');
    points[points.length - 1].label = 'Quay về điểm đón';
  }
  let destination = 0;
  return points.map(point => ({ ...point, label: point.label === 'Điểm đến' ? `Điểm đến ${++destination}` : point.label }));
}
