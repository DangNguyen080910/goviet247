// Path: goviet247/apps/api/src/controllers/pricingController.js

import pkg from "@prisma/client";
import { quotePrice } from "../services/pricingService.js";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

/**
 * ============================================================
 * PUBLIC API
 * POST /api/pricing/quote
 * Khách dùng để tính giá trước khi đặt chuyến
 * ============================================================
 */
export async function quote(req, res) {
  try {
    const {
      carType,
      direction,
      pickupTime,
      returnTime,
      distanceKm,
      driveMinutes,
      outboundDriveMinutes,
    } = req.body || {};

    if (!carType) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu carType." });
    }
    if (!direction) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu direction." });
    }
    if (!pickupTime) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu pickupTime." });
    }
    if (distanceKm == null) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu distanceKm." });
    }

    const result = await quotePrice({
      carType,
      direction,
      pickupTime,
      returnTime,
      distanceKm,
      driveMinutes,
      outboundDriveMinutes,
    });

    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.message });
    }

    return res.json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (e) {
    console.error("pricing quote error:", e);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi server khi tính giá." });
  }
}

/**
 * ============================================================
 * ADMIN API
 * GET /api/admin/pricing-configs
 * Lấy toàn bộ config giá cước
 * ============================================================
 */
export async function listPricingConfigs(req, res) {
  try {
    const rows = await prisma.pricingConfig.findMany({
      orderBy: { carType: "asc" },
    });

    return res.json({
      success: true,
      items: rows,
    });
  } catch (err) {
    console.error("listPricingConfigs error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi server khi lấy pricing config." });
  }
}

/**
 * ============================================================
 * ADMIN API
 * PATCH /api/admin/pricing-configs/:carType
 * Partial update config theo loại xe
 * ============================================================
 */
export async function updatePricingConfig(req, res) {
  try {
    const { carType } = req.params;

    const allowedTypes = ["CAR_5", "CAR_7", "CAR_16"];
    if (!allowedTypes.includes(carType)) {
      return res.status(400).json({
        success: false,
        message: "carType không hợp lệ.",
      });
    }

    const body = req.body || {};

    const updateData = {};

    const numberFields = [
      "baseFare",
      "pricePerKm",
      "pricePerHour",
      "minFare",
      "overnightFee",
      "overnightTriggerKm",
      "overnightTriggerHours",
    ];

    for (const field of numberFields) {
      if (body[field] != null) {
        const v = Number(body[field]);
        if (!Number.isFinite(v) || v < 0) {
          return res.status(400).json({
            success: false,
            message: `${field} không hợp lệ.`,
          });
        }
        updateData[field] = Math.round(v);
      }
    }

    if (body.isActive != null) {
      updateData.isActive = Boolean(body.isActive);
    }

    const existing = await prisma.pricingConfig.findUnique({
      where: { carType },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy cấu hình cho loại xe này.",
      });
    }

    const updated = await prisma.pricingConfig.update({
      where: { carType },
      data: updateData,
    });

    return res.json({
      success: true,
      message: "Cập nhật pricing config thành công.",
      item: updated,
    });
  } catch (err) {
    console.error("updatePricingConfig error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật pricing config.",
    });
  }
}
