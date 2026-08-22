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
  riderWebBackgroundImageUrl: "",
  riderMobileBackgroundImageUrl: "",
  footerCopyright: "© 2023 GoViet247 - Công ty TNHH Công nghệ ViNa LightHouse",

  riderLatestVersion: "1.0.6",
  riderMinimumVersion: "1.0.6",
  riderIosStoreUrl: "https://apps.apple.com/vn/app/goviet247/id6767422059",
  riderAndroidStoreUrl:
    "https://play.google.com/store/apps/details?id=com.goviet247.rider",
  riderUpdateMessage:
    "GoViet247 đã có phiên bản mới với các cải tiến và sửa lỗi.",
  driverLatestVersion: "1.0.2",
  driverMinimumVersion: "1.0.2",
  driverIosStoreUrl: "",
  driverAndroidStoreUrl:
    "https://play.google.com/store/apps/details?id=com.goviet247.driver",
  driverUpdateMessage:
    "GoViet247 Driver đã có phiên bản mới với các cải tiến và sửa lỗi.",
  adminLatestVersion: "1.0.2",
  adminMinimumVersion: "1.0.2",
  adminIosStoreUrl: "",
  adminAndroidStoreUrl:
    "https://play.google.com/store/apps/details?id=com.goviet247.admin",
  adminUpdateMessage:
    "GoViet247 Admin đã có phiên bản mới với các cải tiến và sửa lỗi.",
};

// Việt: Regex email cơ bản
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERSION_REGEX = /^\d+\.\d+\.\d+$/;

function compareVersions(left, right) {
  const a = String(left || "0.0.0").split(".").map(Number);
  const b = String(right || "0.0.0").split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const diff = (a[index] || 0) - (b[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

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

    if (body.riderWebBackgroundImageUrl != null) {
      updateData.riderWebBackgroundImageUrl = String(
        body.riderWebBackgroundImageUrl,
      ).trim();
    }

    if (body.riderMobileBackgroundImageUrl != null) {
      updateData.riderMobileBackgroundImageUrl = String(
        body.riderMobileBackgroundImageUrl,
      ).trim();
    }

    if (body.footerCopyright != null) {
      updateData.footerCopyright = String(body.footerCopyright).trim();
    }

    const versionFields = [
      "riderLatestVersion",
      "riderMinimumVersion",
      "driverLatestVersion",
      "driverMinimumVersion",
      "adminLatestVersion",
      "adminMinimumVersion",
    ];

    for (const field of versionFields) {
      if (body[field] == null) continue;
      const value = String(body[field]).trim();
      if (!VERSION_REGEX.test(value)) {
        return res.status(400).json({
          success: false,
          message: `${field} phải có dạng x.y.z, ví dụ 1.0.7.`,
        });
      }
      updateData[field] = value;
    }

    const textFields = [
      "riderIosStoreUrl",
      "riderAndroidStoreUrl",
      "riderUpdateMessage",
      "driverIosStoreUrl",
      "driverAndroidStoreUrl",
      "driverUpdateMessage",
      "adminIosStoreUrl",
      "adminAndroidStoreUrl",
      "adminUpdateMessage",
    ];

    for (const field of textFields) {
      if (body[field] != null) {
        updateData[field] = String(body[field]).trim().slice(0, 1000);
      }
    }

    for (const app of ["rider", "driver", "admin"]) {
      const latestField = `${app}LatestVersion`;
      const minimumField = `${app}MinimumVersion`;
      const latest = updateData[latestField] ?? current[latestField];
      const minimum = updateData[minimumField] ?? current[minimumField];
      if (compareVersions(minimum, latest) > 0) {
        return res.status(400).json({
          success: false,
          message: `Phiên bản tối thiểu của ${app} không được lớn hơn phiên bản mới nhất.`,
        });
      }
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
      "rider_web_background",
      "rider_mobile_background",
      "driver_topup_qr",
    ];

    if (!allowedMediaTypes.includes(mediaType)) {
      return res.status(400).json({
        success: false,
        message:
          "mediaType không hợp lệ. Hỗ trợ: brand_logo, rider_web_background, rider_mobile_background, driver_topup_qr.",
      });
    }

    let folder = "system-config/branding";

    if (mediaType === "driver_topup_qr") {
      folder = "system-config/topup-qr";
    }

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
