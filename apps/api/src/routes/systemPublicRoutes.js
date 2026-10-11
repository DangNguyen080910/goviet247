// Path: goviet247/apps/api/src/routes/systemPublicRoutes.js
import { Router } from "express";
import pkg from "@prisma/client";
import { verifyToken } from "../middleware/authMiddleware.js";
import { getVerifiedRiderPhoneVariants } from "../services/riderTripAccess.js";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();
const router = Router();

function notificationItem(item) {
  const rawMessage = String(item.message || "");
  const tripId = rawMessage.match(/\[tripId:([^\]]+)\]/)?.[1] || null;
  const message = rawMessage.replace(/\s*\[tripId:[^\]]+\]\s*/g, "").trim();
  return { ...item, body: message, message, tripId };
}

// Compatibility for rider versions already installed, and public announcements.
router.get("/system-notifications", async (req, res) => {
  try {
    const audience = String(req.query.audience || "").trim().toUpperCase();
    const userId = String(req.query.userId || "").trim();
    const items = await prisma.systemNotification.findMany({
      where: {
        isActive: true,
        ...(audience ? { audience } : {}),
        OR: [
          { targetType: "ALL" },
          ...(userId ? [{ targetType: "USER", targetUserId: userId }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return res.json({ success: true, items: items.map(notificationItem) });
  } catch (err) {
    console.error("system-notifications error:", err);
    return res.status(500).json({ success: false, message: "Không lấy được thông báo" });
  }
});

// Passenger trip history must use the authenticated account's verified phone.
router.get("/rider-notifications", verifyToken, async (req, res) => {
  try {
    const userId = String(req.user?.uid || req.user?.id || "").trim();
    if (!userId) return res.status(401).json({ success: false, message: "Bạn cần đăng nhập." });
    const phoneNumbers = await getVerifiedRiderPhoneVariants(prisma, userId);
    const passengerTrips = phoneNumbers.length
      ? await prisma.trip.findMany({
          where: { riderPhone: { in: phoneNumbers } },
          select: { id: true },
        })
      : [];
    const rows = await prisma.systemNotification.findMany({
      where: {
        isActive: true,
        audience: "RIDER",
        OR: [
          { targetType: "ALL" },
          { targetType: "USER", targetUserId: userId },
          ...(passengerTrips.length ? [{
            targetType: "USER",
            OR: passengerTrips.map(({ id }) => ({ message: { contains: `[tripId:${id}]` } })),
          }] : []),
        ],
      },
      select: { id: true, title: true, message: true, audience: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return res.json({ success: true, items: rows.map(notificationItem) });
  } catch (err) {
    console.error("rider-notifications error:", err);
    return res.status(500).json({ success: false, message: "Không lấy được thông báo" });
  }
});

export default router;
