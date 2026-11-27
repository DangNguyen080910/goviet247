// Compare stored addresses before masking can make different destinations look alike.
function addressKey(value) {
  return String(value || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function tripDirection(trip) {
  const direction = String(trip?.direction || trip?.tripType || '').trim().toUpperCase();
  if (direction === 'ROUND_TRIP' || direction === 'ONE_WAY') return direction;
  // Older Admin list responses supplied returnTime without direction.
  return trip?.returnTime ? 'ROUND_TRIP' : 'ONE_WAY';
}

function orderedStops(trip) {
  const stops = Array.isArray(trip?.stops) ? trip.stops.filter(Boolean) : [];
  const sequence = stop => Number(stop.seq ?? stop.order);
  return stops.every(stop => Number.isFinite(sequence(stop)))
    ? stops.slice().sort((a, b) => sequence(a) - sequence(b)) : stops;
}

export function dropoffIsRepresented(trip) {
  const dropoff = addressKey(trip?.dropoffAddress || trip?.dropoffAddressMasked);
  const lastStop = orderedStops(trip).at(-1);
  const pickup = addressKey(trip?.pickupAddress || trip?.pickupAddressMasked);
  return Boolean(dropoff && (
    dropoff === addressKey(lastStop?.address || lastStop?.addressMasked) ||
    (lastStop && tripDirection(trip) === 'ROUND_TRIP' && dropoff === pickup)
  ));
}

export function tripRoutePoints(trip, { masked = false } = {}) {
  const address = (full, hidden) => String((masked ? hidden || full : full || hidden) || '').trim();
  const pickup = address(trip?.pickupAddress, trip?.pickupAddressMasked);
  const points = [];
  const stops = orderedStops(trip);
  const extraPickups = stops.filter(stop => Number(stop.seq) < 0);
  const pickups = [pickup, ...extraPickups.map(stop => address(stop.address, stop.addressMasked))].filter(Boolean);
  pickups.forEach((value, index) => points.push({
    address: value,
    label: pickups.length > 1 ? `Điểm đón ${index + 1}` : 'Điểm đón',
  }));

  let destination = 0;
  const addDestination = value => {
    if (value) points.push({ address: value, label: `Điểm đến ${++destination}` });
  };
  // A repeated address is another visit. Never deduplicate all destinations.
  for (const stop of stops.filter(stop => !(Number(stop.seq) < 0))) addDestination(address(stop.address, stop.addressMasked));
  if (!(trip?.dropoffAlreadyInRoute ?? dropoffIsRepresented(trip))) {
    addDestination(address(trip?.dropoffAddress, trip?.dropoffAddressMasked));
  }
  if (tripDirection(trip) === 'ROUND_TRIP' && pickup && destination) {
    for (let index = pickups.length - 1; index >= 0; index--) {
      points.push({ address: pickups[index], label: pickups.length > 1
        ? `Trả tại điểm đón ${index + 1}` : 'Quay về điểm đón' });
    }
  }
  return points;
}

export function tripDestinationPoints(trip, options) {
  return tripRoutePoints(trip, options).filter(point => point.label !== 'Điểm đón' && point.label !== 'Điểm đón 1');
}

export const MAX_PICKUP_POINTS = 5;
export const MAX_OUTBOUND_POINTS = 12;

export function returnPickupNotice(pickupCount) {
  if (pickupCount <= 1) return 'Khứ hồi: hệ thống sẽ quay về điểm đón ban đầu';
  const stops = Array.from({ length: pickupCount }, (_, index) => `điểm đón ${pickupCount - index}`);
  return `Khứ hồi: hệ thống sẽ quay về ${stops.join(' → ')}`;
}


export const BOOKING_ADDRESS_HINT = 'Để tài xế dễ tìm, vui lòng chọn địa chỉ từ danh sách gợi ý. Nếu không có số nhà, bạn có thể chọn tên tòa nhà, cổng hoặc địa điểm gần đó và ghi thêm mốc đón trong Ghi chú.';
