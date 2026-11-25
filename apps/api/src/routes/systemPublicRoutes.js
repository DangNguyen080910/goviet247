import { notificationFeed, riderNotificationScope, createNotificationPreferenceHandler } from "../services/notificationPreferences.js";
// Path: goviet247/apps/api/src/routes/systemPublicRoutes.js
import { Router } from "express";
import pkg from "@prisma/client";
import { verifyToken } from "../middleware/authMiddleware.js";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();
const router = Router();

function notificationItem(item) {
  const rawMessage = String(item.message || "");
  const tripId = rawMessage.match(/\[tripId:([^\]]+)\]/)?.[1] || null;
  const message = rawMessage.replace(/\s*\[tripId:[^\]]+\]\s*/g, "").trim();
  const { reads, ...safe } = item;
  return { ...safe, body: message, message, tripId };
}

// Compatibility for rider versions already installed, and public announcements.
router.get("/system-notifications", (req, res, next) => {
  // Anonymous compatibility clients can read public announcements only.
  if (req.headers.authorization) return verifyToken(req, res, next);
  next();
}, async (req, res) => {
  res.set?.("Cache-Control", "no-store");
  try {
    const requestedAudience = String(req.query.audience || "RIDER").trim().toUpperCase();
    const audience = ["RIDER", "DRIVER"].includes(requestedAudience) ? requestedAudience : "RIDER";
    const userId = String(req.user?.uid || req.user?.id || "").trim();
    const items = await notificationFeed(prisma, {
      isActive: true, audience,
      OR: [{ targetType: "ALL" }, ...(userId ? [{ targetType: "USER", targetUserId: userId }] : [])],
    }, userId);
    return res.json({ success: true, items: items.map(notificationItem) });
  } catch (err) {
    console.error("system-notifications error:", err);
    return res.status(500).json({ success: false, message: "Không lấy được thông báo" });
  }
});

// Passenger trip history must use the authenticated account's verified phone.
router.get("/rider-notifications", verifyToken, async (req, res) => {
  res.set?.("Cache-Control", "no-store");
  try {
    const userId = String(req.user?.uid || req.user?.id || "").trim();
    if (!userId) return res.status(401).json({ success: false, message: "Bạn cần đăng nhập." });
    const rows = await notificationFeed(prisma, await riderNotificationScope(prisma, userId), userId);
    return res.json({ success: true, items: rows.map(item => notificationItem({
      id: item.id, title: item.title, message: item.message, audience: item.audience,
      createdAt: item.createdAt, updatedAt: item.updatedAt,
      isPinned: item.isPinned, isPinnedByDefault: item.isPinnedByDefault, isCollapsed: item.isCollapsed,
    })) });
  } catch (err) {
    console.error("rider-notifications error:", err);
    return res.status(500).json({ success: false, message: "Không lấy được thông báo" });
  }
});

router.patch("/system-notifications/:id/preferences", verifyToken, createNotificationPreferenceHandler(prisma));

export default router;
