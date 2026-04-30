// Path: goviet247/apps/api/src/services/notificationService.js
// ======================================================
// Service gửi push notification cho tài xế qua Expo Push API
// và SMS cho rider (stub)
// ======================================================

import pkg from "@prisma/client";
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Format tiền VND
 */
function formatVnd(value) {
  const amount = Number(value ?? 0);
  return `${amount.toLocaleString("vi-VN")}đ`;
}

/**
 * Rút gọn text để push body không quá dài
 */
function shortText(text, maxLength = 60) {
  const value = String(text || "").trim();

  if (!value) {
    return "";
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function normalizeDisplayAddress(address) {
  if (!address || typeof address !== "string") {
    return "";
  }

  let raw = address.trim();
  if (!raw) {
    return "";
  }

  raw = raw
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\bTP\.\s*HCM\b/gi, "Hồ Chí Minh")
    .replace(/\bTP HCM\b/gi, "Hồ Chí Minh")
    .replace(/\bTP\.?\s*Hồ Chí Minh\b/gi, "Hồ Chí Minh")
    .replace(/\bHCM\b/gi, "Hồ Chí Minh")
    .replace(/\bTP\.\s*/gi, "Thành phố ")
    .trim();

  raw = raw.replace(
    /\b(\d+)\s*hẻm\s+(\d+(?:\/\d+)?)\b/gi,
    (_, hemSo, duongSo) => `${duongSo}/${hemSo}`,
  );

  return raw;
}

function maskAddress(address) {
  const normalized = normalizeDisplayAddress(address);

  if (!normalized) {
    return "";
  }

  const parts = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return normalized;
  }

  const wardRegex =
    /\b(phường\s+[a-zà-ỹ0-9\s]+|xã\s+[a-zà-ỹ0-9\s]+|thị trấn\s+[a-zà-ỹ0-9\s]+)\b/i;

  const districtRegex =
    /\b(quận\s*\d+|quận\s+[a-zà-ỹ0-9\s]+|huyện\s+[a-zà-ỹ0-9\s]+|thị xã\s+[a-zà-ỹ0-9\s]+|thành phố\s+[a-zà-ỹ0-9\s]+)\b/i;

  let wardPart = "";
  let districtPart = "";
  let provincePart = parts[parts.length - 1] || "";

  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i];

    if (!districtPart && districtRegex.test(part)) {
      districtPart = part.replace(/\s+/g, " ").trim();
      continue;
    }

    if (!wardPart && wardRegex.test(part)) {
      wardPart = part.replace(/\s+/g, " ").trim();
    }
  }

  provincePart = String(provincePart || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!districtPart && parts.length >= 3) {
    const fallbackDistrict = String(parts[parts.length - 2] || "")
      .replace(/\s+/g, " ")
      .trim();

    if (
      fallbackDistrict &&
      fallbackDistrict.toLowerCase() !== provincePart.toLowerCase() &&
      fallbackDistrict.toLowerCase() !== wardPart.toLowerCase()
    ) {
      districtPart = fallbackDistrict;
    }
  }

  if (districtPart && provincePart) {
    if (districtPart.toLowerCase() === provincePart.toLowerCase()) {
      return districtPart;
    }
    return `${districtPart}, ${provincePart}`;
  }

  if (wardPart && provincePart) {
    if (wardPart.toLowerCase() === provincePart.toLowerCase()) {
      return wardPart;
    }
    return `${wardPart}, ${provincePart}`;
  }

  if (districtPart) {
    return districtPart;
  }

  if (wardPart) {
    return wardPart;
  }

  if (provincePart) {
    return provincePart;
  }

  if (parts.length >= 2) {
    return parts.slice(-2).join(", ");
  }

  return normalized;
}

/**
 * Kiểm tra token có giống Expo push token hay không
 */
function isExpoPushToken(token) {
  const value = String(token || "").trim();

  return (
    value.startsWith("ExponentPushToken[") || value.startsWith("ExpoPushToken[")
  );
}

/**
 * Chia mảng thành các batch nhỏ
 */
function chunkArray(items, size = 100) {
  const chunks = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

/**
 * Gửi request tới Expo Push API
 */
async function sendExpoPushMessages(messages) {
  const EXPO_PUSH_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function fetchExpoPushReceipts(ids = []) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return null;
    }

    const response = await fetch(EXPO_PUSH_RECEIPTS_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids }),
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const message =
        data?.errors?.[0]?.message ||
        data?.message ||
        `Expo receipts request failed with status ${response.status}`;

      throw new Error(message);
    }

    return data;
  }

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.errors?.[0]?.message ||
      data?.message ||
      `Expo push request failed with status ${response.status}`;

    throw new Error(message);
  }

  try {
    const tickets = Array.isArray(data?.data)
      ? data.data
      : data?.data
        ? [data.data]
        : [];

    const receiptIds = tickets
      .map((ticket) => String(ticket?.id || "").trim())
      .filter(Boolean);

    console.log(
      "[Push] Expo tickets:",
      JSON.stringify(
        {
          totalMessages: Array.isArray(messages) ? messages.length : 1,
          totalTickets: tickets.length,
          receiptIds,
          tickets,
        },
        null,
        2,
      ),
    );

    if (receiptIds.length > 0) {
      // Debug nhanh cho staging/dev:
      // receipts có thể chưa sẵn ngay, nên mình đợi ngắn rồi hỏi thử.
      await sleep(4000);

      const receipts = await fetchExpoPushReceipts(receiptIds);

      console.log("[Push] Expo receipts:", JSON.stringify(receipts, null, 2));
    } else {
      console.log("[Push] Expo tickets không có receipt id để kiểm tra.");
    }
  } catch (receiptError) {
    console.error("[Push] fetch receipts error:", receiptError);
  }

  return data;
}

/**
 * Gửi thông báo cuốc mới tới tất cả tài xế (role = "driver")
 */
export async function sendNewTripToDrivers(trip) {
  try {
    const devices = await prisma.device.findMany({
      where: {
        role: {
          in: ["driver", "DRIVER"],
        },
      },
      select: {
        userId: true,
        platform: true,
        pushToken: true,
        role: true,
      },
    });

    if (!devices.length) {
      console.log("📲 [Push] Không có device tài xế nào để gửi thông báo.");
      return;
    }

    const validDevices = devices.filter((device) =>
      isExpoPushToken(device.pushToken),
    );

    if (!validDevices.length) {
      console.log(
        "📲 [Push] Không có Expo push token hợp lệ để gửi thông báo.",
      );
      return;
    }

    const title = "🚗 Cuốc mới";
    const pickupMasked = maskAddress(trip.pickupAddress);
    const dropoffMasked = maskAddress(trip.dropoffAddress);
    const pickup = shortText(pickupMasked, 32);
    const dropoff = shortText(dropoffMasked, 32);
    const price = formatVnd(trip.totalPrice ?? trip.fareEstimate ?? 0);
    const body = `${pickup} → ${dropoff}\n${price}`;

    const messages = validDevices.map((device) => ({
      to: device.pushToken,
      sound: "default",
      title,
      body,
      priority: "high",
      channelId: "new_trip",
      badge: 1,
      data: {
        type: "NEW_TRIP",
        tripId: trip.id,
        pickupAddressMasked: pickupMasked,
        dropoffAddressMasked: dropoffMasked,
        totalPrice: Number(trip.totalPrice ?? trip.fareEstimate ?? 0),
        carType: trip.carType ?? null,
        direction: trip.direction ?? null,
        pickupTime: trip.pickupTime ?? null,
      },
    }));

    console.log("📲 [Push] Chuẩn bị gửi thông báo cuốc mới:", {
      tripId: trip.id,
      totalDevices: devices.length,
      validExpoTokens: validDevices.length,
      title,
      body,
      pickupMasked,
      dropoffMasked,
    });

    const batches = chunkArray(messages, 100);

    for (const batch of batches) {
      const result = await sendExpoPushMessages(batch);

      console.log("📲 [Push] Expo response:", JSON.stringify(result, null, 2));
    }

    console.log(
      `📲 [Push] Đã gửi push cuốc mới cho ${validDevices.length} thiết bị.`,
    );
  } catch (err) {
    console.error("[Push] sendNewTripToDrivers error:", err);
    throw err;
  }
}

/**
 * Gửi SMS cho rider (stub)
 * Sau này sẽ tích hợp Twilio / Viettel / Nexmo thật.
 */
export async function sendSms(phone, text) {
  try {
    console.log(`📩 [SMS] → ${phone}: ${text}`);
    // TODO: Thay bằng call API gửi SMS thật ở đây
  } catch (err) {
    console.error("[SMS] Gửi thất bại:", err);
  }
}

/**
 * Gửi push thông báo hệ thống tới tất cả tài xế
 */
export async function sendSystemNotificationToDrivers(notification) {
  try {
    const audience = String(notification?.audience || "").toUpperCase();

    if (audience !== "DRIVER") {
      console.log(
        "[Push] Bỏ qua sendSystemNotificationToDrivers vì audience không phải DRIVER.",
      );
      return;
    }

    const devices = await prisma.device.findMany({
      where: {
        role: {
          in: ["driver", "DRIVER"],
        },
      },
      select: {
        userId: true,
        platform: true,
        pushToken: true,
      },
    });

    if (!devices.length) {
      console.log(
        "📲 [Push] Không có device tài xế nào để gửi thông báo hệ thống.",
      );
      return;
    }

    const validDevices = devices.filter((device) =>
      isExpoPushToken(device.pushToken),
    );

    if (!validDevices.length) {
      console.log(
        "📲 [Push] Không có Expo push token hợp lệ để gửi thông báo hệ thống.",
      );
      return;
    }

    const title = shortText(notification?.title || "Thông báo", 60);
    const body = shortText(notification?.message || "", 120);

    const messages = validDevices.map((device) => ({
      to: device.pushToken,
      sound: "default",
      title,
      body,
      priority: "high",
      badge: 1,
      data: {
        type: "SYSTEM_NOTIFICATION",
        notificationId: notification.id,
        audience: notification.audience,
        title: notification.title,
      },
    }));

    console.log("📲 [Push] Chuẩn bị gửi thông báo hệ thống cho DRIVER:", {
      notificationId: notification?.id,
      totalDevices: devices.length,
      validExpoTokens: validDevices.length,
      title,
      body,
    });

    const batches = chunkArray(messages, 100);

    for (const batch of batches) {
      const result = await sendExpoPushMessages(batch);

      console.log(
        "📲 [Push] Expo response (system notification):",
        JSON.stringify(result, null, 2),
      );
    }

    console.log(
      `📲 [Push] Đã gửi push thông báo hệ thống cho ${validDevices.length} thiết bị.`,
    );
  } catch (err) {
    console.error("[Push] sendSystemNotificationToDrivers error:", err);
    throw err;
  }
}

/**
 * Gửi push thông báo hệ thống cho 1 tài xế cụ thể
 */
export async function sendSystemNotificationToDriver(userId, notification) {
  try {
    if (!userId) {
      console.log("[Push] Missing userId for single driver notification.");
      return;
    }

    const devices = await prisma.device.findMany({
      where: {
        role: {
          in: ["driver", "DRIVER"],
        },
        userId,
      },
      select: {
        pushToken: true,
        role: true,
      },
    });

    if (!devices.length) {
      console.log(`[Push] Không có device cho driver userId=${userId}`);
      return;
    }

    const validDevices = devices.filter((d) => isExpoPushToken(d.pushToken));

    if (!validDevices.length) {
      console.log(
        `[Push] Không có Expo token hợp lệ cho driver userId=${userId}`,
      );
      return;
    }

    const messages = validDevices.map((d) => ({
      to: d.pushToken,
      sound: "default",
      title: notification.title,
      body: notification.message,
      priority: "high",
      channelId: "trip_updates",
      badge: 1,
      data: {
        type: "SYSTEM_NOTIFICATION",
        notificationId: notification.id,
      },
    }));

    const batches = chunkArray(messages, 100);

    for (const batch of batches) {
      const result = await sendExpoPushMessages(batch);

      console.log(
        "📲 [Push] Expo response (single driver notification):",
        JSON.stringify(result, null, 2),
      );
    }

    console.log(`[Push] Đã gửi notification cho driver userId=${userId}`);
  } catch (err) {
    console.error("[Push] sendSystemNotificationToDriver error:", err);
  }
}

export async function sendAdminPushNotification({ title, body, data = {} }) {
  try {
    const devices = await prisma.device.findMany({
      where: {
        role: {
          in: ["admin", "staff", "ADMIN", "STAFF"],
        },
      },
      select: {
        userId: true,
        platform: true,
        pushToken: true,
        role: true,
      },
    });

    if (!devices.length) {
      console.log("📲 [AdminPush] Không có device admin/staff nào.");
      return;
    }

    const validDevices = devices.filter((device) =>
      isExpoPushToken(device.pushToken),
    );

    if (!validDevices.length) {
      console.log("📲 [AdminPush] Không có Expo push token admin hợp lệ.");
      return;
    }

    const messages = validDevices.map((device) => ({
      to: device.pushToken,
      sound: "admin_alert.mp3",
      title: shortText(title || "GoViet247 Admin", 60),
      body: shortText(body || "Có cập nhật mới trong hệ thống.", 140),
      priority: "high",
      badge: 1,
      data: {
        type: "ADMIN_NOTIFICATION",
        ...data,
      },
    }));

    console.log("📲 [AdminPush] Chuẩn bị gửi push admin:", {
      totalDevices: devices.length,
      validExpoTokens: validDevices.length,
      title,
      body,
      data,
    });

    const batches = chunkArray(messages, 100);

    for (const batch of batches) {
      const result = await sendExpoPushMessages(batch);

      console.log(
        "📲 [AdminPush] Expo response:",
        JSON.stringify(result, null, 2),
      );
    }

    console.log(
      `📲 [AdminPush] Đã gửi push cho ${validDevices.length} thiết bị admin/staff.`,
    );
  } catch (err) {
    console.error("[AdminPush] sendAdminPushNotification error:", err);
    throw err;
  }
}

export async function sendSystemNotificationToRiders(notification) {
  try {
    const audience = String(notification?.audience || "").toUpperCase();

    if (audience !== "RIDER") {
      console.log(
        "[Push] Bỏ qua sendSystemNotificationToRiders vì audience không phải RIDER.",
      );
      return;
    }

    const devices = await prisma.device.findMany({
      where: {
        role: {
          in: ["rider", "RIDER"],
        },
      },
      select: {
        userId: true,
        platform: true,
        pushToken: true,
        role: true,
      },
    });

    if (!devices.length) {
      console.log(
        "📲 [Push] Không có device rider nào để gửi thông báo hệ thống.",
      );
      return;
    }

    const validDevices = devices.filter((device) =>
      isExpoPushToken(device.pushToken),
    );

    if (!validDevices.length) {
      console.log(
        "📲 [Push] Không có Expo push token hợp lệ để gửi thông báo hệ thống cho rider.",
      );
      return;
    }

    const title = shortText(notification?.title || "Thông báo", 60);
    const body = shortText(notification?.message || "", 120);

    const messages = validDevices.map((device) => ({
      to: device.pushToken,
      sound: "default",
      title,
      body,
      priority: "high",
      channelId: "system_notifications",
      badge: 1,
      data: {
        type: "SYSTEM_NOTIFICATION",
        notificationId: notification.id,
        audience: notification.audience,
        title: notification.title,
      },
    }));

    console.log("📲 [Push] Chuẩn bị gửi thông báo hệ thống cho RIDER:", {
      notificationId: notification?.id,
      totalDevices: devices.length,
      validExpoTokens: validDevices.length,
      title,
      body,
    });

    const batches = chunkArray(messages, 100);

    for (const batch of batches) {
      const result = await sendExpoPushMessages(batch);

      console.log(
        "📲 [Push] Expo response (system notification rider):",
        JSON.stringify(result, null, 2),
      );
    }

    console.log(
      `📲 [Push] Đã gửi push thông báo hệ thống cho ${validDevices.length} thiết bị rider.`,
    );
  } catch (err) {
    console.error("[Push] sendSystemNotificationToRiders error:", err);
    throw err;
  }
}

function buildRiderTripStatusPushContent(trip, options = {}) {
  const status = String(trip?.status || "")
    .trim()
    .toUpperCase();

  const reason = String(options?.reason || "")
    .trim()
    .toUpperCase();

  if (reason === "ADMIN_VERIFY_TRIP") {
    return {
      title: "Chuyến đã được duyệt",
      body: "Chuyến của bạn đã được duyệt và đang chờ tài xế nhận.",
    };
  }

  switch (status) {
    case "ACCEPTED":
      return {
        title: "Tài xế đã nhận chuyến",
        body: "Chuyến của bạn đã có tài xế nhận. Vui lòng để ý điện thoại.",
      };
    case "CONTACTED":
      return {
        title: "Tài xế đã liên hệ",
        body: "Tài xế đang liên hệ với bạn. Vui lòng kiểm tra điện thoại.",
      };
    case "IN_PROGRESS":
      return {
        title: "Chuyến đi đang diễn ra",
        body: "Tài xế đã bắt đầu hành trình với chuyến của bạn.",
      };
    case "COMPLETED":
      return {
        title: "Chuyến đi đã hoàn thành",
        body: "Cảm ơn bạn đã sử dụng GoViet247.",
      };
    case "CANCELLED":
      return {
        title: "Chuyến đi đã bị huỷ",
        body: "Chuyến của bạn đã bị huỷ. Vui lòng kiểm tra lại trong ứng dụng.",
      };
    default:
      return {
        title: "Cập nhật chuyến đi",
        body: "Chuyến của bạn vừa có thay đổi mới.",
      };
  }
}

export async function sendTripStatusChangedToRider(trip, options = {}) {
  try {
    const riderId = String(trip?.riderId || "").trim();

    if (!riderId) {
      console.log("[Push] Bỏ qua push rider trip status vì thiếu riderId.");
      return;
    }

    const devices = await prisma.device.findMany({
      where: {
        role: {
          in: ["rider", "RIDER"],
        },
        userId: riderId,
      },
      select: {
        pushToken: true,
        platform: true,
        role: true,
      },
    });

    if (!devices.length) {
      console.log(`[Push] Không có device rider cho userId=${riderId}`);
      return;
    }

    const validDevices = devices.filter((device) =>
      isExpoPushToken(device.pushToken),
    );

    if (!validDevices.length) {
      console.log(
        `[Push] Không có Expo push token hợp lệ cho rider userId=${riderId}`,
      );
      return;
    }

    const content = buildRiderTripStatusPushContent(trip, options);

    const messages = validDevices.map((device) => ({
      to: device.pushToken,
      sound: "default",
      title: shortText(content.title || "Cập nhật chuyến đi", 60),
      body: shortText(content.body || "", 120),
      priority: "high",
      channelId: "trip_updates",
      badge: 1,
      data: {
        type: "TRIP_STATUS_CHANGED",
        tripId: trip.id,
        riderId,
        status: trip.status,
        reason: options?.reason || null,
        isVerified: Boolean(trip?.isVerified),
      },
    }));

    const batches = chunkArray(messages, 100);

    for (const batch of batches) {
      const result = await sendExpoPushMessages(batch);

      console.log(
        "📲 [Push] Expo response (trip status rider):",
        JSON.stringify(result, null, 2),
      );
    }

    console.log(
      `[Push] Đã gửi push cập nhật chuyến cho rider userId=${riderId}, tripId=${trip?.id}`,
    );
  } catch (err) {
    console.error("[Push] sendTripStatusChangedToRider error:", err);
    throw err;
  }
}
