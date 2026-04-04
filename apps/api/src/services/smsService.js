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
    console.log(`[SMS][MOCK] to=${to} | ${text}`);
    await new Promise((r) => setTimeout(r, 50));
    return { ok: true, provider: "mock" };
  }

  // ===== AWS =====
  if (SMS_PROVIDER === "aws") {
    try {
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
    } catch (error) {
      console.error("[SMS][AWS] error:", error);

      return {
        ok: false,
        provider: "aws",
        error: error?.message || "Unknown error",
      };
    }
  }

  // ===== UNKNOWN PROVIDER =====
  console.warn(`[SMS] Unknown provider: ${SMS_PROVIDER}`);
  return { ok: false, provider: SMS_PROVIDER };
}