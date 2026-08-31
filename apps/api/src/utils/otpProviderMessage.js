const DEFAULT_SUPPORT_ZALO = "0326184628";
const DEFAULT_RECOVERY_AT = "2026-09-01T00:30:00.000Z";
const DEFAULT_RECOVERY_LABEL = "07:30 ngày 01/09/2026";

function formatSupportPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  return String(value || "").trim();
}

export function getOtpProviderUnavailablePayload() {
  const configuredMessage = String(
    process.env.OTP_PROVIDER_UNAVAILABLE_MESSAGE || "",
  ).trim();

  if (configuredMessage) {
    return {
      code: "OTP_PROVIDER_UNAVAILABLE",
      message: configuredMessage,
    };
  }

  const supportZalo = formatSupportPhone(
    process.env.OTP_SUPPORT_ZALO || DEFAULT_SUPPORT_ZALO,
  );
  const recoveryAtRaw = String(
    process.env.OTP_PROVIDER_RECOVERY_AT || DEFAULT_RECOVERY_AT,
  ).trim();
  const recoveryAtMs = Date.parse(recoveryAtRaw);
  const recoveryLabel = String(
    process.env.OTP_PROVIDER_RECOVERY_LABEL || DEFAULT_RECOVERY_LABEL,
  ).trim();
  const shouldShowRecoveryTime =
    Number.isFinite(recoveryAtMs) && Date.now() < recoveryAtMs;

  const recoveryText = shouldShowRecoveryTime
    ? ` Dự kiến hoạt động lại sau ${recoveryLabel}.`
    : "";

  return {
    code: "OTP_PROVIDER_UNAVAILABLE",
    message:
      `Hệ thống SMS xác thực của GoViet247 đang tạm thời gián đoạn từ phía nhà cung cấp.${recoveryText} ` +
      `Quý khách vui lòng thử lại sau hoặc liên hệ Zalo ${supportZalo} để được hỗ trợ đặt chuyến.`,
    ...(shouldShowRecoveryTime && {
      retryAfter: new Date(recoveryAtMs).toISOString(),
    }),
    supportZalo: String(
      process.env.OTP_SUPPORT_ZALO || DEFAULT_SUPPORT_ZALO,
    ).replace(/\D/g, ""),
  };
}
