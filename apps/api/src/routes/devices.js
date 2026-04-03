// Path: goviet247/apps/api/src/routes/devices.js
// Comment: Nhận token push từ app mobile (Expo Push Token)

import { Router } from "express";
import pkg from "@prisma/client";
import { verifyToken } from "../middleware/authMiddleware.js";

const { PrismaClient } = pkg;

const prisma = new PrismaClient();
const router = Router();

/**
 * POST /api/devices
 * Lưu token push của thiết bị
 *
 * Auth: required
 * Body:
 * {
 *   platform: "ios" | "android" | "web",
 *   pushToken: string,
 *   role: "driver" | "rider"
 * }
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.uid;

    const { platform, pushToken, role } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "User not authenticated.",
      });
    }

    if (!platform || !pushToken || !role) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Thiếu platform / pushToken / role.",
      });
    }

    // đảm bảo user tồn tại
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        displayName: role === "driver" ? "Driver" : "Rider",
      },
    });

    const device = await prisma.device.upsert({
      where: { pushToken },
      update: {
        userId,
        platform,
        role,
        updatedAt: new Date(),
      },
      create: {
        userId,
        platform,
        pushToken,
        role,
      },
    });

    res.json({
      success: true,
      device,
      message: "Đã lưu token thiết bị.",
    });
  } catch (err) {
    console.error("[Device] save error:", err);

    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Không thể lưu token thiết bị.",
    });
  }
});

export default router;