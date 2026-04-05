// Path: goviet247/apps/api/src/controllers/authController.js
import { prisma } from "../utils/db.js";
import { requestOtp, verifyOtp } from "../services/otpService.js";
import { signToken } from "../utils/jwt.js";

function normalizeAppRole(input) {
  const value = String(input || "")
    .trim()
    .toUpperCase();

  if (value === "DRIVER") return "DRIVER";
  return "RIDER";
}

function normalizeVietnamesePhoneToE164(input) {
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

function buildAuthUserPayload(user, appRole) {
  const normalizedRole = normalizeAppRole(appRole);
  const phone = resolvePhone(user);
  const riderName = resolveRiderName(user);
  const driverName = resolveDriverName(user);

  return {
    id: user.id,
    displayName:
      normalizedRole === "DRIVER"
        ? driverName || riderName || phone
        : riderName || driverName || phone,
    riderName,
    driverName,
    phone,
    role: normalizedRole,
    primaryRole: user.primaryRole,
    hasDriverProfile: Boolean(user.driverProfile),
    hasRiderProfile: Boolean(user.riderProfile),

    // 👇 thêm dòng này
    createdAt: user.createdAt,
  };
}

// POST /api/auth/request-otp
export async function requestOtpHandler(req, res) {
  try {
    const rawPhone = String(req.body?.phone || "").trim();
    const phone = normalizeVietnamesePhoneToE164(rawPhone);
    const appRole = normalizeAppRole(req.body?.appRole || req.body?.role);

    if (!rawPhone) {
      return res.status(400).json({
        success: false,
        message: "Thiếu số điện thoại.",
      });
    }

    if (!/^\+84\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message:
          "Số điện thoại không hợp lệ. Vui lòng nhập số Việt Nam hợp lệ.",
      });
    }

    const result = await requestOtp(phone, appRole);

    return res.json({
      success: true,
      session_id: result.sessionId,
      resend_after: result.resendAfter,
    });
  } catch (error) {
    const message = String(error?.message || "").trim();

    if (message === "GUI_OTP_THAT_BAI") {
      return res.status(500).json({
        success: false,
        message: "Không gửi được mã OTP. Vui lòng thử lại sau ít phút.",
      });
    }

    console.error("POST /api/auth/request-otp error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal error",
    });
  }
}

// POST /api/auth/verify-otp
export async function verifyOtpHandler(req, res) {
  try {
    const sessionId = String(
      req.body?.session_id || req.body?.sessionId || "",
    ).trim();
    const otp = String(req.body?.otp || "").trim();
    const appRole = normalizeAppRole(req.body?.appRole || req.body?.role);

    if (!sessionId || !otp) {
      return res.status(400).json({
        success: false,
        message: "Thiếu session_id hoặc otp.",
      });
    }

    const result = await verifyOtp(sessionId, otp, appRole);
    const user = result.user;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng.",
      });
    }

    const token = signToken({
      uid: user.id,
      id: user.id,
      role: result.appRole,
      appRole: result.appRole,
      phone: resolvePhone(user),
    });

    return res.json({
      success: true,
      access_token: token,
      user: buildAuthUserPayload(user, result.appRole),
    });
  } catch (error) {
    const message = String(error?.message || "").trim();

    if (
      message === "PHIEN_KHONG_TON_TAI" ||
      message === "PHIEN_KHONG_HOP_LE" ||
      message === "PHIEN_KHONG_DUNG_MUC_DICH"
    ) {
      return res.status(400).json({
        success: false,
        message: "Phiên OTP không hợp lệ.",
      });
    }

    if (message === "MA_HET_HAN") {
      return res.status(400).json({
        success: false,
        message: "Mã OTP đã hết hạn.",
      });
    }

    if (message === "MA_SAI") {
      return res.status(400).json({
        success: false,
        message: "Mã OTP không đúng.",
      });
    }

    if (message === "VUOT_QUA_SO_LAN_THU") {
      return res.status(400).json({
        success: false,
        message: "Bạn đã nhập sai quá số lần cho phép.",
      });
    }

    console.error("POST /api/auth/verify-otp error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal error",
    });
  }
}

// GET /api/auth/me
export async function getMe(req, res) {
  try {
    const uid = req.user?.uid || req.user?.id;

    if (!uid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await prisma.user.findUnique({
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

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User không tồn tại.",
      });
    }

    const appRole = normalizeAppRole(
      req.user?.appRole ||
        user?.primaryRole ||
        user?.roles?.find((item) => item?.role === "DRIVER")?.role ||
        "RIDER",
    );

    return res.json({
      success: true,
      user: buildAuthUserPayload(user, appRole),
    });
  } catch (error) {
    console.error("GET /api/auth/me error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal error",
    });
  }
}
