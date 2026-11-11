// Compare stored addresses before masking can make different destinations look alike.
function addressKey(value) {
  return String(value || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function dropoffIsRepresented(trip) {
  const dropoff = addressKey(trip?.dropoffAddress || trip?.dropoffAddressMasked);
  const lastStop = trip?.stops?.at(-1);
  const pickup = addressKey(trip?.pickupAddress || trip?.pickupAddressMasked);
  return Boolean(dropoff && (
    dropoff === addressKey(lastStop?.address || lastStop?.addressMasked) ||
    (lastStop && trip?.direction === 'ROUND_TRIP' && dropoff === pickup)
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
  for (const stop of trip?.stops || []) addDestination(address(stop.address, stop.addressMasked));
  if (!(trip?.dropoffAlreadyInRoute ?? dropoffIsRepresented(trip))) {
    addDestination(address(trip?.dropoffAddress, trip?.dropoffAddressMasked));
  }
  if (String(trip?.direction || '').toUpperCase() === 'ROUND_TRIP' && pickup && destination) {
    points.push({ address: pickup, label: 'Quay về điểm đón' });
  }
  return points;
}
