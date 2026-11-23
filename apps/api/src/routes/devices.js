// Path: goviet247/apps/api/src/routes/devices.js
import { recordRiderAppUsage, normalizeRiderPlatform } from "../services/riderAppUsage.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { Router } from "express";
import pkg from "@prisma/client";
import { userSessions, pushSessionKey } from "../services/userSessions.js";
import { verifyAdminSession as verifyAdminJwtToken } from '../services/adminSessions.js';
import {wakeUnsentAdminTripPush} from '../services/adminPushRecovery.js';

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
    const payload = await userSessions.verify(token);
    const userId = payload?.id || payload?.uid;

    if (!userId) return null;

    return {
      ownerId: userId,
      roleFallback: "user",
      claims: payload,
      pushSessionId: pushSessionKey(token, payload),
      pushExpiresAt: payload.exp ? new Date(payload.exp * 1000) : null,
      displayName: "User",
    };
  } catch (error) { if (error.status !== 401) throw error; }

  try {
    const payload = await verifyAdminJwtToken(token);
    const adminId = payload?.id;

    if (!adminId || !["ADMIN", "STAFF"].includes(payload?.role)) {
      return null;
    }

    return {
      ownerId: `admin-${adminId}`,
      adminAuthVersion: payload.av,
      pushExpiresAt: payload.exp ? new Date(payload.exp * 1000) : null,
      roleFallback: String(payload.role || "ADMIN").toLowerCase(),
      displayName: payload?.username || "Admin",
    };
  } catch {}

  return null;
}

router.post("/rider-app", verifyToken, async (req, res) => {
  try {
    const platform = normalizeRiderPlatform(req.body?.platform);
    if (!platform) return res.status(400).json({ success: false, message: "Nền tảng không hợp lệ." });
    if (req.user?.appRole && req.user.appRole !== "RIDER") return res.status(403).json({ success: false });
    await recordRiderAppUsage(prisma, req.user.id || req.user.uid, platform);
    return res.json({ success: true });
  } catch (error) {
    console.error("[Device] rider app usage error:", error);
    return res.status(500).json({ success: false });
  }
});

router.post("/", async (req, res) => {
  try {
    const owner = await resolveDeviceOwner(req);
    const { platform, pushToken } = req.body || {};
    const requestedRole = String(req.body?.role || "").toUpperCase();
    let role;

    if (!owner?.ownerId) {
      return res.status(401).json({
        success: false,
        error: "UNAUTHORIZED",
        message: "Token không hợp lệ hoặc đã hết hạn.",
      });
    }

    if (!platform || !pushToken || !requestedRole) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Thiếu platform / pushToken / role.",
      });
    }

    if (!owner.claims) {
      if (!["ADMIN","STAFF"].includes(requestedRole)) return res.status(403).json({success:false,message:"Vai trò thiết bị không hợp lệ."});
      role = owner.roleFallback;
    } else {
      if (!["RIDER","DRIVER"].includes(requestedRole) || (owner.claims.appRole && owner.claims.appRole !== requestedRole)) return res.status(403).json({success:false,message:"Vai trò thiết bị không hợp lệ."});
      role = requestedRole.toLowerCase();
    }
    if (String(role).toUpperCase() === "DRIVER") {
      if (!owner.claims || (owner.claims.appRole && owner.claims.appRole !== "DRIVER")) return res.status(403).json({ success: false, message: "Tài khoản không thuộc ứng dụng tài xế." });
      const user = await prisma.user.findUnique({ where: { id: owner.ownerId }, include: { roles: true } });
      if (!user || !(user.primaryRole === "DRIVER" || user.roles.some(r => r.role === "DRIVER"))) return res.status(403).json({ success: false, message: "Tài khoản không phải tài xế." });
    }

    await prisma.user.upsert({
      where: { id: owner.ownerId },
      update: {},
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
        adminAuthVersion: owner.adminAuthVersion || null,
        pushSessionId: owner.pushSessionId || null,
        pushExpiresAt: owner.pushExpiresAt || null,
        updatedAt: new Date(),
      },
      create: {
        userId: owner.ownerId,
        platform,
        pushToken,
        role,
        adminAuthVersion: owner.adminAuthVersion || null,
        pushSessionId: owner.pushSessionId || null,
        pushExpiresAt: owner.pushExpiresAt || null,
      },
    });

    if (!owner.claims && owner.adminAuthVersion && owner.pushExpiresAt) {
      try {await wakeUnsentAdminTripPush(prisma);}
      catch(error){console.error('[AdminPush] wake pending alerts failed',error.code || error.name);}
    }

    if (String(role).toUpperCase() === "RIDER" && !owner.ownerId.startsWith("admin-")) {
      await recordRiderAppUsage(prisma, owner.ownerId, platform);
    }

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
