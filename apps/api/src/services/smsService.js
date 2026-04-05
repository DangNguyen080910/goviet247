// Path: goviet247/apps/api/src/services/smsService.js
import {
  PinpointSMSVoiceV2Client,
  SendTextMessageCommand,
} from "@aws-sdk/client-pinpoint-sms-voice-v2";

const REGION = process.env.AWS_REGION || "ap-southeast-1";

const SMS_PROVIDER = String(process.env.SMS_PROVIDER || "mock")
  .trim()
  .toLowerCase();

const SENDER_ID = process.env.AWS_SMS_DEFAULT_SENDER_ID || "GoViet247";
const MESSAGE_TYPE =
  process.env.AWS_SMS_DEFAULT_MESSAGE_TYPE || "TRANSACTIONAL";

const SMS_RETRY_DELAY_MS = 2000;
const SMS_MAX_ATTEMPTS = 2;

const APP_ENV = String(process.env.APP_ENV || process.env.NODE_ENV || "")
  .trim()
  .toLowerCase();

const IS_PRODUCTION = APP_ENV === "production";

function logSmsInfo(message) {
  if (!IS_PRODUCTION) {
    console.log(message);
  }
}

function logSmsWarn(message) {
  if (!IS_PRODUCTION) {
    console.warn(message);
  }
}

function logSmsError(message) {
  console.error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maskPhone(phone) {
  const value = String(phone || "").trim();
  if (!value) return "unknown";
  if (value.length <= 6) return value;
  return `${value.slice(0, 4)}***${value.slice(-3)}`;
}

function sanitizeSmsTextForLog(text) {
  const value = String(text || "").trim();
  if (!value) return "";

  const otpMasked = value.replace(/\b\d{4,8}\b/g, "[REDACTED_OTP]");

  if (SMS_PROVIDER === "mock") {
    return otpMasked;
  }

  return otpMasked;
}

async function sendAwsSmsOnce({ to, text }) {
  const command = new SendTextMessageCommand({
    DestinationPhoneNumber: to,
    MessageBody: text,
    MessageType: MESSAGE_TYPE,
    OriginationIdentity: SENDER_ID,
  });

  const response = await awsClient.send(command);

  return {
    ok: true,
    provider: "aws",
    messageId: response?.MessageId || null,
  };
}

// AWS client (reuse)
const awsClient =
  SMS_PROVIDER === "aws"
    ? new PinpointSMSVoiceV2Client({ region: REGION })
    : null;

/**
 * Gửi SMS unified
 */
export async function sendSms({ to, text }) {
  // ===== MOCK =====
  if (SMS_PROVIDER === "mock") {
    const safeText = sanitizeSmsTextForLog(text);
    logSmsInfo(`[SMS][MOCK] to=${maskPhone(to)} | ${safeText}`);
    await new Promise((r) => setTimeout(r, 50));
    return { ok: true, provider: "mock" };
  }

  // ===== AWS =====
  if (SMS_PROVIDER === "aws") {
    const safeText = sanitizeSmsTextForLog(text);

    for (let attempt = 1; attempt <= SMS_MAX_ATTEMPTS; attempt += 1) {
      try {
        const result = await sendAwsSmsOnce({ to, text });

        logSmsInfo(
          `[SMS][AWS] success attempt=${attempt} to=${maskPhone(to)} messageId=${result.messageId || "n/a"} body=${safeText}`,
        );

        return result;
      } catch (error) {
        const errorMessage = String(error?.message || "Unknown error").trim();
        const errorCode = String(
          error?.name || error?.Code || error?.code || "",
        ).trim();

        logSmsError(
          `[SMS][AWS] fail attempt=${attempt} to=${maskPhone(to)} errorCode=${errorCode || "UNKNOWN"} error=${errorMessage}`,
        );

        if (attempt < SMS_MAX_ATTEMPTS) {
          await sleep(SMS_RETRY_DELAY_MS);
          continue;
        }

        return {
          ok: false,
          provider: "aws",
          error: errorMessage,
          errorCode,
        };
      }
    }
  }

  // ===== UNKNOWN PROVIDER =====
  logSmsWarn(`[SMS] Unknown provider: ${SMS_PROVIDER}`);
  return {
    ok: false,
    provider: SMS_PROVIDER,
    error: "UNKNOWN_SMS_PROVIDER",
    errorCode: "UNKNOWN_SMS_PROVIDER",
  };
}
