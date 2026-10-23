import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "../utils/db.js";
import { userSessions } from "./userSessions.js";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const text = (value, max) => typeof value === "string" ? value.trim().slice(0, max) || null : null;
export const historyCutoff = () => new Date(Date.now() - 90 * 86400000);
let inFlight = 0;

// Recording is optional analytics, never a prerequisite for returning a fare.
export async function recordQuoteHistory(req, quote) {
  if (inFlight >= 50) return null;
  inFlight++;
  try {
    const setting = await prisma.quoteHistorySetting.findUnique({ where: { id: 1 } });
    if (setting?.enabled === false) return null;
    const input = req.body || {};
    const context = input.historyContext || {};
    let user = null;
    const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7).trim() : "";
    if (token) {
      try {
        const claims = await userSessions.verify(token);
        user = await prisma.user.findUnique({
          where: { id: claims.uid || claims.id },
          select: { id: true, displayName: true, phones: { select: { e164: true, isVerified: true }, take: 1 } },
        });
      } catch { /* Anonymous quotes remain available when a session expires. */ }
    }
    const visitorId = text(context.visitorId, 120);
    const bookingToken = randomBytes(32).toString("hex");
    const stops = Array.isArray(context.stops) ? context.stops.slice(0, 20).map(value => text(value, 800)).filter(Boolean) : [];
    // Account identity is verified separately from the contact entered in the form.
    const row = await prisma.quoteHistory.create({ data: {
      id: randomUUID(),
      userId: user?.id || null,
      customerKey: user ? hash(`account:${user.id}`) : visitorId ? hash(`visitor:${visitorId}`) : null,
      customerName: text(context.customerName, 150) || user?.displayName || null,
      customerPhone: text(context.customerPhone, 40) || user?.phones?.[0]?.e164 || null,
      identityVerified: Boolean(user),
      source: ["WEB", "ANDROID", "IOS"].includes(context.source) ? context.source : "UNKNOWN",
      pickupAddress: text(context.pickupAddress, 800), stops,
      pickupTime: new Date(input.pickupTime),
      returnTime: input.returnTime ? new Date(input.returnTime) : null,
      carType: input.carType, direction: input.direction, fuelPreference: input.fuelPreference || "ANY",
      distanceKm: Number(input.distanceKm),
      driveMinutes: input.driveMinutes == null ? null : Number(input.driveMinutes),
      finalPrice: Math.round(Number(quote.finalPrice)), bookingTokenHash: hash(bookingToken),
    } });
    return { quoteHistoryId: row.id, quoteHistoryToken: bookingToken };
  } catch (error) {
    console.error("[QuoteHistory] Recording unavailable:", error?.code || "ERROR");
    return null;
  } finally { inFlight--; }
}

export async function linkQuoteToTrip(token, trip) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token) || !trip.pickupTime || !trip.carType || !trip.direction) return;
  try {
    await prisma.quoteHistory.updateMany({
      where: {
        bookingTokenHash: hash(token), tripId: null, createdAt: { gte: historyCutoff() },
        carType: trip.carType, direction: trip.direction, pickupTime: trip.pickupTime,
        returnTime: trip.returnTime || null,
        OR: [{ userId: null }, { userId: trip.riderId || "" }],
      },
      data: { tripId: trip.id, bookedAt: new Date() },
    });
  } catch (error) { console.error("[QuoteHistory] Booking link unavailable:", error?.code || "ERROR"); }
}

export function startQuoteHistoryCleanup() {
  const cleanup = async () => {
    try {
      // Bounded batches avoid a large delete blocking normal traffic.
      await prisma.$executeRaw`DELETE FROM "QuoteHistory" WHERE "id" IN
        (SELECT "id" FROM "QuoteHistory" WHERE "createdAt" < ${historyCutoff()} ORDER BY "createdAt" LIMIT 5000)`;
    } catch (error) { console.error("[QuoteHistory] Cleanup unavailable:", error?.code || "ERROR"); }
  };
  const first = setTimeout(cleanup, 60000);
  const interval = setInterval(cleanup, 3600000);
  first.unref(); interval.unref();
}
