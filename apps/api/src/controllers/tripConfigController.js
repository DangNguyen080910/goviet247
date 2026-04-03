// Path: goviet247/apps/api/src/controllers/tripConfigController.js
import pkg from "@prisma/client";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

// Việt: Default config cho tab Chuyến đi
const DEFAULT_TRIP_CONFIG = {
  maxStops: 10,
  minDistanceKm: 5,
  maxDistanceKm: 2000,
  quoteExpireSeconds: 120,
};

// Việt: Lấy record config duy nhất, nếu chưa có thì tự tạo
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

/**
 * ============================================================
 * ADMIN API
 * GET /api/admin/trip-config
 * Lấy cấu hình chuyến đi
 * ============================================================
 */
export async function getTripConfig(req, res) {
  try {
    const config = await getOrCreateTripConfig();

    return res.json({
      success: true,
      item: config,
    });
  } catch (err) {
    console.error("getTripConfig error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy cấu hình chuyến đi.",
    });
  }
}

/**
 * ============================================================
 * ADMIN API
 * PATCH /api/admin/trip-config
 * Cập nhật cấu hình chuyến đi
 * ============================================================
 */
export async function updateTripConfig(req, res) {
  try {
    const body = req.body || {};
    const current = await getOrCreateTripConfig();

    const updateData = {};

    const integerFields = [
      "maxStops",
      "minDistanceKm",
      "maxDistanceKm",
      "quoteExpireSeconds",
    ];

    for (const field of integerFields) {
      if (body[field] != null) {
        const value = Number(body[field]);

        if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
          return res.status(400).json({
            success: false,
            message: `${field} không hợp lệ.`,
          });
        }

        updateData[field] = value;
      }
    }

    const nextMaxStops = updateData.maxStops ?? current.maxStops;
    const nextMinDistanceKm = updateData.minDistanceKm ?? current.minDistanceKm;
    const nextMaxDistanceKm = updateData.maxDistanceKm ?? current.maxDistanceKm;
    const nextQuoteExpireSeconds =
      updateData.quoteExpireSeconds ?? current.quoteExpireSeconds;

    if (nextMaxStops < 0) {
      return res.status(400).json({
        success: false,
        message: "Số điểm dừng tối đa không hợp lệ.",
      });
    }

    if (nextMinDistanceKm < 0) {
      return res.status(400).json({
        success: false,
        message: "Quãng đường tối thiểu không hợp lệ.",
      });
    }

    if (nextMaxDistanceKm <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quãng đường tối đa phải lớn hơn 0.",
      });
    }

    if (nextMinDistanceKm > nextMaxDistanceKm) {
      return res.status(400).json({
        success: false,
        message: "Quãng đường tối thiểu không được lớn hơn quãng đường tối đa.",
      });
    }

    if (nextQuoteExpireSeconds <= 0) {
      return res.status(400).json({
        success: false,
        message: "Thời gian hiệu lực báo giá phải lớn hơn 0 giây.",
      });
    }

    const updated = await prisma.tripConfig.update({
      where: { id: current.id },
      data: updateData,
    });

    return res.json({
      success: true,
      message: "Cập nhật cấu hình chuyến đi thành công.",
      item: updated,
    });
  } catch (err) {
    console.error("updateTripConfig error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật cấu hình chuyến đi.",
    });
  }
}