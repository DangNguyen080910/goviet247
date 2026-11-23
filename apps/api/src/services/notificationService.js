import {notificationOutbox,isDeliveringNotification,notificationAlreadyAccepted,recordNotificationAccepted} from './notificationOutbox.js';
import {sendChatPushBatch} from './chatPushTransport.js';
import {activeAdminDevices} from './adminPushAccess.js';
import {tripNotificationContent} from '../shared/tripNotificationContent.js';
import { activeDriverDevices } from "./driverPushAccess.js";
// Path: goviet247/apps/api/src/services/notificationService.js
// ======================================================
// Service gửi push notification cho tài xế qua Expo Push API
// và SMS cho rider (stub)
// ======================================================

import pkg from "@prisma/client";
import { getTripRiderRecipientUserIds } from "./riderTripAccess.js";
const { PrismaClient } = pkg;

const prisma = new PrismaClient();


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

  // Phần cuối là tỉnh/thành, không xét lại như quận/huyện để tránh
  // "Thành phố Hồ Chí Minh" bị nhận nhầm thành districtPart.
  for (let i = parts.length - 2; i >= 0; i -= 1) {
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

  if (wardPart && provincePart) {
    if (wardPart.toLowerCase() === provincePart.toLowerCase()) {
      return wardPart;
    }
    return `${wardPart}, ${provincePart}`;
  }

  // Đồng bộ với danh sách chuyến: ưu tiên phường/xã theo địa giới mới.
  // Quận/huyện chỉ còn là fallback cho các địa chỉ cũ không có phường/xã.
  if (districtPart && provincePart) {
    if (districtPart.toLowerCase() === provincePart.toLowerCase()) {
      return districtPart;
    }
    return `${districtPart}, ${provincePart}`;
  }

  if (wardPart) {
    return wardPart;
  }

  if (districtPart) {
    return districtPart;
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
  const pending=[...new Map(messages.map(m=>[m.to,m])).values()].filter(m=>!notificationAlreadyAccepted(m.to));
  let accepted=0,removed=0;
  await sendChatPushBatch(pending,{
    removeDevice:async token=>{
      await prisma.device.deleteMany({where:{pushToken:token}});
      await recordNotificationAccepted(token);
      removed++;
    },
    onAccepted:async token=>{await recordNotificationAccepted(token);accepted++;},
  });
  return {accepted,removed,skipped:messages.length-pending.length};
}

/**
 * Gửi thông báo cuốc mới tới tất cả tài xế (role = "driver")
 */
export async function sendNewTripToDrivers(trip) {
  if(!isDeliveringNotification())return notificationOutbox.enqueue('sendNewTripToDrivers',[trip],()=>sendNewTripToDrivers(...[trip]));
  try {
    const audience = await prisma.trip.findUnique({ where: { id: trip.id }, select: { audienceDriverIds: true, partnerCompanyId: true, status:true, isVerified:true, driverId:true, cancelledAt:true, verifiedAt:true } });
    if (!audience || !Array.isArray(audience.audienceDriverIds)) return;
    if(audience.status!=='PENDING' || !audience.isVerified || audience.driverId || audience.cancelledAt)return;
    if(trip.verifiedAt && audience.verifiedAt && new Date(trip.verifiedAt).getTime()!==new Date(audience.verifiedAt).getTime())return;
    let devices = await prisma.device.findMany({
      where: {
        ...(audience.audienceDriverIds.length ? { userId: { in: audience.audienceDriverIds } } : {}),
        role: {
          in: ["driver", "DRIVER"],
        },
      },
      select: {
        pushSessionId: true,
        pushExpiresAt: true,
        userId: true,
        platform: true,
        pushToken: true,
        role: true,
      },
    });

    devices = await activeDriverDevices(prisma, devices, { requireVerified: true });


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

    const title = audience.partnerCompanyId ? "🚗 Cuốc mới · Khách đối tác" : "🚗 Cuốc mới";
    const pickupMasked = maskAddress(trip.pickupAddress);
    const dropoffMasked = maskAddress(trip.dropoffAddress);
    const pickup = shortText(pickupMasked, 32);
    const dropoff = shortText(dropoffMasked, 32);
    const price = formatVnd(trip.totalPrice ?? trip.fareEstimate ?? 0);
    const body = `${pickup} → ${dropoff}\n${price}`;

    const messages = validDevices.map((device) => ({
      to: device.pushToken,
      sound: "new_trip.wav",
      title,
      body,
      priority: "high",
      channelId: "new_trip_v2",
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
      `📲 [Push] Đã xử lý yêu cầu push cuốc mới cho ${validDevices.length} thiết bị.`,
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
  if(!isDeliveringNotification())return notificationOutbox.enqueue('sendSystemNotificationToDrivers',[notification],()=>sendSystemNotificationToDrivers(...[notification]));
  try {
    const audience = String(notification?.audience || "").toUpperCase();

    if (audience !== "DRIVER") {
      console.log(
        "[Push] Bỏ qua sendSystemNotificationToDrivers vì audience không phải DRIVER.",
      );
      return;
    }

    let devices = await prisma.device.findMany({
      where: {
        role: {
          in: ["driver", "DRIVER"],
        },
      },
      select: {
        pushSessionId: true,
        pushExpiresAt: true,
        userId: true,
        platform: true,
        pushToken: true,
      },
    });

    devices = await activeDriverDevices(prisma, devices, { requireVerified: false });

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
      `📲 [Push] Đã xử lý yêu cầu push thông báo hệ thống cho ${validDevices.length} thiết bị.`,
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
  if(!isDeliveringNotification())return notificationOutbox.enqueue('sendSystemNotificationToDriver',[userId,notification],()=>sendSystemNotificationToDriver(...[userId,notification]));
  try {
    if (!userId) {
      console.log("[Push] Missing userId for single driver notification.");
      return;
    }

    let devices = await prisma.device.findMany({
      where: {
        role: {
          in: ["driver", "DRIVER"],
        },
        userId,
      },
      select: {
        userId: true,
        pushSessionId: true,
        pushExpiresAt: true,
        pushToken: true,
        role: true,
      },
    });

    devices = await activeDriverDevices(prisma, devices);

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

    console.log(`[Push] Đã xử lý notification cho driver userId=${userId}`);
  } catch (err) {
    console.error("[Push] sendSystemNotificationToDriver error:", err);
    throw err;
  }
}

export async function sendAdminPushNotification({ title, body, data = {}, roles = ["admin", "staff", "ADMIN", "STAFF"] }) {
  if(!isDeliveringNotification())return notificationOutbox.enqueue('sendAdminPushNotification',[{title,body,data,roles}],()=>sendAdminPushNotification(...[{title,body,data,roles}]));
  try {
    const isNewTrip = data?.type === "ADMIN_NEW_TRIP" || data?.source === "create_trip";
    if(isNewTrip && data.tripId){
      const current=await prisma.trip.findUnique({where:{id:data.tripId},select:{status:true,isVerified:true,cancelledAt:true}});
      if(!current || current.status!=='PENDING' || current.isVerified || current.cancelledAt)return;
    }
    const devices = await prisma.device.findMany({
      where: {
        role: {
          in: roles,
        },
      },
      select: {
        userId: true,
        platform: true,
        pushToken: true,
        role: true,
        adminAuthVersion: true,
        pushExpiresAt: true,
      },
    });

    if (!devices.length) {
      console.log("📲 [AdminPush] Không có device admin/staff nào.");
      throw Object.assign(new Error('Chưa có thiết bị Admin để gửi push.'),{code:'ADMIN_PUSH_NO_ACTIVE_DEVICE'});
    }

    const validDevices = (await activeAdminDevices(prisma,devices)).filter(d=>isExpoPushToken(d.pushToken));

    if (!validDevices.length) {
      console.log("📲 [AdminPush] Không có Expo push token admin hợp lệ.");
      throw Object.assign(new Error('Thiết bị Admin cần đăng ký lại phiên push.'),{code:'ADMIN_PUSH_NO_ACTIVE_DEVICE'});
    }

    const messages = validDevices.map((device) => ({
      to: device.pushToken,
      sound: isNewTrip ? "duyetchuyen_notification.wav" : "default",
      title: shortText(title || "GoViet247 Admin", 60),
      body: shortText(body || "Có cập nhật mới trong hệ thống.", 140),
      priority: "high",
      channelId: isNewTrip ? "admin_new_trip_v1" : "admin_default_alerts",
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
      `📲 [AdminPush] Đã xử lý yêu cầu push cho ${validDevices.length} thiết bị admin/staff.`,
    );
  } catch (err) {
    console.error("[AdminPush] sendAdminPushNotification error:", err);
    throw err;
  }
}

export async function sendSystemNotificationToRiders(notification) {
  if(!isDeliveringNotification())return notificationOutbox.enqueue('sendSystemNotificationToRiders',[notification],()=>sendSystemNotificationToRiders(...[notification]));
  try {
    const audience = String(notification?.audience || "").toUpperCase();

    if (audience !== "RIDER") {
      console.log(
        "[Push] Bỏ qua sendSystemNotificationToRiders vì audience không phải RIDER.",
      );
      return;
    }

    let devices = await prisma.device.findMany({
      where: {
        ...(notification.targetType === "USER" ? {userId: notification.targetUserId || "__no_recipient__"} : {}),
        role: {
          in: ["rider", "RIDER"],
        },
      },
      select: {
        userId: true,
        platform: true,
        pushToken: true,
        role: true,
        pushSessionId: true,
        pushExpiresAt: true,
      },
    });

    devices = await activeDriverDevices(prisma, devices);

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
      `📲 [Push] Đã xử lý yêu cầu push thông báo hệ thống cho ${validDevices.length} thiết bị rider.`,
    );
  } catch (err) {
    console.error("[Push] sendSystemNotificationToRiders error:", err);
    throw err;
  }
}

function buildRiderTripStatusPushContent(trip, options = {}) {
  const {title,message}=tripNotificationContent(trip,options.reason);
  return {title,body:message};
}

export async function sendTripStatusChangedToRider(trip, options = {}) {
  if(!isDeliveringNotification())return notificationOutbox.enqueue('sendTripStatusChangedToRider',[trip,options],()=>sendTripStatusChangedToRider(...[trip,options]));
  try {
    const current=await prisma.trip.findUnique({where:{id:trip.id},select:{status:true,isVerified:true,driverId:true}});
    if(!current || current.status!==trip.status || Boolean(current.isVerified)!==Boolean(trip.isVerified) || (current.driverId || null)!==(trip.driverId || null))return;
    const recipientIds = await getTripRiderRecipientUserIds(prisma, trip);
    if (!recipientIds.length) return;

    let devices = await prisma.device.findMany({
      where: {
        role: {
          in: ["rider", "RIDER"],
        },
        userId: { in: recipientIds },
      },
      select: {
        userId: true,
        pushToken: true,
        platform: true,
        role: true,
        pushSessionId: true,
        pushExpiresAt: true,
      },
    });

    devices = await activeDriverDevices(prisma, devices);

    if (!devices.length) {
      console.log(`[Push] Không có device rider cho tripId=${trip?.id}`);
      return;
    }

    const validDevices = devices.filter((device) =>
      isExpoPushToken(device.pushToken),
    );

    if (!validDevices.length) {
      console.log(
        `[Push] Không có Expo push token hợp lệ cho rider tripId=${trip?.id}`,
      );
      return;
    }

    const content = buildRiderTripStatusPushContent(trip, options);

    const messages = [...new Map(validDevices.map(device => [device.pushToken, device])).values()].map((device) => ({
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
        riderId: device.userId,
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
      `[Push] Đã xử lý yêu cầu push cập nhật chuyến cho ${recipientIds.length} rider account(s), tripId=${trip?.id}`,
    );
  } catch (err) {
    console.error("[Push] sendTripStatusChangedToRider error:", err);
    throw err;
  }
}

const notificationHandlers={sendNewTripToDrivers,sendSystemNotificationToDrivers,sendSystemNotificationToDriver,sendAdminPushNotification,sendSystemNotificationToRiders,sendTripStatusChangedToRider};
export async function deliverNotificationJob(kind,args){
  const handler=notificationHandlers[kind];
  if(!Object.hasOwn(notificationHandlers,kind) || !Array.isArray(args))throw new Error('INVALID_NOTIFICATION_JOB');
  return handler(...args);
}
