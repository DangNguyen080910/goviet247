// Path: goviet247/apps/api/src/controllers/pricingController.js

import pkg from "@prisma/client";
import { validateHolidayConfig, validateHolidayPeriods } from "../services/holidaySurcharge.js";
import { quotePrice } from "../services/pricingService.js";
import { validateTripDistance } from "../services/tripConfigService.js";
import { validateWaitingRules } from "../services/waitingPricing.js";
import { recordQuoteHistory } from "../services/quoteHistoryService.js";

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
      fuelPreference = "ANY",
    } = req.body || {};

    const allowedFuelPreferences = ["ANY", "ELECTRIC", "GASOLINE"];
    if (!allowedFuelPreferences.includes(fuelPreference)) {
      return res.status(400).json({
        success: false,
        message: "Loại nhiên liệu không hợp lệ.",
      });
    }

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

    const distanceValidation = await validateTripDistance(distanceKm);
    if (!distanceValidation.ok) {
      return res.status(400).json({
        success: false,
        message: distanceValidation.message,
      });
    }

    const result = await quotePrice({
      destinationServiceDates: req.body.destinationServiceDates,
      destinationAnchorAddress: req.body.destinationAnchorAddress,
      carType,
      direction,
      pickupTime,
      returnTime,
      distanceKm,
      driveMinutes,
      outboundDriveMinutes,
      fuelPreference,
    });

    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.message });
    }

    const history = await recordQuoteHistory(req, result.data);
    return res.json({
      success: true,
      message: result.message,
      data: { ...result.data, ...(history || {}) },
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

    if (Object.prototype.hasOwnProperty.call(body, "holidayPeriods")) {
      const error = validateHolidayPeriods(body.holidayPeriods);
      if (error) return res.status(400).json({ success: false, message: error });
      const periods = body.holidayPeriods.map(p => ({ id: p.id, enabled: p.enabled,
        holidaySurchargePercent: Number(p.holidaySurchargePercent), holidayStartDate: p.holidayStartDate,
        holidayEndDate: p.holidayEndDate, holidayName: (p.holidayName || "").trim(), holidayNote: (p.holidayNote || "").trim() }));
      try {
        const item = await prisma.pricingConfig.update({ where: { carType }, data: { holidayPeriods: periods } });
        return res.json({ success: true, item });
      } catch (error) {
        if (error.code === "P2025") return res.status(404).json({ success: false, message: "Không tìm thấy loại xe." });
        throw error;
      }
    }
    const updateData = {};
    if (Object.prototype.hasOwnProperty.call(body, "roundTripWaitingConfig")) {
      const error = validateWaitingRules(body.roundTripWaitingConfig);
      if (error) return res.status(400).json({ success: false, message: error });
      const { freeWaitingMinutes, nightStartHour, nightEndHour, nightMinWaitHours } = body.roundTripWaitingConfig;
      updateData.roundTripWaitingConfig = { freeWaitingMinutes, nightStartHour, nightEndHour, nightMinWaitHours };
    }

    const numberFields = [
      "baseFare",
      "pricePerKm",
      "pricePerHour",
      "minFare",
      "overnightFee",
      "overnightTriggerKm",
      "overnightTriggerHours",
      "gasolineSurchargePercent",
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
        if (field === "gasolineSurchargePercent" && v > 100) {
          return res.status(400).json({
            success: false,
            message: "Phụ thu xe xăng không được vượt quá 100%.",
          });
        }
        updateData[field] =
          field === "gasolineSurchargePercent" ? v : Math.round(v);
      }
    }

    if (body.isActive != null) {
      if (typeof body.isActive !== "boolean") return res.status(400).json({ success: false, message: "Trạng thái nhận đặt phải là bật hoặc tắt." });
      updateData.isActive = body.isActive;
    }

    if (body.kmTiers != null) {
      if (!Array.isArray(body.kmTiers)) {
        return res.status(400).json({
          success: false,
          message: "kmTiers phải là một mảng.",
        });
      }
      for (const [index, tier] of body.kmTiers.entries()) {
        const value = tier?.pricePerWaitHour;
        if (value != null && (value === "" || !["number", "string"].includes(typeof value) || !Number.isFinite(Number(value)) || Number(value) < 0 || !Number.isInteger(Number(value)))) {
          return res.status(400).json({ success: false, message: `Bậc km #${index + 1}: Giá chờ/giờ phải là số nguyên không âm hoặc để trống.` });
        }
      }

      const normalizedKmTiers = body.kmTiers.map((item, index) => {
        const from = Number(item?.from);
        const to =
          item?.to == null || item?.to === "" ? null : Number(item?.to);
        const pricePerKm = Number(item?.pricePerKm);

        if (!Number.isFinite(from) || from < 0) {
          throw new Error(`Bậc km #${index + 1}: from không hợp lệ.`);
        }

        if (to !== null && (!Number.isFinite(to) || to <= from)) {
          throw new Error(`Bậc km #${index + 1}: to phải lớn hơn from.`);
        }

        if (!Number.isFinite(pricePerKm) || pricePerKm < 0) {
          throw new Error(`Bậc km #${index + 1}: pricePerKm không hợp lệ.`);
        }

        return {
          from: Math.round(from),
          to: to == null ? null : Math.round(to),
          pricePerKm: Math.round(pricePerKm),
          ...(Object.prototype.hasOwnProperty.call(item, "pricePerWaitHour") ? {
            pricePerWaitHour: item.pricePerWaitHour == null ? null : Number(item.pricePerWaitHour),
          } : {}),
        };
      });

      normalizedKmTiers.sort((a, b) => a.from - b.from);

      for (let i = 0; i < normalizedKmTiers.length; i++) {
        const current = normalizedKmTiers[i];
        const next = normalizedKmTiers[i + 1];

        if (i === 0 && current.from !== 0) {
          return res.status(400).json({
            success: false,
            message: "Bậc km đầu tiên phải bắt đầu từ 0.",
          });
        }

        if (next && current.to == null) {
          return res.status(400).json({
            success: false,
            message: "Chỉ bậc km cuối cùng mới được để trống mốc đến.",
          });
        }

        if (next && current.to !== next.from) {
          return res.status(400).json({
            success: false,
            message:
              "Các bậc km phải nối tiếp nhau. Ví dụ: 0-50, 50-100, 100-200.",
          });
        }
      }

      updateData.kmTiers = normalizedKmTiers;
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
    // Keep hourly rates when an older admin client edits only kilometre prices.
    if (updateData.kmTiers) {
      updateData.kmTiers = updateData.kmTiers.map(tier => {
        if (Object.prototype.hasOwnProperty.call(tier, "pricePerWaitHour")) return tier;
        const previous = (Array.isArray(existing.kmTiers) ? existing.kmTiers : []).find(old =>
          Number(old.from) === tier.from && (old.to == null ? null : Number(old.to)) === tier.to);
        return { ...tier, pricePerWaitHour: previous?.pricePerWaitHour ?? null };
      });
    }

    // Older admin clients must not silently replace the new multi-period schedule.
    if (Array.isArray(existing.holidayPeriods) && ["holidaySurchargePercent", "holidayStartDate", "holidayEndDate", "holidayName", "holidayNote"].some(field => Object.prototype.hasOwnProperty.call(body, field) && String(body[field] ?? "") !== String(existing[field] ?? ""))) {
      return res.status(409).json({ success: false, message: "Vui lòng tải lại trang và sửa phụ thu trong tab Phụ thu lễ, Tết." });
    }
    const holidayFields = ["holidaySurchargePercent", "holidayStartDate", "holidayEndDate", "holidayName", "holidayNote"];
    for (const field of holidayFields) {
      if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
      const value = body[field];
      if (field === "holidaySurchargePercent") {
        if (value === null || value === "" || !["number", "string"].includes(typeof value)) {
          return res.status(400).json({ success: false, message: "Phần trăm phụ thu lễ, Tết không hợp lệ." });
        }
        updateData[field] = Number(value);
      } else if (field === "holidayStartDate" || field === "holidayEndDate") {
        updateData[field] = value === "" || value === null ? null : value;
      } else {
        updateData[field] = typeof value === "string" ? value.trim() : value;
      }
    }
    const holidayError = validateHolidayConfig({ ...existing, ...updateData });
    if (holidayError) return res.status(400).json({ success: false, message: holidayError });
    // Prisma strings are non-null; preserve empty optional content consistently.
    for (const field of ["holidayName", "holidayNote"]) {
      if (updateData[field] === null) updateData[field] = "";
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
      message: err?.message || "Lỗi server khi cập nhật pricing config.",
    });
  }
}
