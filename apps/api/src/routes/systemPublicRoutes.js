// Path: goviet247/apps/api/src/routes/systemPublicRoutes.js
import { Router } from "express";
import pkg from "@prisma/client";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const router = Router();

// PUBLIC - driver & rider dùng chung
router.get("/system-notifications", async (req, res) => {
  try {
    const audience = String(req.query.audience || "")
      .trim()
      .toUpperCase();

    const userId = String(req.query.userId || "").trim();

    const where = {
      isActive: true,
      ...(audience ? { audience } : {}),
      OR: [
        { targetType: "ALL" },
        ...(userId
          ? [
              {
                targetType: "USER",
                targetUserId: userId,
              },
            ]
          : []),
      ],
    };

    const rows = await prisma.systemNotification.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    const items = rows.map((item) => {
      const rawMessage = String(item.message || "");
      const tripIdMatch = rawMessage.match(/\[tripId:([^\]]+)\]/);
      const tripId = tripIdMatch?.[1] || null;
      const cleanMessage = rawMessage
        .replace(/\s*\[tripId:[^\]]+\]\s*/g, "")
        .trim();

      return {
        ...item,
        body: cleanMessage,
        message: cleanMessage,
        tripId,
      };
    });

    return res.json({
      success: true,
      items,
    });
  } catch (err) {
    console.error("system-notifications error:", err);
    return res.status(500).json({
      success: false,
      message: "Không lấy được thông báo",
    });
  }
});

export default router;
