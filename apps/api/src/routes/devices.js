// Path: goviet247/apps/api/src/routes/devices.js
import { Router } from "express";
import pkg from "@prisma/client";
import { verifyAdminJwtToken, verifyJwtToken } from "../utils/jwt.js";

const { PrismaClient } = pkg;

const prisma = new PrismaClient();
const router = Router();

function getBearerToken(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice(7).trim();
}

async function resolveDeviceOwner(req) {
  const token = getBearerToken(req);

  if (!token) {
    return null;
  }

  try {
    const payload = verifyJwtToken(token);
    const userId = payload?.id || payload?.uid;

    if (!userId) return null;

    return {
      ownerId: userId,
      roleFallback: "user",
      displayName: "User",
    };
  } catch {}

  try {
    const payload = verifyAdminJwtToken(token);
    const adminId = payload?.id;

    if (!adminId || !["ADMIN", "STAFF"].includes(payload?.role)) {
      return null;
    }

    return {
      ownerId: `admin-${adminId}`,
      roleFallback: String(payload.role || "ADMIN").toLowerCase(),
      displayName: payload?.username || "Admin",
    };
  } catch {}

  return null;
}

router.post("/", async (req, res) => {
  try {
    const owner = await resolveDeviceOwner(req);
    const { platform, pushToken, role } = req.body;

    if (!owner?.ownerId) {
      return res.status(401).json({
        success: false,
        error: "UNAUTHORIZED",
        message: "Token không hợp lệ hoặc đã hết hạn.",
      });
    }

    if (!platform || !pushToken || !role) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Thiếu platform / pushToken / role.",
      });
    }

    await prisma.user.upsert({
      where: { id: owner.ownerId },
      update: {
        displayName: owner.displayName,
      },
      create: {
        id: owner.ownerId,
        displayName: owner.displayName,
      },
    });

    const device = await prisma.device.upsert({
      where: { pushToken },
      update: {
        userId: owner.ownerId,
        platform,
        role,
        updatedAt: new Date(),
      },
      create: {
        userId: owner.ownerId,
        platform,
        pushToken,
        role,
      },
    });

    return res.json({
      success: true,
      device,
      message: "Đã lưu token thiết bị.",
    });
  } catch (err) {
    console.error("[Device] save error:", err);

    return res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: "Không thể lưu token thiết bị.",
    });
  }
});

export default router;