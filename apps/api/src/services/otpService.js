// Path: goviet247/apps/api/src/services/otpService.js

import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { prisma } from "../utils/db.js";
import { sendSms } from "./smsService.js";

// =====================================================
// CẤU HÌNH OTP
// =====================================================

const TTL_SEC = Number(process.env.OTP_CODE_TTL_SEC || 180); // OTP hết hạn sau 3 phút
const RESEND_COOLDOWN_SEC = Number(process.env.OTP_RESEND_COOLDOWN_SEC || 30); // Chờ mới cho gửi lại
const OTP_FAILURE_LIMIT = 3;
const OTP_LOCK_MS = 30 * 60 * 1000;
const OTP_SEND_LIMIT = 3;
const OTP_SEND_WINDOW_MS = 5 * 60 * 1000;
const OTP_FALLBACK_ON_SMS_FAIL =
  String(process.env.OTP_FALLBACK_ON_SMS_FAIL || "false")
    .trim()
    .toLowerCase() === "true";

const APP_REVIEW_PHONE_E164 =
  process.env.APP_REVIEW_PHONE_E164 || "";

const APP_REVIEW_OTP = process.env.APP_REVIEW_OTP || "";

function isAppReviewPhone(e164) {
  return process.env.APP_REVIEW_LOGIN_ENABLED === "true" && /^\+84\d{9}$/.test(APP_REVIEW_PHONE_E164) && /^\d{6}$/.test(APP_REVIEW_OTP) && String(e164 || "").trim() === APP_REVIEW_PHONE_E164;
}

// =====================================================
// HELPER CHUNG
// =====================================================

function randomCode() {
  return String(randomInt(100000, 1000000));
}

function assertOtpAvailable(phone) {
  if (phone.otpLockedUntil && phone.otpLockedUntil.getTime() > Date.now()) {
    throw Object.assign(new Error(
      "Số điện thoại này bị khóa xác thực OTP trong 30 phút do nhập sai 3 lần liên tiếp. Vui lòng thử lại sau hoặc liên hệ Zalo 0326 184 628 để được hỗ trợ.",
    ), { code: "OTP_PHONE_LOCKED", lockedUntil: phone.otpLockedUntil });
  }
}

export function respondToOtpLock(res, error) {
  if (!["OTP_PHONE_LOCKED", "OTP_SEND_LIMIT", "OTP_RESEND_COOLDOWN"].includes(error?.code)) return false;
  const retryAfter = Math.max(1, Math.ceil((error.lockedUntil.getTime() - Date.now()) / 1000));
  res.set("Retry-After", String(retryAfter)).status(429).json({
    success: false,
    code: error.code,
    message: error.message,
    lockedUntil: error.lockedUntil,
  });
  return true;
}

async function lockOtpPhone(tx, phoneId) {
  await tx.$queryRaw`SELECT "id" FROM "Phone" WHERE "id" = ${phoneId} FOR UPDATE`;
  const phone = await tx.phone.findUniqueOrThrow({ where: { id: phoneId } });
  assertOtpAvailable(phone);
  return phone;
}

export async function assertOtpSendAvailable(tx, phoneId) {
  const now = Date.now();
  const recentSince = new Date(now - OTP_LOCK_MS - OTP_SEND_WINDOW_MS);
  const lastVerified = await tx.otpSession.findFirst({
    where: { phoneId, usedAt: { gte: recentSince } },
    orderBy: { usedAt: "desc" },
    select: { usedAt: true },
  });
  const recentRequests = await tx.otpSession.findMany({
    where: { phoneId, createdAt: { gt: lastVerified?.usedAt || recentSince } },
    orderBy: { createdAt: "desc" },
    take: OTP_SEND_LIMIT,
    select: { createdAt: true },
  });
  const latest = await tx.otpSession.findFirst({
    where: { phoneId, status: "pending", expiresAt: { gt: new Date(now) } },
    orderBy: { createdAt: "desc" }, select: { resendAfter: true },
  });
  if (latest?.resendAfter && latest.resendAfter.getTime() > now) throw Object.assign(
    new Error("Vui lòng chờ trước khi yêu cầu gửi lại mã OTP."),
    {code:"OTP_RESEND_COOLDOWN", lockedUntil:latest.resendAfter});
  if (recentRequests.length < OTP_SEND_LIMIT) return;

  const newest = recentRequests[0].createdAt.getTime();
  const oldest = recentRequests[OTP_SEND_LIMIT - 1].createdAt.getTime();
  const lockedUntil = new Date(newest + OTP_LOCK_MS);
  if (newest - oldest > OTP_SEND_WINDOW_MS || lockedUntil.getTime() <= now) return;

  throw Object.assign(new Error(
    "Số điện thoại này đã yêu cầu OTP quá nhiều lần. Vui lòng thử lại sau hoặc liên hệ Zalo 0326 184 628 để được hỗ trợ.",
  ), { code: "OTP_SEND_LIMIT", lockedUntil });
}

async function createOtpSession(e164, data) {
  return prisma.$transaction(async (tx) => {
    const phone = await tx.phone.upsert({ where: { e164 }, create: { e164 }, update: {} });
    await lockOtpPhone(tx, phone.id);
    await assertOtpSendAvailable(tx, phone.id);
    return tx.otpSession.create({ data: { ...data, phoneId: phone.id } });
  });
}

async function verifyOtpAttempt(sessionId, code, purpose, onVerified) {
  const initialSession = await prisma.otpSession.findUnique({ where: { id: sessionId } });
  if (!initialSession) throw new Error("PHIEN_KHONG_TON_TAI");

  const result = await prisma.$transaction(async (tx) => {
    const phone = await lockOtpPhone(tx, initialSession.phoneId);
    const session = await tx.otpSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new Error("PHIEN_KHONG_TON_TAI");
    if (session.purpose !== purpose) throw new Error("PHIEN_KHONG_DUNG_MUC_DICH");
    if (session.status !== "pending") throw new Error("PHIEN_KHONG_HOP_LE");
    if (new Date() > session.expiresAt) throw new Error("MA_HET_HAN");

    const success = await bcrypt.compare(code, session.codeHash);
    await tx.otpAttempt.create({ data: { sessionId, phoneId: phone.id, success } });
    if (!success) {
      const streak = (phone.otpLockedUntil ? 0 : phone.otpFailureStreak) + 1;
      const lockedUntil = streak >= OTP_FAILURE_LIMIT ? new Date(Date.now() + OTP_LOCK_MS) : null;
      await tx.phone.update({
        where: { id: phone.id },
        data: { otpFailureStreak: streak, otpLockedUntil: lockedUntil },
      });
      await tx.otpSession.update({
        where: { id: sessionId },
        data: { attemptCount: { increment: 1 } },
      });
      return { success: false, lockedUntil };
    }

    await tx.phone.update({
      where: { id: phone.id },
      data: { otpFailureStreak: 0, otpLockedUntil: null },
    });
    await tx.otpSession.update({
      where: { id: sessionId },
      data: { status: "verified", usedAt: new Date() },
    });
    return { success: true, value: await onVerified(tx, session, phone) };
  });

  // Throw after the transaction commits so the failed attempt and lock are retained.
  if (!result.success) {
    assertOtpAvailable({ otpLockedUntil: result.lockedUntil });
    throw new Error("MA_SAI");
  }
  return result.value;
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

function shouldFallbackOtpSms(smsResult) {
  if (!OTP_FALLBACK_ON_SMS_FAIL) return false;
  if (!smsResult || smsResult.ok) return false;

  const provider = String(smsResult?.provider || "")
    .trim()
    .toLowerCase();
  const errorText = `${smsResult?.errorCode || ""} ${smsResult?.error || ""}`
    .trim()
    .toUpperCase();

  if (provider !== "aws") {
    return false;
  }

  return (
    errorText.includes("QUOTA") ||
    errorText.includes("MONTHLY_SPEND_LIMIT") ||
    errorText.includes("SERVICE QUOTA EXCEEDED") ||
    errorText.includes("THROTTL") ||
    errorText.includes("LIMIT")
  );
}

function logOtpFallback({ to, code, purpose }) {
  const maskedPhone = String(to || "").trim();
  const safePurpose = String(purpose || "AUTH")
    .trim()
    .toUpperCase();

  console.warn(
    `[OTP][FALLBACK] purpose=${safePurpose} to=${maskedPhone} code=${code} reason=SMS_PROVIDER_FAILED`,
  );
}

async function sendOtpSmsOrThrow({ to, text, otpCode, purpose, rollback }) {
  const smsResult = await sendSms({ to, text });

  if (smsResult?.ok) {
    return smsResult;
  }

  if (shouldFallbackOtpSms(smsResult)) {
    logOtpFallback({
      to,
      code: otpCode,
      purpose,
    });

    return {
      ok: true,
      provider: "fallback_console",
      fallbackUsed: true,
    };
  }

  if (typeof rollback === "function") {
    try {
      await rollback();
    } catch (rollbackError) {
      console.error("OTP SMS rollback error:", rollbackError);
    }
  }

  throw new Error("GUI_OTP_THAT_BAI");
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

  const isAppReviewLogin = isAppReviewPhone(e164);
  const code = isAppReviewLogin ? APP_REVIEW_OTP : randomCode();

  const codeHash = await bcrypt.hash(code, 10);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_SEC * 1000);
  const resendAfter = new Date(now.getTime() + RESEND_COOLDOWN_SEC * 1000);

  const session = await createOtpSession(e164, {
    codeHash,
    expiresAt,
    resendAfter,
    purpose: "AUTH",
    payloadJson: JSON.stringify({ appRole: normalizedRole }),
  });

  if (!isAppReviewLogin) {
    await sendOtpSmsOrThrow({
      to: e164,
      text: `[GoViet247] Ma OTP cua ban la ${code}. Hieu luc ${TTL_SEC} giay.`,
      otpCode: code,
      purpose: "AUTH",
      rollback: async () => {
        await prisma.otpSession.delete({
          where: { id: session.id },
        });
      },
    });
  }

  return {
    sessionId: session.id,
    resendAfter,
    otp: code,
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
  return verifyOtpAttempt(sessionId, code, "AUTH", async (tx, session, phone) => {
    const sessionPayload = safeParseJson(session.payloadJson);
    const appRole = normalizeAppRole(sessionPayload?.appRole || fallbackAppRole || "RIDER");
    let userId = phone.userId;

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

  const session = await createOtpSession(e164, {
    codeHash,
    expiresAt,
    resendAfter,
    purpose: "TRIP",
    payloadJson: JSON.stringify(tripDraft),
  });

  await sendOtpSmsOrThrow({
    to: e164,
    text: `[GoViet247] Ma OTP dat xe: ${code}. Hieu luc ${TTL_SEC} giay.`,
    otpCode: code,
    purpose: "TRIP",
    rollback: async () => {
      await prisma.otpSession.delete({
        where: { id: session.id },
      });
    },
  });

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
  return verifyOtpAttempt(sessionId, code, "TRIP", async (_tx, session) => ({
    valid: true,
    payload: session.payloadJson ? JSON.parse(session.payloadJson) : null,
  }));
}
