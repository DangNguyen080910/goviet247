import { accountExitRole, recordAccountExit } from "../services/accountExitRequest.js";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/db.js";
import {
  requestOtpHandler,
  verifyOtpHandler,
  getMe,
} from "../controllers/authController.js";
import { userSessions, pushSessionKey } from "../services/userSessions.js";
import { verifyToken } from "../middleware/authMiddleware.js";

import { otpIpRateLimit } from "../middleware/otpIpRateLimit.js";

export const router = Router();

function resolvePhone(user) {
  return user?.phones?.[0]?.e164 || null;
}

function resolveRiderName(user) {
  return (
    user?.riderProfile?.fullName ||
    user?.displayName ||
    resolvePhone(user) ||
    null
  );
}

function resolveDriverName(user) {
  return (
    user?.driverProfile?.fullName ||
    user?.displayName ||
    resolvePhone(user) ||
    null
  );
}

function getUserRoleForResponse(user) {
  const roleList = Array.isArray(user?.roles)
    ? user.roles.map((item) =>
        String(item?.role || "")
          .trim()
          .toUpperCase(),
      )
    : [];

  if (roleList.includes("DRIVER")) return "DRIVER";
  if (roleList.includes("RIDER")) return "RIDER";

  const primaryRole = String(user?.primaryRole || "")
    .trim()
    .toUpperCase();

  if (primaryRole === "DRIVER") return "DRIVER";
  return "RIDER";
}

// =====================================================
// 1) YÊU CẦU OTP
// =====================================================
router.post(
  "/request-otp",
  otpIpRateLimit,
  requestOtpHandler,
);

// =====================================================
// 2) XÁC MINH OTP -> TRẢ ACCESS TOKEN
// =====================================================
router.post("/verify-otp", verifyOtpHandler);

// =====================================================
// 3) LẤY THÔNG TIN USER TỪ TOKEN
// =====================================================
router.get("/me", verifyToken, getMe);
router.post("/logout", verifyToken, async (req, res) => {
  try {
    await userSessions.revoke(req.authToken, req.user);
    req.app.get("io")?.in(`session:${pushSessionKey(req.authToken, req.user)}`).disconnectSockets(true);
    await prisma.device.deleteMany({ where: { userId: req.user.uid || req.user.id, pushSessionId: pushSessionKey(req.authToken, req.user) } });
    return res.json({ success: true });
  } catch {
    return res.status(503).json({ success: false, message: "Chưa thể đăng xuất. Vui lòng thử lại." });
  }
});

// =====================================================
// 4) CẬP NHẬT HỒ SƠ USER ĐANG ĐĂNG NHẬP
//    Phase chuyển tiếp:
//    - Rider update RiderProfile.fullName
//    - sync thêm User.displayName để compatibility
// =====================================================
router.patch("/me", verifyToken, async (req, res) => {
  try {
    const uid = req.user?.uid || req.user?.id;

    if (!uid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const body = z
      .object({
        displayName: z
          .string()
          .trim()
          .min(2, "Tên phải có ít nhất 2 ký tự.")
          .max(100, "Tên không được vượt quá 100 ký tự."),
      })
      .parse(req.body || {});

    const updated = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: uid },
        data: {
          displayName: body.displayName,
        },
      });

      const riderProfile = await tx.riderProfile.findUnique({
        where: { userId: uid },
      });

      if (riderProfile) {
        await tx.riderProfile.update({
          where: { userId: uid },
          data: {
            fullName: body.displayName,
          },
        });
      }

      return tx.user.findUnique({
        where: { id: uid },
        include: {
          phones: {
            orderBy: { createdAt: "desc" },
          },
          roles: {
            orderBy: { role: "asc" },
          },
          riderProfile: true,
          driverProfile: true,
        },
      });
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "User không tồn tại.",
      });
    }

    const phone = resolvePhone(updated);
    const riderName = resolveRiderName(updated);
    const driverName = resolveDriverName(updated);
    const role = getUserRoleForResponse(updated);

    return res.json({
      success: true,
      message: "Cập nhật hồ sơ thành công.",
      user: {
        id: updated.id,
        displayName: riderName || driverName || updated.displayName || phone,
        riderName,
        driverName,
        phone,
        role,
        primaryRole: updated.primaryRole,
        hasDriverProfile: !!updated.driverProfile,
        hasRiderProfile: !!updated.riderProfile,
        createdAt: updated.createdAt,
      },
    });
  } catch (e) {
    if (e?.name === "ZodError") {
      return res.status(400).json({
        success: false,
        message: e.issues?.[0]?.message || "Dữ liệu không hợp lệ.",
      });
    }

    console.error("PATCH /api/auth/me error:", e);
    return res.status(500).json({
      success: false,
      message: "Internal error",
    });
  }
});

// =====================================================
// 5) XÓA TÀI KHOẢN USER ĐANG ĐĂNG NHẬP
// Apple requirement: account deletion support
// =====================================================
router.delete("/me", verifyToken, async (req, res) => {
  try {
    const uid = req.user?.uid || req.user?.id;

    if (!uid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: uid },
      include: {
        phones: true,
      },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User không tồn tại.",
      });
    }

    const appRole = accountExitRole(req.user);
    if (!appRole) return res.status(400).json({ success: false, message: "Không xác định được ứng dụng. Vui lòng đăng nhập lại." });

    await prisma.$transaction(async (tx) => {
      await recordAccountExit(tx, uid, appRole);

      await tx.session.updateMany({ where: { userId: uid }, data: { expiresAt: new Date(0) } });

      await tx.device.deleteMany({
        where: {
          userId: uid,
        },
      });
    });

    return res.json({
      success: true,
      message: "Tài khoản đã được xóa.",
    });
  } catch (error) {
    console.error("DELETE /api/auth/me error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal error",
    });
  }
});

export default router;
