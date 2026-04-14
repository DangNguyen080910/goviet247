// Path: goviet247/apps/api/src/controllers/tripController.js
/// ======================================================
// Controller xử lý toàn bộ logic Trip cho cả Rider và Driver
// ======================================================

import { prisma } from "../utils/db.js";
import { estimateFareFromCoordinates } from "../services/fareService.js";
import { updateTripStatus } from "../services/tripStateService.js";
import {
  sendSms,
  sendNewTripToDrivers,
  sendTripStatusChangedToRider,
  sendSystemNotificationToDriver,
} from "../services/notificationService.js";
import { calculateDriverFinanceSnapshot } from "../services/driverFinanceService.js";

// ======================================================
// Helpers
// ======================================================

const ACTIVE_DRIVER_TRIP_STATUSES = ["ACCEPTED", "CONTACTED", "IN_PROGRESS"];

/**
 * Việt: Lấy số giây delay mở nhận chuyến mới từ DriverConfig
 */
async function getNewTripAcceptDelaySeconds() {
  const config = await prisma.driverConfig.findFirst({
    orderBy: { id: "asc" },
    select: {
      newTripAcceptDelaySeconds: true,
    },
  });

  const seconds = Number(config?.newTripAcceptDelaySeconds ?? 10);

  if (!Number.isFinite(seconds) || seconds < 0) {
    return 10;
  }

  return Math.floor(seconds);
}

/**
 * Việt: Lấy config tài xế cần dùng ở driver app / accept trip
 */
async function getDriverConfigSnapshot() {
  const cfg = await prisma.driverConfig.findFirst({
    orderBy: { id: "asc" },
    select: {
      commissionPercent: true,
      driverVatPercent: true,
      driverPitPercent: true,
      driverVatBaseMode: true,
      driverPitBaseMode: true,
      maxActiveTrips: true,
      newTripAcceptDelaySeconds: true,
    },
  });

  return {
    commissionPercent: Number(cfg?.commissionPercent ?? 0),
    driverVatPercent: Number(cfg?.driverVatPercent ?? 0),
    driverPitPercent: Number(cfg?.driverPitPercent ?? 0),
    driverVatBaseMode: cfg?.driverVatBaseMode || "GROSS_TRIP_AMOUNT",
    driverPitBaseMode: cfg?.driverPitBaseMode || "GROSS_TRIP_AMOUNT",
    maxActiveTrips: Number(cfg?.maxActiveTrips ?? 1),
    newTripAcceptDelaySeconds: Number(cfg?.newTripAcceptDelaySeconds ?? 0),
  };
}

/**
 * Việt: Đếm số chuyến active hiện tại của 1 tài xế
 */
async function countDriverActiveTrips(driverId, tx = prisma) {
  if (!driverId) {
    return 0;
  }

  return tx.trip.count({
    where: {
      driverId,
      status: {
        in: ACTIVE_DRIVER_TRIP_STATUSES,
      },
      cancelledAt: null,
    },
  });
}

/**
 * Việt: Tính thời điểm mở nhận chuyến cho driver
 */
async function buildDriverAcceptOpenAt() {
  const delaySeconds = await getNewTripAcceptDelaySeconds();

  if (delaySeconds <= 0) {
    return new Date();
  }

  return new Date(Date.now() + delaySeconds * 1000);
}

/**
 * Việt: Chuẩn hoá địa chỉ để hiển thị masked cho tab "Chưa tài xế"
 *
 * Mục tiêu:
 * - Không lộ số nhà / địa chỉ quá chi tiết trước khi tài xế nhận chuyến
 * - Vẫn đủ thông tin để tài xế quyết định có muốn nhận không
 *
 * Ví dụ:
 * - "33/4 Đặng Văn Ngữ, Phường 10, Quận Phú Nhuận, Hồ Chí Minh"
 *   -> "Quận Phú Nhuận, Hồ Chí Minh"
 * - "12 Nguyễn Huệ Quận 1 HCM"
 *   -> "Quận 1, Hồ Chí Minh"
 * - "Khách Sạn Đà Lạt 02 Trần Phú Đà Lạt"
 *   -> fallback lấy phần cuối phù hợp như "Đà Lạt"
 */
function maskAddress(address) {
  if (!address || typeof address !== "string") {
    return "";
  }

  const raw = address.trim();
  if (!raw) {
    return "";
  }

  const normalized = raw
    .replace(/\s+/g, " ")
    .replace(/\bTP\.\s*HCM\b/gi, "Hồ Chí Minh")
    .replace(/\bTP HCM\b/gi, "Hồ Chí Minh")
    .replace(/\bTP\.?\s*Hồ Chí Minh\b/gi, "Hồ Chí Minh")
    .replace(/\bHCM\b/gi, "Hồ Chí Minh")
    .replace(/\bTP\.\s*/gi, "Thành phố ")
    .trim();

  const commaParts = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const districtRegex =
    /\b(quận\s*\d+|quận\s+[a-zà-ỹ0-9\s]+|huyện\s+[a-zà-ỹ0-9\s]+|thị xã\s+[a-zà-ỹ0-9\s]+|thành phố\s+[a-zà-ỹ0-9\s]+)\b/i;

  const cityRegex =
    /\b(hồ chí minh|hà nội|đà nẵng|cần thơ|hải phòng|khánh hòa|lâm đồng|bình thuận|bến tre|đồng nai|bình dương|vũng tàu|bà rịa - vũng tàu|long an|tiền giang|an giang|kiên giang|đồng tháp|vĩnh long|trà vinh|sóc trăng|bạc liêu|cà mau|phú yên|quảng nam|quảng ngãi|quảng ninh|nghệ an|thanh hóa|ninh thuận|bình định|đắk lắk|gia lai|kon tum|huế|thừa thiên huế|lào cai|đà lạt|phan thiết)\b/i;

  let districtPart = "";
  let cityPart = "";

  for (let i = commaParts.length - 1; i >= 0; i -= 1) {
    const part = commaParts[i];

    if (!districtPart && districtRegex.test(part)) {
      districtPart = part;
      continue;
    }

    if (!cityPart && cityRegex.test(part)) {
      cityPart = part;
    }
  }

  if (districtPart && cityPart) {
    const districtNorm = districtPart.replace(/\s+/g, " ").trim();
    const cityNorm = cityPart.replace(/\s+/g, " ").trim();

    if (districtNorm.toLowerCase() === cityNorm.toLowerCase()) {
      return districtNorm;
    }

    return `${districtNorm}, ${cityNorm}`;
  }

  if (districtPart) {
    return districtPart.replace(/\s+/g, " ").trim();
  }

  if (cityPart) {
    return cityPart.replace(/\s+/g, " ").trim();
  }

  if (commaParts.length >= 2) {
    return commaParts.slice(-2).join(", ");
  }

  if (commaParts.length === 1) {
    const onePart = commaParts[0];

    const districtMatch = onePart.match(districtRegex);
    if (districtMatch?.[0]) {
      return districtMatch[0].replace(/\s+/g, " ").trim();
    }

    const cityMatch = onePart.match(cityRegex);
    if (cityMatch?.[0]) {
      return cityMatch[0].replace(/\s+/g, " ").trim();
    }

    const words = onePart.split(" ").filter(Boolean);
    if (words.length >= 2) {
      return words.slice(-2).join(" ");
    }

    return onePart;
  }

  return normalized;
}

/**
 * Việt: Không hiện lại bất kỳ thông tin cá nhân nào của khách trong lịch sử chuyến
 */
function maskRiderName() {
  return "Khách hàng";
}

/**
 * Việt: Không hiện lại số điện thoại khách trong lịch sử chuyến
 */
function maskRiderPhone() {
  return "";
}

/**
 * Việt: Serialize trip cho driver app theo từng scope
 *
 * scope:
 * - available: chuyến đang chờ nhận -> masked địa chỉ, không lộ thông tin khách
 * - active: chuyến tài xế đang xử lý -> full thông tin
 * - history: lịch sử chuyến -> masked lại địa chỉ, ẩn thông tin khách
 */
function serializeDriverTrip(trip, scope = "active", extra = {}) {
  const stops = Array.isArray(trip?.stops) ? trip.stops : [];

  const base = {
    ...trip,
    ...extra,
  };

  if (scope === "available") {
    return {
      ...base,
      pickupAddressMasked: maskAddress(trip.pickupAddress),
      dropoffAddressMasked: maskAddress(trip.dropoffAddress),
      stops: stops.map((stop) => ({
        ...stop,
        addressMasked: maskAddress(stop.address),
      })),
      riderName: "",
      riderPhone: "",
      riderNameMasked: maskRiderName(),
      riderPhoneMasked: maskRiderPhone(),
      note: null,
    };
  }

  if (scope === "history") {
    return {
      ...base,
      pickupAddressMasked: maskAddress(trip.pickupAddress),
      dropoffAddressMasked: maskAddress(trip.dropoffAddress),
      stops: stops.map((stop) => ({
        ...stop,
        addressMasked: maskAddress(stop.address),
      })),
      riderName: "",
      riderPhone: "",
      riderNameMasked: maskRiderName(),
      riderPhoneMasked: maskRiderPhone(),
    };
  }

  return {
    ...base,
    pickupAddressMasked: maskAddress(trip.pickupAddress),
    dropoffAddressMasked: maskAddress(trip.dropoffAddress),
    stops,
    riderNameMasked: maskRiderName(),
    riderPhoneMasked: maskRiderPhone(),
  };
}

/**
 * Việt: Emit realtime cho driver app
 *
 * Mục tiêu:
 * - Nếu có driverId cụ thể -> báo cho room riêng driver:{userId}
 * - Đồng thời có thể báo room "drivers" để mọi tài xế refresh list available
 */
function emitTripChangedToDrivers(io, payload = {}) {
  if (!io) {
    return;
  }

  const {
    tripId,
    fromStatus = null,
    toStatus = null,
    driverId = null,
    previousDriverId = null,
    updatedAt = null,
    reason = null,
    refreshAvailable = true,
  } = payload;

  const eventPayload = {
    tripId: tripId || null,
    fromStatus,
    toStatus,
    driverId,
    previousDriverId,
    updatedAt,
    reason,
  };

  if (refreshAvailable) {
    io.to("drivers").emit("trip:changed", eventPayload);
  }

  if (driverId) {
    io.to(`driver:${driverId}`).emit("trip:changed", eventPayload);
  }

  if (previousDriverId && previousDriverId !== driverId) {
    io.to(`driver:${previousDriverId}`).emit("trip:changed", eventPayload);
  }

  console.log(
    "[Socket] Emit trip:changed -> drivers",
    JSON.stringify(eventPayload),
  );
}

function emitTripChangedToRider(io, payload = {}) {
  if (!io) {
    return;
  }

  const {
    riderId = null,
    tripId = null,
    fromStatus = null,
    toStatus = null,
    updatedAt = null,
    reason = null,
  } = payload;

  if (!riderId) {
    return;
  }

  const eventPayload = {
    tripId,
    riderId,
    fromStatus,
    toStatus,
    updatedAt,
    reason,
  };

  io.to(`rider:${riderId}`).emit("rider:trip_changed", eventPayload);

  console.log(
    "[Socket] Emit rider:trip_changed -> rider",
    JSON.stringify(eventPayload),
  );
}

/**
 * Việt: Emit event chung để admin web reload toàn bộ badge / dashboard
 *
 * Dùng cho mọi thay đổi có thể ảnh hưởng sidebar badge:
 * - trip mới
 * - verify trip
 * - driver accept trip
 * - đổi status trip
 * - withdraw request mới
 */
function emitAdminDashboardChanged(io, payload = {}) {
  if (!io) return;

  const eventPayload = {
    source: payload.source || "unknown",
    tripId: payload.tripId || null,
    driverId: payload.driverId || null,
    status: payload.status || null,
    fromStatus: payload.fromStatus || null,
    toStatus: payload.toStatus || null,
    updatedAt: payload.updatedAt || new Date().toISOString(),
  };

  io.to("admins").emit("admin:dashboard_changed", eventPayload);

  console.log(
    "[Socket] Emit admin:dashboard_changed -> admins",
    JSON.stringify(eventPayload),
  );
}

// ======================================================
// 🧭 RIDER ACTIONS
// ======================================================

/**
 * POST /api/trips/estimate
 * Body: { pickupLat, pickupLng, dropoffLat, dropoffLng }
 * -> Trả về distanceKm + fare (không lưu vào DB)
 */
export async function estimateTrip(req, res) {
  try {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng } = req.body;

    if (
      pickupLat == null ||
      pickupLng == null ||
      dropoffLat == null ||
      dropoffLng == null
    ) {
      return res.status(400).json({
        error: "pickupLat, pickupLng, dropoffLat, dropoffLng are required",
      });
    }

    const result = await estimateFareFromCoordinates(
      Number(pickupLat),
      Number(pickupLng),
      Number(dropoffLat),
      Number(dropoffLng),
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error("[Trip] estimateTrip error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/trips
 * Rider tạo trip mới.
 *
 * ⚠️ Lưu ý:
 * - Hiện tại route POST /api/trips đang handle create trực tiếp trong routes/trips.js (Day 21).
 * - Hàm này có thể là legacy. Tạm thời giữ để không phá code cũ.
 *
 * ✅ Nhưng để tránh “quên emit” trong trường hợp ai đó gọi nhầm vào controller,
 * mình thêm luôn emit admin:new_trip ở đây (an toàn).
 */
export async function createTrip(req, res) {
  try {
    const {
      pickupAddress,
      pickupLat,
      pickupLng,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      riderId: riderIdFromBody,
    } = req.body;

    const riderIdFromToken = req.user?.id;
    const riderId = riderIdFromToken || riderIdFromBody;

    if (!riderId) {
      return res.status(401).json({
        error: "riderId is required (either from token or body)",
      });
    }

    if (
      !pickupAddress ||
      pickupLat == null ||
      pickupLng == null ||
      !dropoffAddress ||
      dropoffLat == null ||
      dropoffLng == null
    ) {
      return res.status(400).json({
        error:
          "pickupAddress, pickupLat, pickupLng, dropoffAddress, dropoffLat, dropoffLng are required",
      });
    }

    const estimate = await estimateFareFromCoordinates(
      Number(pickupLat),
      Number(pickupLng),
      Number(dropoffLat),
      Number(dropoffLng),
    );

    const trip = await prisma.trip.create({
      data: {
        riderId,
        pickupAddress,
        pickupLat: Number(pickupLat),
        pickupLng: Number(pickupLng),
        dropoffAddress,
        dropoffLat: Number(dropoffLat),
        dropoffLng: Number(dropoffLng),
        distanceKm: estimate.distanceKm,
        fareEstimate: estimate.fare,
        status: "PENDING",
        isVerified: false,
      },
    });

    const io = req.app?.get?.("io");
    if (io) {
      io.to("admins").emit("admin:new_trip", {
        tripId: trip.id,
        status: trip.status,
        createdAt: trip.createdAt,
      });

      emitAdminDashboardChanged(io, {
        source: "create_trip",
        tripId: trip.id,
        status: trip.status,
        updatedAt: trip.createdAt,
      });

      emitTripChangedToRider(io, {
        riderId: trip.riderId || null,
        tripId: trip.id,
        fromStatus: null,
        toStatus: trip.status,
        updatedAt: trip.createdAt,
        reason: "create_trip",
      });

      console.log("[Socket] emitted admin:new_trip (controller):", trip.id);
    }

    return res.status(201).json({
      success: true,
      data: { trip, estimate },
    });
  } catch (err) {
    console.error("[Trip] createTrip error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/trips/my
 * -> Customer xem lịch sử chuyến đi của chính mình
 */
export async function listMyCustomerTrips(req, res) {
  try {
    const riderId = req.user?.uid || req.user?.id;

    if (!riderId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const trips = await prisma.trip.findMany({
      where: { riderId },
      orderBy: { createdAt: "desc" },
      include: {
        stops: {
          orderBy: { seq: "asc" },
          select: {
            id: true,
            seq: true,
            address: true,
          },
        },
      },
      take: 100,
    });

    return res.json({
      success: true,
      items: trips,
    });
  } catch (e) {
    console.error("[Trip] listMyCustomerTrips error:", e);
    return res.status(500).json({
      success: false,
      message: "Failed to list customer trips",
    });
  }
}

/**
 * GET /api/trips/:id
 * -> Rider xem chi tiết chuyến đi
 */
export async function getTripById(req, res) {
  try {
    const { id } = req.params;
    const trip = await prisma.trip.findUnique({ where: { id } });

    if (!trip) return res.status(404).json({ error: "Trip not found" });
    return res.json({ success: true, data: trip });
  } catch (err) {
    console.error("[Trip] getTripById error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ======================================================
// 🚗 DRIVER ACTIONS
// ======================================================

/**
 * GET /api/trips/driver/available
 * -> Driver xem danh sách các chuyến đang chờ nhận
 */
export async function listAvailableTrips(req, res) {
  try {
    const config = await getDriverConfigSnapshot();
    const now = new Date();

    const trips = await prisma.trip.findMany({
      where: {
        status: "PENDING",
        isVerified: true,
        verifiedAt: { not: null },
        driverId: null,
        cancelledAt: null,
      },
      orderBy: { verifiedAt: "desc" },
      take: 50,
      include: {
        stops: {
          orderBy: { seq: "asc" },
          select: {
            id: true,
            seq: true,
            address: true,
          },
        },
      },
    });

    const data = trips.map((t) => {
      const openAt = t.driverAcceptOpenAt
        ? new Date(t.driverAcceptOpenAt)
        : new Date(
            new Date(t.verifiedAt).getTime() +
              config.newTripAcceptDelaySeconds * 1000,
          );

      const locked = now < openAt;

      const finance = calculateDriverFinanceSnapshot({
        totalPrice: t.totalPrice,
        commissionPercent: config.commissionPercent,
        driverVatPercent: config.driverVatPercent,
        driverPitPercent: config.driverPitPercent,
        driverVatBaseMode: config.driverVatBaseMode,
        driverPitBaseMode: config.driverPitBaseMode,
      });

      return serializeDriverTrip(
        {
          id: t.id,
          pickupAddress: t.pickupAddress,
          dropoffAddress: t.dropoffAddress,
          stops: t.stops || [],
          distanceKm: Number(t.distanceKm || 0),
          pickupTime: t.pickupTime,
          returnTime: t.returnTime || null,
          totalPrice: t.totalPrice,
          carType: t.carType,
          direction: t.direction,
          note: t.note || null,
          status: t.status,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          driverAcceptOpenAt: openAt,

          commissionAmount:
            t.commissionAmountSnapshot ?? finance.commissionAmount,
          driverVatAmount: t.driverVatAmountSnapshot ?? finance.driverVatAmount,
          driverPitAmount: t.driverPitAmountSnapshot ?? finance.driverPitAmount,
          driverTaxTotal: t.driverTaxTotalSnapshot ?? finance.driverTaxTotal,
          requiredWalletAmount:
            t.requiredWalletAmountSnapshot ?? finance.requiredWalletAmount,
          driverReceive: t.driverReceiveSnapshot ?? finance.driverReceiveAmount,

          locked,
          unlockAt: openAt,
        },
        "available",
      );
    });

    return res.json({
      success: true,
      items: data,
    });
  } catch (err) {
    console.error("listAvailableTrips error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách chuyến",
    });
  }
}

/**
 * POST /api/trips/driver/accept
 * Body: { tripId }
 * -> Driver nhận chuyến
 * -> Driver huỷ chuyến
 */
export async function acceptTrip(req, res) {
  try {
    const tripId = String(req.body?.tripId || "").trim();
    const driverId = req.user?.id || req.user?.uid || null;

    console.log("[acceptTrip] body =", req.body);
    console.log("[acceptTrip] tripId =", tripId);
    console.log("[acceptTrip] req.user =", req.user);
    console.log("[acceptTrip] driverId =", driverId);

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã chuyến",
      });
    }

    if (!driverId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const config = await getDriverConfigSnapshot();

    const result = await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
      });

      if (!trip) {
        throw new Error("Không tìm thấy chuyến");
      }

      if (trip.status !== "PENDING") {
        throw new Error("Chuyến không ở trạng thái có thể nhận");
      }

      if (!trip.isVerified || !trip.verifiedAt) {
        throw new Error("Chuyến chưa được admin duyệt");
      }

      if (trip.cancelledAt) {
        throw new Error("Chuyến đã bị huỷ");
      }

      if (trip.driverId) {
        throw new Error("Chuyến đã có tài xế nhận");
      }

      if (trip.driverAcceptOpenAt) {
        const now = new Date();
        const openAt = new Date(trip.driverAcceptOpenAt);

        if (now < openAt) {
          throw new Error("Chưa tới thời gian cho phép nhận chuyến");
        }
      }

      const activeTripCount = await countDriverActiveTrips(driverId, tx);
      if (activeTripCount >= config.maxActiveTrips) {
        throw new Error(
          `Bạn đã đạt giới hạn ${config.maxActiveTrips} chuyến đang hoạt động`,
        );
      }

      const finance = calculateDriverFinanceSnapshot({
        totalPrice: trip.totalPrice,
        commissionPercent: config.commissionPercent,
        driverVatPercent: config.driverVatPercent,
        driverPitPercent: config.driverPitPercent,
        driverVatBaseMode: config.driverVatBaseMode,
        driverPitBaseMode: config.driverPitBaseMode,
      });

      const driverProfile = await tx.driverProfile.findUnique({
        where: { userId: driverId },
        select: {
          id: true,
          userId: true,
          status: true,
          balance: true,
        },
      });

      if (!driverProfile) {
        throw new Error("Không tìm thấy hồ sơ tài xế");
      }

      if (driverProfile.status !== "VERIFIED") {
        throw new Error("Tài xế chưa được duyệt");
      }

      if (driverProfile.balance < finance.requiredWalletAmount) {
        const currentBalance = Number(driverProfile.balance || 0);
        const requiredWalletAmount = Number(finance.requiredWalletAmount || 0);
        const missingAmount = Math.max(
          0,
          requiredWalletAmount - currentBalance,
        );

        const err = new Error(
          `Số dư ví không đủ. Bạn cần tối thiểu ${requiredWalletAmount.toLocaleString(
            "vi-VN",
          )}đ để nhận chuyến này. Thiếu ${missingAmount.toLocaleString(
            "vi-VN",
          )}đ.`,
        );

        err.statusCode = 400;
        err.data = {
          currentBalance,
          requiredWalletAmount,
          missingAmount,
        };

        throw err;
      }

      const commissionAmount = Number(finance.commissionAmount || 0);
      const vatAmount = Number(finance.driverVatAmount || 0);
      const pitAmount = Number(finance.driverPitAmount || 0);
      const totalHoldAmount = commissionAmount + vatAmount + pitAmount;

      if (totalHoldAmount !== Number(finance.requiredWalletAmount || 0)) {
        throw new Error("Snapshot tài chính không hợp lệ");
      }

      const balanceBefore = Number(driverProfile.balance || 0);
      const balanceAfterCommission = balanceBefore - commissionAmount;
      const balanceAfterVat = balanceAfterCommission - vatAmount;
      const balanceAfterPit = balanceAfterVat - pitAmount;

      await tx.driverProfile.update({
        where: { id: driverProfile.id },
        data: {
          balance: balanceAfterPit,
        },
      });

      if (commissionAmount > 0) {
        await tx.driverWalletTransaction.create({
          data: {
            driverProfileId: driverProfile.id,
            type: "COMMISSION_HOLD",
            amount: -commissionAmount,
            balanceBefore,
            balanceAfter: balanceAfterCommission,
            note: `Phí môi giới cho chuyến ${tripId}`,
            tripId,
          },
        });
      }

      if (vatAmount > 0) {
        await tx.driverWalletTransaction.create({
          data: {
            driverProfileId: driverProfile.id,
            type: "DRIVER_VAT_HOLD",
            amount: -vatAmount,
            balanceBefore: balanceAfterCommission,
            balanceAfter: balanceAfterVat,
            note: `VAT tài xế cho chuyến ${tripId}`,
            tripId,
          },
        });
      }

      if (pitAmount > 0) {
        await tx.driverWalletTransaction.create({
          data: {
            driverProfileId: driverProfile.id,
            type: "DRIVER_PIT_HOLD",
            amount: -pitAmount,
            balanceBefore: balanceAfterVat,
            balanceAfter: balanceAfterPit,
            note: `PIT tài xế cho chuyến ${tripId}`,
            tripId,
          },
        });
      }

      const acceptedAt = new Date();

      const updated = await tx.trip.update({
        where: { id: tripId },
        data: {
          status: "ACCEPTED",
          driverId,
          acceptedAt,

          commissionPercentSnapshot: finance.commissionPercent,
          commissionAmountSnapshot: finance.commissionAmount,

          driverVatPercentSnapshot: finance.driverVatPercent,
          driverVatBaseModeSnapshot: finance.driverVatBaseMode,
          driverVatAmountSnapshot: finance.driverVatAmount,

          driverPitPercentSnapshot: finance.driverPitPercent,
          driverPitBaseModeSnapshot: finance.driverPitBaseMode,
          driverPitAmountSnapshot: finance.driverPitAmount,

          driverTaxTotalSnapshot: finance.driverTaxTotal,
          requiredWalletAmountSnapshot: finance.requiredWalletAmount,
          driverReceiveSnapshot: finance.driverReceiveAmount,
        },
      });

      return {
        trip: updated,
        wallet: {
          balanceBefore,
          balanceAfter: balanceAfterPit,
          commissionAmount,
          driverVatAmount: vatAmount,
          driverPitAmount: pitAmount,
          requiredWalletAmount: totalHoldAmount,
          driverReceive: Number(finance.driverReceiveAmount || 0),
        },
        realtime: {
          tripId: updated.id,
          driverId,
          fromStatus: trip.status,
          toStatus: updated.status,
          updatedAt: updated.updatedAt || acceptedAt,
        },
      };
    });

    const io = req.app?.get?.("io");
    if (io) {
      io.to("admins").emit("admin:trip_accepted", {
        tripId: result.realtime.tripId,
        driverId: result.realtime.driverId,
        fromStatus: result.realtime.fromStatus,
        toStatus: result.realtime.toStatus,
        updatedAt: result.realtime.updatedAt,
      });

      emitAdminDashboardChanged(io, {
        source: "driver_accept_trip",
        tripId: result.realtime.tripId,
        driverId: result.realtime.driverId,
        fromStatus: result.realtime.fromStatus,
        toStatus: result.realtime.toStatus,
        status: result.realtime.toStatus,
        updatedAt: result.realtime.updatedAt,
      });

      emitTripChangedToDrivers(io, {
        tripId: result.realtime.tripId,
        driverId: result.realtime.driverId,
        previousDriverId: null,
        fromStatus: result.realtime.fromStatus,
        toStatus: result.realtime.toStatus,
        updatedAt: result.realtime.updatedAt,
        reason: "driver_accept_trip",
        refreshAvailable: true,
      });

      emitTripChangedToRider(io, {
        riderId: result.trip?.riderId || null,
        tripId: result.realtime.tripId,
        fromStatus: result.realtime.fromStatus,
        toStatus: result.realtime.toStatus,
        updatedAt: result.realtime.updatedAt,
        reason: "driver_accept_trip",
      });

      console.log(
        `[Socket] Emit admin:trip_accepted + admin:dashboard_changed + trip:changed (${result.realtime.tripId})`,
      );
    }

    try {
      await sendTripStatusChangedToRider(result.trip, {
        reason: "driver_accept_trip",
      });
    } catch (pushError) {
      console.error("[acceptTrip] push rider error:", pushError);
    }

    return res.json({
      success: true,
      trip: result.trip,
      wallet: result.wallet,
      message: "Nhận chuyến thành công",
    });
  } catch (err) {
    console.error("acceptTrip error:", err);
    return res.status(err.statusCode || 400).json({
      success: false,
      message: err.message || "Nhận chuyến thất bại",
      data: err.data || null,
    });
  }
}

export async function cancelDriverTrip(req, res) {
  try {
    const tripId = String(req.body?.tripId || "").trim();
    const driverUserId = req.user?.id || req.user?.uid || null;

    console.log("[cancelDriverTrip] body =", req.body);
    console.log("[cancelDriverTrip] tripId =", tripId);
    console.log("[cancelDriverTrip] req.user =", req.user);
    console.log("[cancelDriverTrip] driverUserId =", driverUserId);

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã chuyến",
      });
    }

    if (!driverUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const config = await getDriverConfigSnapshot();

    const result = await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        include: {
          driver: {
            include: {
              phones: {
                orderBy: { createdAt: "asc" },
                take: 1,
              },
            },
          },
        },
      });

      if (!trip) {
        throw new Error("Không tìm thấy chuyến");
      }

      if (!trip.driverId || trip.driverId !== driverUserId) {
        throw new Error("Bạn không phải tài xế đang giữ chuyến này");
      }

      if (!["ACCEPTED", "CONTACTED"].includes(trip.status)) {
        throw new Error(
          "Chỉ được huỷ chuyến khi đang ở trạng thái đã nhận hoặc đã liên hệ",
        );
      }

      const driverProfile = await tx.driverProfile.findUnique({
        where: { userId: driverUserId },
        select: {
          id: true,
          userId: true,
          balance: true,
          status: true,
        },
      });

      if (!driverProfile) {
        throw new Error("Không tìm thấy hồ sơ tài xế");
      }

      const commissionAmount = Number(trip.commissionAmountSnapshot || 0);
      const vatAmount = Number(trip.driverVatAmountSnapshot || 0);
      const pitAmount = Number(trip.driverPitAmountSnapshot || 0);

      const penaltyAmount =
        Number(trip.requiredWalletAmountSnapshot || 0) ||
        commissionAmount + vatAmount + pitAmount;

      const balanceAfterPenalty = Number(driverProfile.balance || 0);
      const balanceBeforePenalty = balanceAfterPenalty + penaltyAmount;

      const now = new Date();
      const reopenAt = new Date(
        now.getTime() + Number(config.newTripAcceptDelaySeconds || 0) * 1000,
      );

      if (penaltyAmount > 0) {
        await tx.driverTripPenaltyLog.create({
          data: {
            tripId: trip.id,
            driverId: driverUserId,
            driverProfileId: driverProfile.id,
            driverNameSnapshot: trip.driver?.displayName || null,
            driverPhoneSnapshot: trip.driver?.phones?.[0]?.e164 || null,
            tripStatusSnapshot: trip.status,
            verifiedByIdSnapshot: trip.verifiedById || null,
            verifiedAtSnapshot: trip.verifiedAt || null,
            penaltyAmount,
            status: "APPROVED",
            approvedAt: now,
            approvedByAdminId: null,
          },
        });

        await tx.driverWalletTransaction.create({
          data: {
            driverProfileId: driverProfile.id,
            type: "TRIP_CANCEL_PENALTY",
            amount: -penaltyAmount,
            balanceBefore: balanceBeforePenalty,
            balanceAfter: balanceAfterPenalty,
            note: `Phạt huỷ chuyến ${trip.id}`,
            tripId: trip.id,
          },
        });
      }

      const updatedTrip = await tx.trip.update({
        where: { id: trip.id },
        data: {
          status: "PENDING",
          driverId: null,
          acceptedAt: null,
          driverAcceptOpenAt: reopenAt,
          cancelledAt: null,
          cancelReason: null,

          commissionPercentSnapshot: null,
          commissionAmountSnapshot: null,

          driverVatPercentSnapshot: null,
          driverPitPercentSnapshot: null,
          driverVatBaseModeSnapshot: null,
          driverPitBaseModeSnapshot: null,
          driverVatAmountSnapshot: null,
          driverPitAmountSnapshot: null,
          driverTaxTotalSnapshot: null,
          requiredWalletAmountSnapshot: null,
          driverReceiveSnapshot: null,
        },
      });

      return {
        trip: updatedTrip,
        penalty: {
          amount: penaltyAmount,
          balanceBefore: balanceBeforePenalty,
          balanceAfter: balanceAfterPenalty,
          reopenAt,
        },
        realtime: {
          tripId: updatedTrip.id,
          driverId: null,
          previousDriverId: driverUserId,
          fromStatus: trip.status,
          toStatus: updatedTrip.status,
          updatedAt: updatedTrip.updatedAt || now,
          reason: "driver_cancel_trip",
        },
      };
    });

    const io = req.app?.get?.("io");
    if (io) {
      io.to("admins").emit("admin:trip_status_changed", {
        tripId: result.realtime.tripId,
        driverId: result.realtime.driverId,
        previousDriverId: result.realtime.previousDriverId,
        fromStatus: result.realtime.fromStatus,
        toStatus: result.realtime.toStatus,
        updatedAt: result.realtime.updatedAt,
        reason: result.realtime.reason,
      });

      emitAdminDashboardChanged(io, {
        source: "driver_cancel_trip",
        tripId: result.realtime.tripId,
        driverId: result.realtime.driverId,
        fromStatus: result.realtime.fromStatus,
        toStatus: result.realtime.toStatus,
        status: result.realtime.toStatus,
        updatedAt: result.realtime.updatedAt,
      });

      emitTripChangedToDrivers(io, {
        tripId: result.realtime.tripId,
        driverId: result.realtime.driverId,
        previousDriverId: result.realtime.previousDriverId,
        fromStatus: result.realtime.fromStatus,
        toStatus: result.realtime.toStatus,
        updatedAt: result.realtime.updatedAt,
        reason: result.realtime.reason,
        refreshAvailable: true,
      });

      emitTripChangedToRider(io, {
        riderId: result.trip?.riderId || null,
        tripId: result.realtime.tripId,
        fromStatus: result.realtime.fromStatus,
        toStatus: result.realtime.toStatus,
        updatedAt: result.realtime.updatedAt,
        reason: result.realtime.reason,
      });

      console.log(
        `[Socket] Emit admin:trip_status_changed + admin:dashboard_changed + trip:changed (${result.realtime.tripId})`,
      );
    }

    try {
      await sendTripStatusChangedToRider(result.trip, {
        reason: "driver_cancel_trip",
      });
    } catch (pushError) {
      console.error("[cancelDriverTrip] push rider error:", pushError);
    }

    return res.json({
      success: true,
      trip: result.trip,
      penalty: result.penalty,
      message: "Huỷ chuyến thành công",
    });
  } catch (err) {
    console.error("cancelDriverTrip error:", err);
    return res.status(400).json({
      success: false,
      message: err.message || "Huỷ chuyến thất bại",
    });
  }
}

/**
 * GET /api/trips/driver/my
 * -> Driver xem danh sách chuyến của mình
 *
 * Query:
 * - scope=active | history
 * - status=COMPLETED | CANCELLED
 */
export async function listMyTrips(req, res) {
  try {
    const driverId = req.user?.uid || req.user?.id;

    if (!driverId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const scopeRaw = String(req.query?.scope || "active")
      .trim()
      .toLowerCase();

    const statusRaw = String(req.query?.status || "")
      .trim()
      .toUpperCase();

    const scope = ["active", "history"].includes(scopeRaw)
      ? scopeRaw
      : "active";

    const where = {
      driverId,
    };

    if (scope === "active") {
      where.status = {
        in: ACTIVE_DRIVER_TRIP_STATUSES,
      };
    } else {
      const historyStatuses = ["COMPLETED", "CANCELLED"];

      where.status =
        statusRaw && historyStatuses.includes(statusRaw)
          ? statusRaw
          : { in: historyStatuses };
    }

    const trips = await prisma.trip.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        stops: {
          orderBy: { seq: "asc" },
          select: {
            id: true,
            seq: true,
            address: true,
          },
        },
      },
    });

    const items = trips.map((trip) => serializeDriverTrip(trip, scope));

    return res.json({ success: true, items });
  } catch (e) {
    console.error("[Trip] listMyTrips error:", e);
    return res.status(500).json({ message: "Failed to list my trips" });
  }
}

/**
 * GET /api/trips/driver/wallet
 * -> Driver xem số dư ví của mình
 */
export async function getDriverWallet(req, res) {
  try {
    const driverUserId = req.user?.uid || req.user?.id;

    if (!driverUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const profile = await prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
      select: {
        id: true,
        status: true,
        balance: true,
        updatedAt: true,
      },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ tài xế.",
      });
    }

    return res.json({
      success: true,
      item: {
        driverProfileId: profile.id,
        status: profile.status,
        balance: profile.balance,
        updatedAt: profile.updatedAt,
      },
    });
  } catch (e) {
    console.error("[DriverWallet] getDriverWallet error:", e);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy ví tài xế.",
    });
  }
}

/**
 * GET /api/trips/driver/wallet-transactions
 * -> Driver xem lịch sử biến động ví của mình
 */
export async function getMyDriverWalletTransactions(req, res) {
  try {
    const driverUserId = req.user?.uid || req.user?.id;

    if (!driverUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const limit = Math.min(
      200,
      Math.max(1, parseInt(req.query.limit || "50", 10)),
    );

    const profile = await prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
      select: { id: true },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ tài xế.",
      });
    }

    const items = await prisma.driverWalletTransaction.findMany({
      where: { driverProfileId: profile.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        trip: {
          select: {
            id: true,
            pickupAddress: true,
            dropoffAddress: true,
            totalPrice: true,
          },
        },
        withdrawRequest: {
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true,
            paidAt: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      items,
    });
  } catch (e) {
    console.error("[DriverWallet] getMyDriverWalletTransactions error:", e);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy lịch sử ví tài xế.",
    });
  }
}

/**
 * POST /api/trips/driver/withdraw
 * -> Driver gửi yêu cầu rút tiền
 */
export async function createWithdrawRequest(req, res) {
  try {
    const driverUserId = req.user?.uid || req.user?.id;
    const { amount } = req.body || {};

    if (!driverUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const withdrawAmount = Number(amount);

    if (
      !Number.isFinite(withdrawAmount) ||
      !Number.isInteger(withdrawAmount) ||
      withdrawAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Số tiền rút không hợp lệ.",
      });
    }

    const driverProfile = await prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
      select: {
        id: true,
        userId: true,
        status: true,
        balance: true,
      },
    });

    if (!driverProfile) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hồ sơ tài xế.",
      });
    }

    if (driverProfile.status !== "VERIFIED") {
      return res.status(403).json({
        success: false,
        message: "Tài khoản tài xế của bạn chưa đủ điều kiện rút tiền.",
      });
    }

    if (driverProfile.balance < withdrawAmount) {
      return res.status(400).json({
        success: false,
        message: "Số dư không đủ để rút.",
        data: {
          balance: driverProfile.balance,
          requested: withdrawAmount,
        },
      });
    }

    const request = await prisma.driverWithdrawRequest.create({
      data: {
        driverProfileId: driverProfile.id,
        amount: withdrawAmount,
        status: "PENDING",
      },
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true,
      },
    });

    const io = req.app?.get?.("io");
    if (io) {
      emitAdminDashboardChanged(io, {
        source: "withdraw_request_created",
        driverId: driverUserId,
        status: request.status,
        updatedAt: request.createdAt,
      });
    }

    return res.json({
      success: true,
      request,
      message: "Yêu cầu rút tiền đã được tạo.",
    });
  } catch (e) {
    console.error("[DriverWithdraw] createWithdrawRequest error:", e);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo yêu cầu rút tiền.",
    });
  }
}

/**
 * POST /api/trips/driver/change-status
 * Body: { tripId, newStatus }
 * -> Driver cập nhật trạng thái chuyến
 */
export async function changeTripStatus(req, res) {
  try {
    const { tripId, newStatus } = req.body;
    if (!tripId || !newStatus) {
      return res
        .status(400)
        .json({ message: "tripId & newStatus are required" });
    }

    const currentTrip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        status: true,
        driverId: true,
      },
    });

    if (!currentTrip) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy chuyến.",
      });
    }

    const trip = await updateTripStatus(tripId, newStatus);

    if (trip?.status === "PENDING" && !trip.driverId && !trip.cancelledAt) {
      const driverAcceptOpenAt = await buildDriverAcceptOpenAt();

      await prisma.trip.update({
        where: { id: tripId },
        data: {
          driverAcceptOpenAt,
        },
      });

      trip.driverAcceptOpenAt = driverAcceptOpenAt;
    }

    const io = req.app?.get?.("io");
    if (io && trip) {
      io.to("admins").emit("admin:trip_status_changed", {
        tripId: trip.id,
        fromStatus: currentTrip.status,
        toStatus: trip.status,
        driverId: trip.driverId || currentTrip.driverId || null,
        updatedAt: trip.updatedAt || null,
      });

      emitAdminDashboardChanged(io, {
        source: "driver_change_trip_status",
        tripId: trip.id,
        driverId: trip.driverId || currentTrip.driverId || null,
        fromStatus: currentTrip.status,
        toStatus: trip.status,
        status: trip.status,
        updatedAt: trip.updatedAt || null,
      });

      emitTripChangedToDrivers(io, {
        tripId: trip.id,
        fromStatus: currentTrip.status,
        toStatus: trip.status,
        driverId: trip.driverId || null,
        previousDriverId: currentTrip.driverId || null,
        updatedAt: trip.updatedAt || null,
        reason: "driver_change_status",
        refreshAvailable: true,
      });

      console.log(
        `[Socket] Emit admin:trip_status_changed -> admins (${tripId}) ${currentTrip.status} -> ${trip.status}`,
      );
    }

    try {
      await sendTripStatusChangedToRider(trip, {
        reason: "driver_change_status",
      });
    } catch (pushError) {
      console.error("[changeTripStatus] push rider error:", pushError);
    }

    res.json({ success: true, trip });
  } catch (e) {
    console.error("[Trip] changeTripStatus error:", e);
    res.status(400).json({ message: e.message });
  }
}

// ==============================
// Admin: Lấy danh sách AlertLog
// ==============================
export async function adminGetAlerts(req, res) {
  try {
    const alerts = await prisma.adminAlertLog.findMany({
      orderBy: { sentAt: "desc" },
      take: 200,
      include: {
        trip: {
          select: {
            id: true,
            riderName: true,
            riderPhone: true,
            pickupAddress: true,
            dropoffAddress: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    const data = alerts.map((a) => ({
      alertId: a.id,
      tripId: a.tripId,
      level: a.level,
      message: a.message,
      sentTo: a.sentTo,
      sentAt: a.sentAt,
      success: a.success,
      trip: a.trip,
    }));

    return res.json(data);
  } catch (err) {
    console.error("[adminGetAlerts] Error:", err);
    return res.status(500).json({ error: "Failed to fetch alerts" });
  }
}

// =============================================
// Admin: Lấy danh sách trip đang PENDING (Chuyến Chưa Có Tài Xế)
// =============================================
export async function adminGetPendingTrips(req, res) {
  try {
    const now = new Date();

    const trips = await prisma.trip.findMany({
      where: {
        status: "PENDING",
        isVerified: true,
        driverId: null,
        cancelledAt: null,
      },
      orderBy: { createdAt: "asc" },
      include: {
        alertLogs: true,
        stops: { orderBy: { seq: "asc" } },
      },
    });

    const data = trips.map((t) => {
      const pendingMinutes = Math.floor(
        (now.getTime() - t.createdAt.getTime()) / 60000,
      );

      const hasL1 = t.alertLogs.some((log) => log.level === 1);
      const hasL2 = t.alertLogs.some((log) => log.level === 2);

      return {
        tripId: t.id,
        riderName: t.riderName,
        riderPhone: t.riderPhone,
        pickupAddress: t.pickupAddress,
        dropoffAddress: t.dropoffAddress,
        stops: t.stops,
        status: t.status,
        createdAt: t.createdAt,
        pendingMinutes,
        hasL1,
        hasL2,
      };
    });

    return res.json({ success: true, trips: data });
  } catch (err) {
    console.error("[adminGetPendingTrips] Error:", err);
    return res.status(500).json({ error: "Failed to fetch pending trips" });
  }
}

// =============================================
// Admin: Xem chi tiết 1 trip + alert history
// =============================================
export async function adminGetTripDetail(req, res) {
  try {
    const { id } = req.params;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        alertLogs: { orderBy: { sentAt: "asc" } },
        rider: { select: { id: true, displayName: true } },
        driver: {
          select: {
            id: true,
            displayName: true,
            phones: {
              select: { e164: true, isVerified: true, createdAt: true },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
            driverProfile: true,
          },
        },
        stops: { orderBy: { seq: "asc" } },
      },
    });

    if (!trip) {
      return res.status(404).json({ error: "Trip not found" });
    }

    return res.json(trip);
  } catch (err) {
    console.error("[adminGetTripDetail] Error:", err);
    return res.status(500).json({ error: "Failed to fetch trip detail" });
  }
}

// =============================================
// Admin: Lấy danh sách chuyến tài xế đã nhận theo trạng thái
// =============================================
export async function getAssignedTrips(req, res) {
  try {
    const { status } = req.query;

    const allowed = [
      "ACCEPTED",
      "CONTACTED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
    ];

    if (!allowed.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Trạng thái không hợp lệ" });
    }

    const where =
      status === "CANCELLED"
        ? { status: "CANCELLED", driverId: { not: null } }
        : { status };

    const trips = await prisma.trip.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        pickupAddress: true,
        dropoffAddress: true,
        updatedAt: true,
        cancelReason: true,
        cancelledAt: true,
        riderName: true,
        riderPhone: true,
        stops: {
          orderBy: { seq: "asc" },
          select: {
            id: true,
            seq: true,
            address: true,
          },
        },
        rider: {
          select: {
            id: true,
            displayName: true,
            phones: { select: { e164: true }, take: 1 },
          },
        },
        driver: {
          select: {
            id: true,
            displayName: true,
            phones: { select: { e164: true }, take: 1 },
          },
        },
      },
    });

    return res.json({ success: true, trips });
  } catch (error) {
    console.error("getAssignedTrips error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
}

// =============================================
// Admin/Staff: Đổi trạng thái trip + ghi action log
// POST /api/trips/admin/trips/:id/change-status
// Body: { toStatus, note? }
// =============================================
export async function adminChangeTripStatus(req, res) {
  try {
    const { id } = req.params;
    const { toStatus, note } = req.body;

    const actor = req.admin;

    if (!id) {
      return res.status(400).json({ success: false, message: "Thiếu trip id" });
    }

    if (!toStatus) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu toStatus" });
    }

    const allowed = ["CONTACTED", "IN_PROGRESS", "COMPLETED"];
    if (!allowed.includes(toStatus)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái đích không hợp lệ",
      });
    }

    if (!actor || !["ADMIN", "STAFF"].includes(actor.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Không có quyền" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({ where: { id } });

      if (!trip) {
        const err = new Error("Trip not found");
        err.statusCode = 404;
        throw err;
      }

      const fromStatus = trip.status;

      const ok =
        (fromStatus === "ACCEPTED" && toStatus === "CONTACTED") ||
        (fromStatus === "CONTACTED" && toStatus === "IN_PROGRESS") ||
        (fromStatus === "IN_PROGRESS" && toStatus === "COMPLETED");

      if (!ok) {
        const err = new Error(
          `Không cho phép chuyển ${fromStatus} → ${toStatus}`,
        );
        err.statusCode = 400;
        throw err;
      }

      const updated = await tx.trip.update({
        where: { id },
        data: { status: toStatus },
      });

      const log = await tx.adminTripActionLog.create({
        data: {
          tripId: id,
          fromStatus,
          toStatus,
          actorRole: actor.role,
          actorId: actor.id ?? null,
          actorUsername: actor.username || "unknown",
          note: note ? String(note).slice(0, 500) : null,
        },
      });

      let driverNotification = null;

      if (updated.driverId) {
        let title = "Cập nhật chuyến";
        let message = "Chuyến của bạn vừa được cập nhật trạng thái mới.";

        if (toStatus === "CONTACTED") {
          title = "📞 Chuyến đã chuyển sang Đã liên hệ khách";
          message =
            "Admin đã cập nhật chuyến của bạn sang trạng thái Đã liên hệ khách.";
        }

        if (toStatus === "IN_PROGRESS") {
          title = "🚘 Chuyến đã chuyển sang Đang trên hành trình";
          message =
            "Admin đã cập nhật chuyến của bạn sang trạng thái Đang trên hành trình.";
        }

        if (toStatus === "COMPLETED") {
          title = "✅ Chuyến đã hoàn thành";
          message =
            "Admin đã cập nhật chuyến của bạn sang trạng thái Hoàn thành.";
        }

        driverNotification = await tx.systemNotification.create({
          data: {
            audience: "DRIVER",
            targetType: "USER",
            targetUserId: updated.driverId,
            title,
            message,
            isActive: true,
            createdByAdminId: actor.id ?? null,
          },
        });
      }

      return { updated, log, fromStatus, driverNotification };
    });

    console.log(
      "[AdminChangeTripStatus] result:",
      JSON.stringify(
        {
          tripId: result.updated?.id || null,
          fromStatus: result.fromStatus || null,
          toStatus: result.updated?.status || null,
          driverId: result.updated?.driverId || null,
          riderId: result.updated?.riderId || null,
          updatedAt: result.updated?.updatedAt || null,
          driverNotificationId: result.driverNotification?.id || null,
        },
        null,
        2,
      ),
    );

    const io = req.app?.get?.("io");

    if (io) {
      console.log(
        "[AdminChangeTripStatus] emitting realtime:",
        JSON.stringify(
          {
            event: "trip_status_changed_bundle",
            tripId: result.updated?.id || null,
            fromStatus: result.fromStatus || null,
            toStatus: result.updated?.status || null,
            driverId: result.updated?.driverId || null,
            riderId: result.updated?.riderId || null,
            updatedAt: result.updated?.updatedAt || null,
          },
          null,
          2,
        ),
      );
      io.to("admins").emit("admin:trip_status_changed", {
        tripId: result.updated.id,
        fromStatus: result.fromStatus,
        toStatus: result.updated.status,
        driverId: result.updated.driverId || null,
        updatedAt: result.updated.updatedAt,
      });

      emitAdminDashboardChanged(io, {
        source: "admin_change_trip_status",
        tripId: result.updated.id,
        driverId: result.updated.driverId || null,
        fromStatus: result.fromStatus,
        toStatus: result.updated.status,
        status: result.updated.status,
        updatedAt: result.updated.updatedAt || null,
      });

      emitTripChangedToDrivers(io, {
        tripId: result.updated.id,
        fromStatus: result.fromStatus,
        toStatus: result.updated.status,
        driverId: result.updated.driverId || null,
        previousDriverId: result.updated.driverId || null,
        updatedAt: result.updated.updatedAt || null,
        reason: "admin_change_status",
        refreshAvailable: true,
      });

      emitTripChangedToRider(io, {
        riderId: result.updated?.riderId || null,
        tripId: result.updated.id,
        fromStatus: result.fromStatus,
        toStatus: result.updated.status,
        updatedAt: result.updated.updatedAt || null,
        reason: "admin_change_status",
      });

      if (result.driverNotification && result.updated.driverId) {
        io.to(`driver:${result.updated.driverId}`).emit(
          "driver:notification_changed",
          {
            source: "admin_change_trip_status",
            audience: "DRIVER",
            targetUserId: result.updated.driverId,
            notificationId: result.driverNotification.id,
            updatedAt:
              result.driverNotification.updatedAt ||
              result.driverNotification.createdAt,
          },
        );

        console.log(
          `[Socket] Emit driver:notification_changed -> driver:${result.updated.driverId} (${result.updated.id})`,
        );
      }

      console.log(
        `[Socket] Emit admin:trip_status_changed -> admins (${result.updated.id})`,
      );
    }

    try {
      await sendTripStatusChangedToRider(result.updated, {
        reason: "admin_change_status",
      });
    } catch (pushError) {
      console.error("[adminChangeTripStatus] push rider error:", pushError);
    }

    try {
      if (result.driverNotification && result.updated.driverId) {
        await sendSystemNotificationToDriver(
          result.updated.driverId,
          result.driverNotification,
        );
      }
    } catch (pushError) {
      console.error("[adminChangeTripStatus] push driver error:", pushError);
    }

    return res.json({
      success: true,
      trip: result.updated,
      actionLog: result.log,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    console.error("[adminChangeTripStatus] Error:", err);
    return res.status(status).json({
      success: false,
      message: err.message || "Lỗi server",
    });
  }
}

// GET /api/trips/admin/trips/unverified
export async function adminListUnverifiedTrips(req, res) {
  try {
    const items = await prisma.trip.findMany({
      where: {
        status: "PENDING",
        isVerified: false,
        cancelledAt: null,
      },
      orderBy: { createdAt: "asc" },
      take: 200,
      include: {
        stops: { orderBy: { seq: "asc" } },
      },
    });

    return res.json({ success: true, items });
  } catch (e) {
    console.error("[adminListUnverifiedTrips] error:", e);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
}

// POST /api/trips/admin/trips/:id/verify
export async function adminVerifyTrip(req, res) {
  try {
    const { id } = req.params;
    const { note } = req.body || {};
    const actor = req.admin;

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy chuyến" });
    }

    if (trip.status !== "PENDING") {
      return res
        .status(400)
        .json({ success: false, message: "Chỉ duyệt chuyến PENDING" });
    }
    if (trip.isVerified) {
      return res.status(200).json({
        success: true,
        trip,
        message: "Chuyến đã được duyệt trước đó",
      });
    }
    if (trip.cancelledAt) {
      return res
        .status(400)
        .json({ success: false, message: "Chuyến đã bị hủy" });
    }

    const driverAcceptOpenAt = await buildDriverAcceptOpenAt();

    const updated = await prisma.trip.update({
      where: { id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedById: actor.id,
        verifiedNote: note ? String(note).slice(0, 500) : null,
        driverAcceptOpenAt,
      },
    });

    const io = req.app.get("io");
    if (io) {
      io.to("drivers").emit("trip:new", {
        id: updated.id,
        pickupAddressMasked: maskAddress(updated.pickupAddress),
        dropoffAddressMasked: maskAddress(updated.dropoffAddress),
        pickupTime: updated.pickupTime,
        carType: updated.carType,
        direction: updated.direction,
        totalPrice: updated.totalPrice,
        distanceKm: updated.distanceKm,
        createdAt: updated.createdAt,
        driverAcceptOpenAt: updated.driverAcceptOpenAt || null,
      });

      emitAdminDashboardChanged(io, {
        source: "admin_verify_trip",
        tripId: updated.id,
        status: updated.status,
        updatedAt: updated.updatedAt || updated.verifiedAt || new Date(),
      });

      emitTripChangedToRider(io, {
        riderId: updated.riderId || null,
        tripId: updated.id,
        fromStatus: "PENDING",
        toStatus: updated.status,
        updatedAt: updated.updatedAt || updated.verifiedAt || new Date(),
        reason: "admin_verify_trip",
      });

      console.log(`[Socket] Emit trip:new -> drivers (${updated.id})`);
    }

    try {
      await sendNewTripToDrivers(updated);
    } catch (pushError) {
      console.error("[adminVerifyTrip] push driver error:", pushError);
    }

    try {
      await sendTripStatusChangedToRider(updated, {
        reason: "admin_verify_trip",
      });
    } catch (pushError) {
      console.error("[adminVerifyTrip] push rider error:", pushError);
    }

    return res.json({ success: true, trip: updated });
  } catch (e) {
    console.error("[adminVerifyTrip] error:", e);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
}
