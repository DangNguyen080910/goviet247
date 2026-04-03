// Path: goviet247/apps/api/src/services/smsService.js
/* Mock SMS service — in ra console thay vì gọi nhà mạng */
export async function sendSms({ to, text }) {
  // Việt: giả lập gửi sms, trả về ok luôn
  // Eng : mock provider
  console.log(`[SMS][MOCK] to=${to} | ${text}`);
  // giả lập độ trễ nhẹ
  await new Promise(r => setTimeout(r, 50));
  return { ok: true, provider: "mock" };
}
