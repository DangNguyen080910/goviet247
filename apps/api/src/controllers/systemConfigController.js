// Path: goviet247/apps/api/src/controllers/systemConfigController.js
import pkg from "@prisma/client";
import { uploadToS3 } from "../services/s3Service.js";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

// Việt: Default config cho tab Hệ thống + Nạp ví tài xế
const DEFAULT_SYSTEM_CONFIG = {
  supportPhoneDriver: "0977100917",
  supportEmailDriver: "goviet247.com@gmail.com",
  supportPhoneRider: "0977100917",
  supportEmailRider: "goviet247.com@gmail.com",
  timezone: "Asia/Ho_Chi_Minh",

  driverTopupBankName: "",
  driverTopupAccountNumber: "",
  driverTopupAccountHolderName: "",
  driverTopupTransferPrefix: "NAPVI",
  driverTopupQrImageUrl: "",
  driverTopupNote: "",

  brandName: "GoViet247",
  brandLogoUrl: "",
  riderWebHeroImageUrl: "",
  riderMobileHeroImageUrl: "",
  driverMobileHeroImageUrl: "",
  defaultInAppSoundUrl: "",
  footerCopyright: "© 2023 GoViet247 - Công ty TNHH Công nghệ ViNa LightHouse",
};

// Việt: Regex email cơ bản
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Việt: Lấy record config duy nhất, nếu chưa có thì tự tạo
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
 * ADMIN API
 * GET /api/admin/system-config
 * Lấy cấu hình hệ thống
 * ============================================================
 */
export async function getSystemConfig(req, res) {
  try {
    const config = await getOrCreateSystemConfig();

    return res.json({
      success: true,
      item: config,
    });
  } catch (err) {
    console.error("getSystemConfig error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy cấu hình hệ thống.",
    });
  }
}

/**
 * ============================================================
 * ADMIN API
 * PATCH /api/admin/system-config
 * Cập nhật cấu hình hệ thống
 * ============================================================
 */
export async function updateSystemConfig(req, res) {
  try {
    const body = req.body || {};
    const current = await getOrCreateSystemConfig();

    const updateData = {};

    if (body.supportPhoneDriver != null) {
      const value = String(body.supportPhoneDriver).trim();

      if (!value) {
        return res.status(400).json({
          success: false,
          message: "Số điện thoại hỗ trợ driver không được để trống.",
        });
      }

      updateData.supportPhoneDriver = value;
    }

    if (body.supportEmailDriver != null) {
      const value = String(body.supportEmailDriver).trim();

      if (!value) {
        return res.status(400).json({
          success: false,
          message: "Email hỗ trợ driver không được để trống.",
        });
      }

      if (!EMAIL_REGEX.test(value)) {
        return res.status(400).json({
          success: false,
          message: "Email hỗ trợ driver không hợp lệ.",
        });
      }

      updateData.supportEmailDriver = value;
    }

    if (body.supportPhoneRider != null) {
      const value = String(body.supportPhoneRider).trim();

      if (!value) {
        return res.status(400).json({
          success: false,
          message: "Số điện thoại hỗ trợ khách hàng không được để trống.",
        });
      }

      updateData.supportPhoneRider = value;
    }

    if (body.supportEmailRider != null) {
      const value = String(body.supportEmailRider).trim();

      if (!value) {
        return res.status(400).json({
          success: false,
          message: "Email hỗ trợ khách hàng không được để trống.",
        });
      }

      if (!EMAIL_REGEX.test(value)) {
        return res.status(400).json({
          success: false,
          message: "Email hỗ trợ khách hàng không hợp lệ.",
        });
      }

      updateData.supportEmailRider = value;
    }

    if (body.timezone != null) {
      const value = String(body.timezone).trim();

      if (!value) {
        return res.status(400).json({
          success: false,
          message: "Timezone không được để trống.",
        });
      }

      updateData.timezone = value;
    }

    if (body.driverTopupBankName != null) {
      updateData.driverTopupBankName = String(body.driverTopupBankName).trim();
    }

    if (body.driverTopupAccountNumber != null) {
      updateData.driverTopupAccountNumber = String(
        body.driverTopupAccountNumber,
      ).trim();
    }

    if (body.driverTopupAccountHolderName != null) {
      updateData.driverTopupAccountHolderName = String(
        body.driverTopupAccountHolderName,
      ).trim();
    }

    if (body.driverTopupTransferPrefix != null) {
      const value = String(body.driverTopupTransferPrefix).trim();
      updateData.driverTopupTransferPrefix = value || "NAPVI";
    }

    if (body.driverTopupQrImageUrl != null) {
      updateData.driverTopupQrImageUrl = String(
        body.driverTopupQrImageUrl,
      ).trim();
    }

    if (body.driverTopupNote != null) {
      updateData.driverTopupNote = String(body.driverTopupNote).trim();
    }

    if (body.brandName != null) {
      const value = String(body.brandName).trim();
      updateData.brandName = value || "GoViet247";
    }

    if (body.brandLogoUrl != null) {
      updateData.brandLogoUrl = String(body.brandLogoUrl).trim();
    }

    if (body.riderWebHeroImageUrl != null) {
      updateData.riderWebHeroImageUrl = String(
        body.riderWebHeroImageUrl,
      ).trim();
    }

    if (body.riderMobileHeroImageUrl != null) {
      updateData.riderMobileHeroImageUrl = String(
        body.riderMobileHeroImageUrl,
      ).trim();
    }

    if (body.driverMobileHeroImageUrl != null) {
      updateData.driverMobileHeroImageUrl = String(
        body.driverMobileHeroImageUrl,
      ).trim();
    }

    if (body.defaultInAppSoundUrl != null) {
      updateData.defaultInAppSoundUrl = String(
        body.defaultInAppSoundUrl,
      ).trim();
    }

    if (body.footerCopyright != null) {
      updateData.footerCopyright = String(body.footerCopyright).trim();
    }

    const nextSupportPhoneDriver =
      updateData.supportPhoneDriver ?? current.supportPhoneDriver;
    const nextSupportEmailDriver =
      updateData.supportEmailDriver ?? current.supportEmailDriver;
    const nextSupportPhoneRider =
      updateData.supportPhoneRider ?? current.supportPhoneRider;
    const nextSupportEmailRider =
      updateData.supportEmailRider ?? current.supportEmailRider;
    const nextTimezone = updateData.timezone ?? current.timezone;

    if (!nextSupportPhoneDriver) {
      return res.status(400).json({
        success: false,
        message: "Số điện thoại hỗ trợ driver không được để trống.",
      });
    }

    if (!nextSupportEmailDriver) {
      return res.status(400).json({
        success: false,
        message: "Email hỗ trợ driver không được để trống.",
      });
    }

    if (!EMAIL_REGEX.test(nextSupportEmailDriver)) {
      return res.status(400).json({
        success: false,
        message: "Email hỗ trợ driver không hợp lệ.",
      });
    }

    if (!nextSupportPhoneRider) {
      return res.status(400).json({
        success: false,
        message: "Số điện thoại hỗ trợ khách hàng không được để trống.",
      });
    }

    if (!nextSupportEmailRider) {
      return res.status(400).json({
        success: false,
        message: "Email hỗ trợ khách hàng không được để trống.",
      });
    }

    if (!EMAIL_REGEX.test(nextSupportEmailRider)) {
      return res.status(400).json({
        success: false,
        message: "Email hỗ trợ khách hàng không hợp lệ.",
      });
    }

    if (!nextTimezone) {
      return res.status(400).json({
        success: false,
        message: "Timezone không được để trống.",
      });
    }

    const updated = await prisma.systemConfig.update({
      where: { id: current.id },
      data: updateData,
    });

    return res.json({
      success: true,
      message: "Cập nhật cấu hình hệ thống thành công.",
      item: updated,
    });
  } catch (err) {
    console.error("updateSystemConfig error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật cấu hình hệ thống.",
    });
  }
}

export async function uploadSystemConfigMedia(req, res) {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Thiếu file upload.",
      });
    }

    const mediaType = String(req.body?.mediaType || "").trim();

    if (!mediaType) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mediaType.",
      });
    }

    const allowedMediaTypes = [
      "brand_logo",
      "rider_web_hero",
      "rider_mobile_hero",
      "driver_mobile_hero",
      "default_in_app_sound",
    ];

    if (!allowedMediaTypes.includes(mediaType)) {
      return res.status(400).json({
        success: false,
        message:
          "mediaType không hợp lệ. Hỗ trợ: brand_logo, rider_web_hero, rider_mobile_hero, driver_mobile_hero, default_in_app_sound.",
      });
    }

    const folder =
      mediaType === "default_in_app_sound"
        ? "system-config/sounds"
        : "system-config/branding";

    const result = await uploadToS3({
      file,
      folder,
    });

    return res.json({
      success: true,
      mediaType,
      folder,
      ...result,
    });
  } catch (err) {
    console.error("uploadSystemConfigMedia error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Upload media hệ thống thất bại.",
    });
  }
}
