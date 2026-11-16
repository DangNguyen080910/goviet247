import { isIP } from "node:net";

const WINDOW_MS = 5 * 60 * 1000;
const LOCK_MS = 30 * 60 * 1000;
const MAX_REQUESTS = 10;
const requestsByIp = new Map();

function normalizeIp(value) {
  return String(value || "").trim().replace(/^::ffff:/i, "");
}

function getClientIp(req) {
  const peer = normalizeIp(req.socket?.remoteAddress);
  const isLocalProxy = peer.startsWith("127.") || peer === "::1";
  if (!isLocalProxy) return peer || "unknown";

  // The local reverse proxy appends or replaces the direct client address.
  const forwarded = req.headers["x-forwarded-for"];
  const candidate = normalizeIp(String(forwarded || "").split(",").at(-1));
  return isIP(candidate) ? candidate : peer;
}

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of requestsByIp) {
    if (entry.expiresAt <= now) requestsByIp.delete(ip);
  }
}, WINDOW_MS);
cleanup.unref();

export function otpIpRateLimit(req, res, next) {
  const now = Date.now();
  const ip = getClientIp(req);
  let entry = requestsByIp.get(ip);
  if (!entry || entry.expiresAt <= now) {
    entry = { count: 0, expiresAt: now + WINDOW_MS };
    requestsByIp.set(ip, entry);
  }

  if (entry.count >= MAX_REQUESTS) {
    const retryAfter = Math.max(1, Math.ceil((entry.expiresAt - now) / 1000));
    return res.set("Retry-After", String(retryAfter)).status(429).json({
      success: false,
      code: "OTP_IP_LIMIT",
      message: "Kết nối này đã yêu cầu OTP quá nhiều lần. Vui lòng thử lại sau hoặc liên hệ Zalo 0326 184 628 để được hỗ trợ.",
      retry_after: retryAfter,
    });
  }

  entry.count += 1;
  if (entry.count === MAX_REQUESTS) entry.expiresAt = now + LOCK_MS;
  return next();
}
