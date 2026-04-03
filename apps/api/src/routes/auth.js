import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/db.js";
import {
  requestOtpHandler,
  verifyOtpHandler,
  getMe,
} from "../controllers/authController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

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
        String(item?.role || "").trim().toUpperCase()
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
router.post("/request-otp", requestOtpHandler);

// =====================================================
// 2) XÁC MINH OTP -> TRẢ ACCESS TOKEN
// =====================================================
router.post("/verify-otp", verifyOtpHandler);

// =====================================================
// 3) LẤY THÔNG TIN USER TỪ TOKEN
// =====================================================
router.get("/me", verifyToken, getMe);

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

export default router;