import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/db.js";
import {
  requestOtpHandler,
  verifyOtpHandler,
  getMe,
} from "../controllers/authController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const OTP_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 phút
const OTP_RATE_LIMIT_MAX_BY_IP = 10;

const otpRequestByIp = new Map();

const OTP_RATE_LIMIT_MAX_BY_PHONE = 3;
const otpRequestByPhone = new Map();

function normalizeVietnamesePhoneToE164ForRateLimit(input) {
  const raw = String(input || "").trim();

  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");

  if (/^0\d{9}$/.test(digits)) {
    return `+84${digits.slice(1)}`;
  }

  if (/^84\d{9}$/.test(digits)) {
    return `+${digits}`;
  }

  if (/^\+84\d{9}$/.test(raw)) {
    return raw;
  }

  return raw;
}

function otpPhoneRateLimit(req, res, next) {
  const now = Date.now();
  cleanupExpiredRateLimitEntries(otpRequestByPhone, now);

  const rawPhone = String(req.body?.phone || "").trim();
  const phone = normalizeVietnamesePhoneToE164ForRateLimit(rawPhone);

  if (!phone || !/^\+84\d{9}$/.test(phone)) {
    return next();
  }

  const current = otpRequestByPhone.get(phone);

  if (!current || current.expiresAt <= now) {
    otpRequestByPhone.set(phone, {
      count: 1,
      expiresAt: now + OTP_RATE_LIMIT_WINDOW_MS,
    });
    return next();
  }

  if (current.count >= OTP_RATE_LIMIT_MAX_BY_PHONE) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((current.expiresAt - now) / 1000),
    );

    return res.status(429).json({
      success: false,
      message:
        "Số điện thoại này đã yêu cầu OTP quá nhiều lần. Vui lòng thử lại sau ít phút.",
      retry_after: retryAfterSeconds,
    });
  }

  current.count += 1;
  otpRequestByPhone.set(phone, current);
  return next();
}

function cleanupExpiredRateLimitEntries(store, now) {
  for (const [key, value] of store.entries()) {
    if (!value || value.expiresAt <= now) {
      store.delete(key);
    }
  }
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0] || "").trim();
  }

  return (
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function otpIpRateLimit(req, res, next) {
  const now = Date.now();
  cleanupExpiredRateLimitEntries(otpRequestByIp, now);

  const ip = getClientIp(req);
  const current = otpRequestByIp.get(ip);

  if (!current || current.expiresAt <= now) {
    otpRequestByIp.set(ip, {
      count: 1,
      expiresAt: now + OTP_RATE_LIMIT_WINDOW_MS,
    });
    return next();
  }

  if (current.count >= OTP_RATE_LIMIT_MAX_BY_IP) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((current.expiresAt - now) / 1000),
    );

    return res.status(429).json({
      success: false,
      message:
        "Bạn đã yêu cầu OTP quá nhiều lần. Vui lòng thử lại sau ít phút.",
      retry_after: retryAfterSeconds,
    });
  }

  current.count += 1;
  otpRequestByIp.set(ip, current);
  return next();
}

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
router.post("/request-otp", otpIpRateLimit, otpPhoneRateLimit, requestOtpHandler);

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
