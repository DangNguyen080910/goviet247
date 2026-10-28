import { calculateDriverFinanceSnapshot } from './driverFinanceService.js';
export function adminTripMoney(trip, config) {
  const fields = { destinationService: trip.destinationService ?? null, holidaySurcharge: trip.holidaySurcharge ?? null, driverReceive: null, driverReceiveEstimated: false };
  if (trip.driverReceiveSnapshot != null) fields.driverReceive = Number(trip.driverReceiveSnapshot);
  else if (trip.status === 'PENDING' && config) {
    fields.driverReceive = calculateDriverFinanceSnapshot({ ...config, totalPrice: trip.totalPrice }).driverReceiveAmount;
    fields.driverReceiveEstimated = true;
  }
  return fields;
}
