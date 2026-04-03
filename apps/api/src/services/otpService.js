// Path: goviet247/apps/api/src/services/otpService.js

import bcrypt from "bcryptjs";
import { prisma } from "../utils/db.js";

// =====================================================
// CẤU HÌNH OTP
// =====================================================

const TTL_SEC = Number(process.env.OTP_CODE_TTL_SEC || 180); // OTP hết hạn sau 3 phút
const RESEND_COOLDOWN_SEC = Number(process.env.OTP_RESEND_COOLDOWN_SEC || 30); // Chờ mới cho gửi lại
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5); // Giới hạn số lần nhập

// =====================================================
// HELPER CHUNG
// =====================================================

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeAppRole(input) {
  const value = String(input || "")
    .trim()
    .toUpperCase();

  if (value === "DRIVER") return "DRIVER";
  return "RIDER";
}

function safeParseJson(input) {
  try {
    return input ? JSON.parse(input) : null;
  } catch {
    return null;
  }
}

/**
 * Đảm bảo user có role tương ứng trong bảng UserRole
 */
async function ensureUserRole(tx, userId, role) {
  const existed = await tx.userRole.findFirst({
    where: {
      userId,
      role,
    },
  });

  if (!existed) {
    await tx.userRole.create({
      data: {
        userId,
        role,
      },
    });
  }
}

/**
 * Rider không cần duyệt, nên có thể auto tạo RiderProfile
 */
async function ensureRiderProfile(tx, userId) {
  const existed = await tx.riderProfile.findUnique({
    where: { userId },
  });

  if (!existed) {
    await tx.riderProfile.create({
      data: {
        userId,
        status: "ACTIVE",
      },
    });
  }
}

// =====================================================
// OTP AUTH CHUNG CHO LOGIN / ĐĂNG KÝ
// =====================================================

/**
 * Tạo phiên OTP cho 1 số điện thoại
 * - Dùng chung cho Rider / Driver
 * - appRole được lưu vào payloadJson để lúc verify biết đang login từ app nào
 */
export async function requestOtp(e164, appRole = "RIDER") {
  const normalizedRole = normalizeAppRole(appRole);

  const code = randomCode();
  const codeHash = await bcrypt.hash(code, 10);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_SEC * 1000);
  const resendAfter = new Date(now.getTime() + RESEND_COOLDOWN_SEC * 1000);

  let phone = await prisma.phone.findUnique({
    where: { e164 },
  });

  if (!phone) {
    phone = await prisma.phone.create({
      data: { e164 },
    });
  }

  const session = await prisma.otpSession.create({
    data: {
      phoneId: phone.id,
      codeHash,
      expiresAt,
      resendAfter,
      purpose: "AUTH",
      payloadJson: JSON.stringify({
        appRole: normalizedRole,
      }),
    },
  });

  console.log(
    "[MOCK SMS AUTH]",
    e164,
    `Mã OTP: ${code} | role=${normalizedRole} | hết hạn sau ${TTL_SEC / 60} phút`
  );

  return {
    sessionId: session.id,
    resendAfter,
  };
}

/**
 * Xác minh OTP đăng nhập / đăng ký
 *
 * Rule:
 * - RIDER:
 *   + ensure User
 *   + ensure UserRole = RIDER
 *   + ensure RiderProfile
 *
 * - DRIVER:
 *   + ensure User
 *   + ensure UserRole = DRIVER
 *   + KHÔNG auto tạo DriverProfile
 *   + DriverProfile sẽ tạo ở bước hoàn thiện hồ sơ tài xế sau OTP
 */
export async function verifyOtp(sessionId, code, fallbackAppRole = "RIDER") {
  const session = await prisma.otpSession.findUnique({
    where: { id: sessionId },
    include: { phone: true },
  });

  if (!session) {
    throw new Error("PHIEN_KHONG_TON_TAI");
  }

  if (session.purpose !== "AUTH") {
    throw new Error("PHIEN_KHONG_DUNG_MUC_DICH");
  }

  if (session.status !== "pending") {
    throw new Error("PHIEN_KHONG_HOP_LE");
  }

  if (session.attemptCount >= MAX_ATTEMPTS) {
    throw new Error("VUOT_QUA_SO_LAN_THU");
  }

  if (new Date() > session.expiresAt) {
    throw new Error("MA_HET_HAN");
  }

  const ok = await bcrypt.compare(code, session.codeHash);

  // Ghi log attempt
  await prisma.otpAttempt.create({
    data: {
      sessionId: session.id,
      phoneId: session.phoneId,
      success: ok,
    },
  });

  if (!ok) {
    await prisma.otpSession.update({
      where: { id: session.id },
      data: {
        attemptCount: {
          increment: 1,
        },
      },
    });

    throw new Error("MA_SAI");
  }

  const sessionPayload = safeParseJson(session.payloadJson);
  const appRole = normalizeAppRole(
    sessionPayload?.appRole || fallbackAppRole || "RIDER"
  );

  const result = await prisma.$transaction(async (tx) => {
    let userId = session.phone.userId;

    // Nếu phone chưa gắn user thì tạo user mới
    if (!userId) {
      const createdUser = await tx.user.create({
        data: {
          primaryRole: appRole,
        },
      });

      userId = createdUser.id;

      await tx.phone.update({
        where: { id: session.phoneId },
        data: {
          userId,
          isVerified: true,
        },
      });
    } else {
      // Nếu đã có user thì mark verified + cập nhật primaryRole theo app đang login
      await tx.phone.update({
        where: { id: session.phoneId },
        data: {
          isVerified: true,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          primaryRole: appRole,
        },
      });
    }

    // Gắn role theo appRole
    await ensureUserRole(tx, userId, appRole);

    // Rider thì auto tạo profile, Driver thì chưa
    if (appRole === "RIDER") {
      await ensureRiderProfile(tx, userId);
    }

    // Khoá session OTP sau khi dùng thành công
    await tx.otpSession.update({
      where: { id: session.id },
      data: {
        status: "verified",
        usedAt: new Date(),
      },
    });

    const user = await tx.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          orderBy: { role: "asc" },
        },
        phones: {
          orderBy: { createdAt: "desc" },
        },
        driverProfile: true,
        riderProfile: true,
      },
    });

    return {
      userId,
      appRole,
      user,
    };
  });

  return result;
}

/* =====================================================
   OTP CHO ĐẶT CHUYẾN (RIDER WEB)
   ===================================================== */

/**
 * Gửi OTP xác nhận chuyến xe
 * - Lưu tripDraft vào payloadJson
 * - Flow này tách biệt với flow login auth
 */
export async function requestTripOtp(e164, tripDraft) {
  const code = randomCode();
  const codeHash = await bcrypt.hash(code, 10);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_SEC * 1000);
  const resendAfter = new Date(now.getTime() + RESEND_COOLDOWN_SEC * 1000);

  let phone = await prisma.phone.findUnique({
    where: { e164 },
  });

  if (!phone) {
    phone = await prisma.phone.create({
      data: { e164 },
    });
  }

  const session = await prisma.otpSession.create({
    data: {
      phoneId: phone.id,
      codeHash,
      expiresAt,
      resendAfter,
      purpose: "TRIP",
      payloadJson: JSON.stringify(tripDraft),
    },
  });

  console.log(
    `[MOCK SMS TRIP] ${e164} - Mã OTP: ${code} (hết hạn ${TTL_SEC / 60} phút)`
  );

  return {
    sessionId: session.id,
    resendAfter,
  };
}

/**
 * Xác minh OTP của chuyến xe
 * - Chỉ verify phiên OTP cho trip
 * - Không tạo user ở đây
 */
export async function verifyTripOtp(sessionId, code) {
  const session = await prisma.otpSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error("PHIEN_KHONG_TON_TAI");
  }

  if (session.purpose !== "TRIP") {
    throw new Error("PHIEN_KHONG_DUNG_MUC_DICH");
  }

  if (session.status !== "pending") {
    throw new Error("PHIEN_KHONG_HOP_LE");
  }

  if (session.attemptCount >= MAX_ATTEMPTS) {
    throw new Error("VUOT_QUA_SO_LAN_THU");
  }

  if (new Date() > session.expiresAt) {
    throw new Error("MA_HET_HAN");
  }

  const ok = await bcrypt.compare(code, session.codeHash);

  await prisma.otpAttempt.create({
    data: {
      sessionId: session.id,
      phoneId: session.phoneId,
      success: ok,
    },
  });

  if (!ok) {
    await prisma.otpSession.update({
      where: { id: session.id },
      data: {
        attemptCount: {
          increment: 1,
        },
      },
    });

    throw new Error("MA_SAI");
  }

  await prisma.otpSession.update({
    where: { id: session.id },
    data: {
      status: "verified",
      usedAt: new Date(),
    },
  });

  const payload = session.payloadJson ? JSON.parse(session.payloadJson) : null;

  return {
    valid: true,
    payload,
  };
}