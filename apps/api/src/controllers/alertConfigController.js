// Path: goviet247/apps/api/src/controllers/alertConfigController.js
import pkg from "@prisma/client";
import { applyPendingWatcherEnabledChange } from "../services/pendingWatcher.js";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

// Việt: Default config cho tab Cảnh báo
const DEFAULT_ALERT_CONFIG = {
  pendingWatcherEnabled: true,

  // Cảnh báo chuyến chờ duyệt
  pendingTripEnabled: true,
  pendingTripStartMinutes: 1,
  pendingTripRepeatMinutes: 5,
  pendingTripPhones: "",

  // Cảnh báo chuyến đã duyệt nhưng chưa có tài xế
  unassignedTripEnabled: true,
  unassignedTripStartMinutes: 15,
  unassignedTripRepeatMinutes: 15,
  unassignedTripPhones: "",
};

// Việt: Parse chuỗi phone CSV -> mảng đã trim + loại trùng
function parsePhoneCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index);
}

// Việt: Normalize phone list về CSV sạch
function normalizePhoneCsv(value) {
  return parsePhoneCsv(value).join(",");
}

// Việt: Lấy record config duy nhất, nếu chưa có thì tự tạo
async function getOrCreateAlertConfig() {
  let config = await prisma.alertConfig.findFirst({
    orderBy: { id: "asc" },
  });

  if (!config) {
    config = await prisma.alertConfig.create({
      data: DEFAULT_ALERT_CONFIG,
    });
  }

  return config;
}

/**
 * ============================================================
 * ADMIN API
 * GET /api/admin/alert-config
 * Lấy cấu hình cảnh báo
 * ============================================================
 */
export async function getAlertConfig(req, res) {
  try {
    const config = await getOrCreateAlertConfig();

    return res.json({
      success: true,
      item: config,
    });
  } catch (err) {
    console.error("getAlertConfig error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy cấu hình cảnh báo.",
    });
  }
}

/**
 * ============================================================
 * ADMIN API
 * PATCH /api/admin/alert-config
 * Cập nhật cấu hình cảnh báo
 * ============================================================
 */
export async function updateAlertConfig(req, res) {
  try {
    const body = req.body || {};
    const current = await getOrCreateAlertConfig();

    const updateData = {};

    const booleanFields = [
      "pendingWatcherEnabled",
      "pendingTripEnabled",
      "unassignedTripEnabled",
    ];

    for (const field of booleanFields) {
      if (body[field] != null) {
        updateData[field] = Boolean(body[field]);
      }
    }

    const integerFields = [
      "pendingTripStartMinutes",
      "pendingTripRepeatMinutes",
      "unassignedTripStartMinutes",
      "unassignedTripRepeatMinutes",
    ];

    for (const field of integerFields) {
      if (body[field] != null) {
        const value = Number(body[field]);

        if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
          return res.status(400).json({
            success: false,
            message: `${field} không hợp lệ.`,
          });
        }

        updateData[field] = value;
      }
    }

    const phoneFields = ["pendingTripPhones", "unassignedTripPhones"];

    for (const field of phoneFields) {
      if (body[field] != null) {
        updateData[field] = normalizePhoneCsv(body[field]);
      }
    }

    const nextPendingTripEnabled =
      updateData.pendingTripEnabled ?? current.pendingTripEnabled;

    const nextPendingTripStartMinutes =
      updateData.pendingTripStartMinutes ?? current.pendingTripStartMinutes;

    const nextPendingTripRepeatMinutes =
      updateData.pendingTripRepeatMinutes ?? current.pendingTripRepeatMinutes;

    const nextPendingTripPhones = parsePhoneCsv(
      updateData.pendingTripPhones ?? current.pendingTripPhones,
    );

    const nextUnassignedTripEnabled =
      updateData.unassignedTripEnabled ?? current.unassignedTripEnabled;

    const nextUnassignedTripStartMinutes =
      updateData.unassignedTripStartMinutes ??
      current.unassignedTripStartMinutes;

    const nextUnassignedTripRepeatMinutes =
      updateData.unassignedTripRepeatMinutes ??
      current.unassignedTripRepeatMinutes;

    const nextUnassignedTripPhones = parsePhoneCsv(
      updateData.unassignedTripPhones ?? current.unassignedTripPhones,
    );

    if (nextPendingTripStartMinutes < 0) {
      return res.status(400).json({
        success: false,
        message: "Thời gian bắt đầu cảnh báo Chuyến (Chờ Duyệt) không hợp lệ.",
      });
    }

    if (nextPendingTripRepeatMinutes <= 0) {
      return res.status(400).json({
        success: false,
        message:
          "Chu kỳ lặp lại cảnh báo Chuyến (Chờ Duyệt) phải lớn hơn 0 phút.",
      });
    }

    if (nextPendingTripEnabled && nextPendingTripPhones.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Vui lòng nhập ít nhất 1 số điện thoại cho cảnh báo Chuyến (Chờ Duyệt).",
      });
    }

    if (nextUnassignedTripStartMinutes < 0) {
      return res.status(400).json({
        success: false,
        message:
          "Thời gian bắt đầu cảnh báo Chuyến Chưa Có Tài Xế không hợp lệ.",
      });
    }

    if (nextUnassignedTripRepeatMinutes <= 0) {
      return res.status(400).json({
        success: false,
        message:
          "Chu kỳ lặp lại cảnh báo Chuyến Chưa Có Tài Xế phải lớn hơn 0 phút.",
      });
    }

    if (nextUnassignedTripEnabled && nextUnassignedTripPhones.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Vui lòng nhập ít nhất 1 số điện thoại cho cảnh báo Chuyến Chưa Có Tài Xế.",
      });
    }

    const updated = await prisma.alertConfig.update({
      where: { id: current.id },
      data: updateData,
    });

    await applyPendingWatcherEnabledChange({
      enabled: Boolean(updated.pendingWatcherEnabled),
      prisma,
    });

    return res.json({
      success: true,
      item: updated,
      message: "Đã cập nhật cấu hình cảnh báo thành công.",
    });
  } catch (err) {
    console.error("updateAlertConfig error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật cấu hình cảnh báo.",
    });
  }
}