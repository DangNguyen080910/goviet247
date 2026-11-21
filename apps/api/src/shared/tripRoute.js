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
  if (pickup) points.push({ address: pickup, label: 'Điểm đón' });

  let destination = 0;
  const addDestination = value => {
    if (value) points.push({ address: value, label: `Điểm đến ${++destination}` });
  };
  // A repeated address is another visit. Never deduplicate all destinations.
  for (const stop of orderedStops(trip)) addDestination(address(stop.address, stop.addressMasked));
  if (!(trip?.dropoffAlreadyInRoute ?? dropoffIsRepresented(trip))) {
    addDestination(address(trip?.dropoffAddress, trip?.dropoffAddressMasked));
  }
  if (tripDirection(trip) === 'ROUND_TRIP' && pickup && destination) {
    points.push({ address: pickup, label: 'Quay về điểm đón' });
  }
  return points;
}

export function tripDestinationPoints(trip, options) {
  return tripRoutePoints(trip, options).filter(point => point.label !== 'Điểm đón');
}
