import { prisma } from '../utils/db.js';
import { distanceKm } from '../services/tripAudiencePolicy.js';
export async function listTripAudienceCandidates(req, res) {
  try {
    const trip = await prisma.trip.findUnique({ where: { id: req.params.id } });
    if (!trip) return res.status(404).json({ message: 'Không tìm thấy chuyến.' });
    const config = await prisma.tripConfig.findFirst({ orderBy: { id: 'asc' } });
    const radiusKm = config?.returnSuggestionRadiusKm ?? 20;
    const days = config?.returnSuggestionDays ?? 2;
    const now = new Date();
    const since = new Date(now.getTime() - days * 86400000);
    const history = await prisma.trip.findMany({ where: { driverId: { not: null }, pickupTime: { gte: since }, status: { in: ['ACCEPTED','CONTACTED','IN_PROGRESS','COMPLETED'] } }, orderBy: { pickupTime: 'desc' } });
    const suggestions = new Map();
    for (const outbound of history) {
      if (outbound.direction !== 'ONE_WAY' || outbound.status !== 'COMPLETED' || outbound.pickupTime > now) continue;
      const km = distanceKm(outbound.dropoffLat, outbound.dropoffLng, trip.pickupLat, trip.pickupLng);
      if (km > radiusKm) continue;
      const hasReturn = history.some(back => back.id !== outbound.id && back.driverId === outbound.driverId && back.pickupTime > outbound.pickupTime && distanceKm(back.pickupLat, back.pickupLng, outbound.dropoffLat, outbound.dropoffLng) <= radiusKm && distanceKm(back.dropoffLat, back.dropoffLng, outbound.pickupLat, outbound.pickupLng) <= radiusKm);
      if (!hasReturn && !suggestions.has(outbound.driverId)) suggestions.set(outbound.driverId, { tripId: outbound.id, distanceKm: Math.round(km * 10)/10, pickupTime: outbound.pickupTime });
    }
    const q = String(req.query.q || '').trim().slice(0,100);
    const drivers = await prisma.driverProfile.findMany({ where: { status: 'VERIFIED', tripAcceptBlocked: false, ...(q ? { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { user: { phones: { some: { e164: { contains: q } } } } }, { plateNumber: { contains: q, mode: 'insensitive' } }] } : {}) }, include: { user: { select: { displayName: true, phones: { select: { e164: true } } } } }, orderBy: { userId: 'asc' } });
    const items = drivers.map(d => ({ userId: d.userId, name: d.fullName || d.user.displayName || d.userId, phone: d.user.phones[0]?.e164 || '', plateNumber: d.plateNumber, suggestion: suggestions.get(d.userId) || null })).sort((a,b) => Number(!!b.suggestion)-Number(!!a.suggestion) || (a.suggestion?.distanceKm ?? Infinity)-(b.suggestion?.distanceKm ?? Infinity));
    return res.json({ items, config: { radiusKm, days }, warning: trip.pickupLat == null || trip.pickupLng == null ? 'Chuyến thiếu tọa độ: chỉ có tìm tài xế thủ công.' : 'Gợi ý dựa trên lịch sử trong hệ thống, không phải vị trí hiện tại của tài xế.' });
  } catch (error) { console.error(error); return res.status(500).json({ message: 'Không tải được tài xế.' }); }
}
