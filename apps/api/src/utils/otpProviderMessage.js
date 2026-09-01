const DEFAULT_SUPPORT_ZALO = "0326184628";

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

  return {
    code: "OTP_PROVIDER_UNAVAILABLE",
    message:
      "Hệ thống SMS xác thực của GoViet247 đang tạm thời gián đoạn. " +
      `Vui lòng thử lại sau ít phút hoặc liên hệ Zalo ${supportZalo} để được hỗ trợ.`,
    supportZalo: String(
      process.env.OTP_SUPPORT_ZALO || DEFAULT_SUPPORT_ZALO,
    ).replace(/\D/g, ""),
  };
}
