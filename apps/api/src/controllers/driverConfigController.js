// Path: goviet247/apps/api/src/controllers/driverConfigController.js
import pkg from "@prisma/client";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const TAX_BASE_MODE = {
  GROSS_TRIP_AMOUNT: "GROSS_TRIP_AMOUNT",
  NET_AFTER_PLATFORM_COMMISSION: "NET_AFTER_PLATFORM_COMMISSION",
};

// Việt: Default config cho tab Tài xế
const DEFAULT_DRIVER_CONFIG = {
  commissionPercent: "10.00",
  driverVatPercent: "3.00",
  driverPitPercent: "1.50",
  driverVatBaseMode: TAX_BASE_MODE.GROSS_TRIP_AMOUNT,
  driverPitBaseMode: TAX_BASE_MODE.GROSS_TRIP_AMOUNT,
  driverDepositAmount: 500000,
  maxActiveTrips: 1,
  newTripAcceptDelaySeconds: 10,
};

// Việt: Parse phần trăm dạng decimal, cho phép nhập 1.5 / 1.50 / 3
function parsePercentValue(value, fieldLabel) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return {
      ok: false,
      message: `${fieldLabel} không hợp lệ.`,
    };
  }

  const num = Number(raw);

  if (!Number.isFinite(num) || num < 0 || num > 100) {
    return {
      ok: false,
      message: `${fieldLabel} phải nằm trong khoảng 0% đến 100%.`,
    };
  }

  return {
    ok: true,
    value: num.toFixed(2),
  };
}

// Việt: Parse số nguyên không âm
function parseNonNegativeInteger(value, fieldLabel) {
  const num = Number(value);

  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0) {
    return {
      ok: false,
      message: `${fieldLabel} không hợp lệ.`,
    };
  }

  return {
    ok: true,
    value: num,
  };
}

// Việt: Parse số nguyên dương
function parsePositiveInteger(value, fieldLabel) {
  const num = Number(value);

  if (!Number.isFinite(num) || !Number.isInteger(num) || num <= 0) {
    return {
      ok: false,
      message: `${fieldLabel} phải lớn hơn 0.`,
    };
  }

  return {
    ok: true,
    value: num,
  };
}

// Việt: Parse mode tính thuế
function parseTaxBaseMode(value, fieldLabel) {
  const raw = String(value ?? "").trim().toUpperCase();

  if (!raw) {
    return {
      ok: false,
      message: `${fieldLabel} không hợp lệ.`,
    };
  }

  const allowedValues = Object.values(TAX_BASE_MODE);

  if (!allowedValues.includes(raw)) {
    return {
      ok: false,
      message: `${fieldLabel} không hợp lệ.`,
    };
  }

  return {
    ok: true,
    value: raw,
  };
}

// Việt: Chuẩn hoá object trả về cho FE để FE nhận number dễ dùng hơn
function normalizeDriverConfig(config) {
  return {
    ...config,
    commissionPercent:
      config?.commissionPercent != null ? Number(config.commissionPercent) : null,
    driverVatPercent:
      config?.driverVatPercent != null ? Number(config.driverVatPercent) : null,
    driverPitPercent:
      config?.driverPitPercent != null ? Number(config.driverPitPercent) : null,
    driverVatBaseMode: config?.driverVatBaseMode || null,
    driverPitBaseMode: config?.driverPitBaseMode || null,
  };
}

// Việt: Lấy record config duy nhất, nếu chưa có thì tự tạo
async function getOrCreateDriverConfig() {
  let config = await prisma.driverConfig.findFirst({
    orderBy: { id: "asc" },
  });

  if (!config) {
    config = await prisma.driverConfig.create({
      data: DEFAULT_DRIVER_CONFIG,
    });
  }

  return config;
}

/**
 * ============================================================
 * ADMIN API
 * GET /api/admin/driver-config
 * Lấy cấu hình tài xế
 * ============================================================
 */
export async function getDriverConfig(req, res) {
  try {
    const config = await getOrCreateDriverConfig();

    return res.json({
      success: true,
      item: normalizeDriverConfig(config),
    });
  } catch (err) {
    console.error("getDriverConfig error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy cấu hình tài xế.",
    });
  }
}

/**
 * ============================================================
 * ADMIN API
 * PATCH /api/admin/driver-config
 * Cập nhật cấu hình tài xế
 * ============================================================
 */
export async function updateDriverConfig(req, res) {
  try {
    const body = req.body || {};
    const current = await getOrCreateDriverConfig();

    const updateData = {};

    if (body.commissionPercent != null) {
      const parsed = parsePercentValue(body.commissionPercent, "Hoa hồng hệ thống");

      if (!parsed.ok) {
        return res.status(400).json({
          success: false,
          message: parsed.message,
        });
      }

      updateData.commissionPercent = parsed.value;
    }

    if (body.driverVatPercent != null) {
      const parsed = parsePercentValue(body.driverVatPercent, "VAT tài xế");

      if (!parsed.ok) {
        return res.status(400).json({
          success: false,
          message: parsed.message,
        });
      }

      updateData.driverVatPercent = parsed.value;
    }

    if (body.driverPitPercent != null) {
      const parsed = parsePercentValue(body.driverPitPercent, "PIT tài xế");

      if (!parsed.ok) {
        return res.status(400).json({
          success: false,
          message: parsed.message,
        });
      }

      updateData.driverPitPercent = parsed.value;
    }

    if (body.driverVatBaseMode != null) {
      const parsed = parseTaxBaseMode(body.driverVatBaseMode, "Cách tính VAT tài xế");

      if (!parsed.ok) {
        return res.status(400).json({
          success: false,
          message: parsed.message,
        });
      }

      updateData.driverVatBaseMode = parsed.value;
    }

    if (body.driverPitBaseMode != null) {
      const parsed = parseTaxBaseMode(body.driverPitBaseMode, "Cách tính PIT tài xế");

      if (!parsed.ok) {
        return res.status(400).json({
          success: false,
          message: parsed.message,
        });
      }

      updateData.driverPitBaseMode = parsed.value;
    }

    if (body.driverDepositAmount != null) {
      const parsed = parseNonNegativeInteger(
        body.driverDepositAmount,
        "Tiền ký quỹ tài xế",
      );

      if (!parsed.ok) {
        return res.status(400).json({
          success: false,
          message: parsed.message,
        });
      }

      updateData.driverDepositAmount = parsed.value;
    }

    if (body.maxActiveTrips != null) {
      const parsed = parsePositiveInteger(
        body.maxActiveTrips,
        "Số chuyến hoạt động tối đa",
      );

      if (!parsed.ok) {
        return res.status(400).json({
          success: false,
          message: parsed.message,
        });
      }

      updateData.maxActiveTrips = parsed.value;
    }

    if (body.newTripAcceptDelaySeconds != null) {
      const parsed = parseNonNegativeInteger(
        body.newTripAcceptDelaySeconds,
        "Thời gian chờ mở nhận chuyến mới",
      );

      if (!parsed.ok) {
        return res.status(400).json({
          success: false,
          message: parsed.message,
        });
      }

      if (parsed.value > 300) {
        return res.status(400).json({
          success: false,
          message: "Thời gian chờ mở nhận chuyến mới không được vượt quá 300 giây.",
        });
      }

      updateData.newTripAcceptDelaySeconds = parsed.value;
    }

    const updated = await prisma.driverConfig.update({
      where: { id: current.id },
      data: updateData,
    });

    return res.json({
      success: true,
      message: "Cập nhật cấu hình tài xế thành công.",
      item: normalizeDriverConfig(updated),
    });
  } catch (err) {
    console.error("updateDriverConfig error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật cấu hình tài xế.",
    });
  }
}