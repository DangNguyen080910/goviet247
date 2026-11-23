import { createHash } from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');
export function bookingRequestKey(req) {
  const raw = req.body?.bookingRequestId || req.body?.quoteHistoryToken;
  if (!raw) return null; // Released clients without this optional key remain compatible.
  if (typeof raw !== 'string' || raw.length > 150) throw Object.assign(new Error('Mã yêu cầu đặt chuyến không hợp lệ.'),{status:400});
  const actor = req.user?.uid || req.user?.id || req.partnerTripData?.partnerCreatedById || req.partnerTripData?.partnerAssignedToId;
  if (!actor) throw Object.assign(new Error('Vui lòng xác thực trước khi đặt chuyến.'),{status:401});
  return hash(JSON.stringify([actor,req.partnerTripData?.partnerCompanyId || '',raw]));
}
export function bookingInputHash(data) {
  return hash(JSON.stringify([data.riderId || null,data.partnerCompanyId || null,
    data.pickupAddress,data.bookingStops || data.partnerStops || [],
    new Date(data.pickupTime).toISOString(),data.returnTime ? new Date(data.returnTime).toISOString() : null,
    data.carType,data.direction,data.fuelPreference || 'ANY',data.riderName || '',data.riderPhone || '',data.note || '']));
}
