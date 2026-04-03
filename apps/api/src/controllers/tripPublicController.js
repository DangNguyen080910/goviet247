// Path: goviet247/apps/api/src/controllers/tripPublicController.js
import { prisma } from "../utils/db.js";
import { calculateTripPrice } from "../services/pricingService.js";
import {
  requestTripOtp as requestTripOtpService,
  verifyTripOtp,
} from "../services/otpService.js";

// Việt: Default config public cho customer page
const DEFAULT_TRIP_CONFIG = {
  maxStops: 10,
  minDistanceKm: 5,
  maxDistanceKm: 2000,
  quoteExpireSeconds: 120,
};

const DEFAULT_SYSTEM_CONFIG = {
  supportPhone: "0900000000",
  supportEmail: "support@goviet247.com",
  timezone: "Asia/Ho_Chi_Minh",
};

// Việt: Map enum loại xe -> label hiển thị ngoài customer page
function getCarTypeLabel(carType) {
  switch (carType) {
    case "CAR_5":
      return "Xe 5 chỗ";
    case "CAR_7":
      return "Xe 7 chỗ";
    case "CAR_16":
      return "Xe 16 chỗ";
    default:
      return carType;
  }
}

// Việt: Hàm parse ISO date từ client
function toDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid date");
  }
  return d;
}

// Việt: Lấy hoặc tự tạo TripConfig mặc định
async function getOrCreateTripConfig() {
  let config = await prisma.tripConfig.findFirst({
    orderBy: { id: "asc" },
  });

  if (!config) {
    config = await prisma.tripConfig.create({
      data: DEFAULT_TRIP_CONFIG,
    });
  }

  return config;
}

// Việt: Lấy hoặc tự tạo SystemConfig mặc định
async function getOrCreateSystemConfig() {
  let config = await prisma.systemConfig.findFirst({
    orderBy: { id: "asc" },
  });

  if (!config) {
    config = await prisma.systemConfig.create({
      data: DEFAULT_SYSTEM_CONFIG,
    });
  }

  return config;
}

/**
 * ============================================================
 * PUBLIC API
 * GET /api/public/trips/config
 * Lấy config public cho customer page
 * ============================================================
 */
export async function getPublicTripConfig(req, res) {
  try {
    const [tripConfig, systemConfig, pricingConfigs] = await Promise.all([
      getOrCreateTripConfig(),
      getOrCreateSystemConfig(),
      prisma.pricingConfig.findMany({
        where: { isActive: true },
        orderBy: { id: "asc" },
        select: {
          carType: true,
        },
      }),
    ]);

    const fallbackCarTypes = ["CAR_5", "CAR_7", "CAR_16"];

    const activeCarTypes =
      pricingConfigs.length > 0
        ? pricingConfigs.map((item) => item.carType)
        : fallbackCarTypes;

    const carTypes = activeCarTypes.map((carType) => ({
      value: carType,
      label: getCarTypeLabel(carType),
    }));

    return res.json({
      success: true,
      data: {
        tripConfig: {
          maxStops: tripConfig.maxStops,
          minDistanceKm: tripConfig.minDistanceKm,
          maxDistanceKm: tripConfig.maxDistanceKm,
          quoteExpireSeconds: tripConfig.quoteExpireSeconds,
        },
        systemConfig: {
          supportPhone: systemConfig.supportPhone,
          supportEmail: systemConfig.supportEmail,
          timezone: systemConfig.timezone,
        },
        carTypes,
      },
    });
  } catch (err) {
    console.error("getPublicTripConfig error:", err);
    return res.status(500).json({
      success: false,
      message: "Lấy cấu hình public thất bại.",
    });
  }
}

// POST /api/public/trips/quote
export async function quoteTrip(req, res) {
  try {
    const {
      pickupAddress,
      dropoffAddress,
      pickupTime,
      returnTime, // optional (ROUND_TRIP)
      driveMinutes, // optional/required tùy trường hợp
      carType, // "CAR_5" | "CAR_7" | "CAR_16"
      direction, // "ONE_WAY" | "ROUND_TRIP"
      distanceKm, // number
    } = req.body;

    if (
      !pickupAddress ||
      !dropoffAddress ||
      !pickupTime ||
      !carType ||
      !direction ||
      distanceKm == null
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu dữ liệu bắt buộc." });
    }

    const pickupDate = toDate(pickupTime);
    const returnDate = returnTime ? toDate(returnTime) : undefined;

    const pricing = await calculateTripPrice({
      carType,
      direction,
      distanceKm: Number(distanceKm),
      pickupTime: pickupDate,
      returnTime: returnDate,
      driveMinutes: driveMinutes == null ? undefined : Number(driveMinutes),
    });

    return res.json({
      success: true,
      currency: "VND",
      pickupAddress,
      dropoffAddress,
      pickupTime,
      returnTime,
      carType,
      direction,
      ...pricing,
    });
  } catch (err) {
    console.error("quoteTrip error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Tính giá thất bại." });
  }
}

// POST /api/public/trips/request-otp
export async function requestTripOtp(req, res) {
  try {
    const {
      riderName,
      riderPhone,
      pickupAddress,
      dropoffAddress,
      pickupTime,
      returnTime, // optional
      driveMinutes, // optional/required tùy trường hợp
      carType,
      direction,
      distanceKm,
      note,
    } = req.body;

    if (
      !riderName ||
      !riderPhone ||
      !pickupAddress ||
      !dropoffAddress ||
      !pickupTime ||
      !carType ||
      !direction ||
      distanceKm == null
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu dữ liệu bắt buộc." });
    }

    const pickupDate = toDate(pickupTime);
    const returnDate = returnTime ? toDate(returnTime) : undefined;

    const pricing = await calculateTripPrice({
      carType,
      direction,
      distanceKm: Number(distanceKm),
      pickupTime: pickupDate,
      returnTime: returnDate,
      driveMinutes: driveMinutes == null ? undefined : Number(driveMinutes),
    });

    // Payload lưu tạm trong OTP session (không tạo Trip ngay)
    const tripDraft = {
      riderName,
      riderPhone,
      pickupAddress,
      dropoffAddress,
      pickupTime,
      returnTime: returnTime || null,
      driveMinutes: driveMinutes == null ? null : Number(driveMinutes),
      carType,
      direction,
      distanceKm: Number(distanceKm),
      note: note || "",
      ...pricing,
    };

    const { sessionId, resendAfter } = await requestTripOtpService(
      riderPhone,
      tripDraft
    );

    return res.json({
      success: true,
      message: "Đã gửi OTP về số điện thoại.",
      sessionId,
      resendAfter,
      quote: {
        currency: "VND",
        totalPrice: pricing.totalPrice,
        distanceKm: pricing.distanceKm,
      },
    });
  } catch (err) {
    console.error("requestTripOtp error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Gửi OTP thất bại." });
  }
}

// POST /api/public/trips/confirm
export async function confirmTrip(req, res) {
  try {
    const { sessionId, otpCode } = req.body;
    if (!sessionId || !otpCode) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu sessionId hoặc otpCode." });
    }

    const { valid, payload } = await verifyTripOtp(sessionId, otpCode);

    if (!valid || !payload) {
      return res
        .status(400)
        .json({ success: false, message: "OTP không hợp lệ hoặc đã hết hạn." });
    }

    const {
      riderName,
      riderPhone,
      pickupAddress,
      dropoffAddress,
      pickupTime,
      carType,
      direction,
      distanceKm,
      note,
      basePricePerKm,
      holidayFactor,
      directionFactor,
      totalPrice,
    } = payload;

    const trip = await prisma.trip.create({
      data: {
        riderName,
        riderPhone,
        pickupAddress,
        dropoffAddress,
        pickupTime: new Date(pickupTime),
        carType,
        direction,
        distanceKm: Number(distanceKm),
        note: note || "",
        basePricePerKm: Number(basePricePerKm),
        holidayFactor: Number(holidayFactor || 1),
        directionFactor: Number(directionFactor || 1),
        totalPrice: Number(totalPrice),
        status: "PENDING",
      },
    });

    // ✅ Emit realtime cho admin
    const io = req.app.get("io");
    if (io) {
      io.to("admins").emit("admin:new_trip", {
        tripId: trip.id,
        status: trip.status,
        createdAt: trip.createdAt,
      });
      console.log("[Socket] emitted admin:new_trip:", trip.id);
    } else {
      console.log("[Socket] io not found on app (skip emit)");
    }

    return res.json({
      success: true,
      message: "Tạo chuyến thành công.",
      tripId: trip.id,
      totalPrice: trip.totalPrice,
    });
  } catch (err) {
    console.error("confirmTrip error:", err);
    return res.status(400).json({
      success: false,
      message: err.message || "Xác nhận chuyến thất bại.",
    });
  }
}