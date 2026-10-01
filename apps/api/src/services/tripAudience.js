import { prisma } from '../utils/db.js';
// Read persisted audience for EVERY event, including resend, cancel and status changes.
// Fail closed: a DB failure must never fall back to the public room.
export async function emitDriverTripEvent(io, event, payload) {
  if (!io) return;
  try {
    const id = payload.tripId || payload.id;
    if (!id) return;
    const trip = await prisma.trip.findUnique({ where: { id }, select: { audienceDriverIds: true } });
    if (!trip || !Array.isArray(trip.audienceDriverIds)) return;
    const rooms = trip.audienceDriverIds.length ? trip.audienceDriverIds.map(id => `driver:${id}`) : ['drivers'];
    io.to(rooms).emit(event, payload);
  } catch (error) { console.error('[Trip audience] socket delivery failed', error); }
}
