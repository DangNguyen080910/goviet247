// Path: goviet247/apps/api/src/routes/publicConfig.js
import { Router } from "express";
import pkg from "@prisma/client";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const router = Router();

/**
 * GET /api/public/system-config
 * API public cho customer site / rider mobile / driver mobile đọc config hệ thống
 */
router.get("/system-config", async (req, res) => {
  try {
    const config = await prisma.systemConfig.findFirst({
      orderBy: { id: "asc" },
    });

    if (!config) {
      return res.json({
        success: true,
        data: {
          supportPhoneDriver: "0977100917",
          supportEmailDriver: "driver@goviet247.com",
          supportPhoneRider: "1900-0000",
          supportEmailRider: "",
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
          footerCopyright:
            "© 2023 GoViet247 - Công ty TNHH Công nghệ ViNa LightHouse",
          mobileApps: {
            rider: {
              latestVersion: "1.0.6",
              minimumVersion: "1.0.6",
              iosStoreUrl: "https://apps.apple.com/vn/app/goviet247/id6767422059",
              androidStoreUrl: "https://play.google.com/store/apps/details?id=com.goviet247.rider",
              updateMessage: "GoViet247 đã có phiên bản mới với các cải tiến và sửa lỗi.",
            },
            driver: { latestVersion: "1.0.2", minimumVersion: "1.0.2", iosStoreUrl: "", androidStoreUrl: "https://play.google.com/store/apps/details?id=com.goviet247.driver", updateMessage: "GoViet247 Driver đã có phiên bản mới với các cải tiến và sửa lỗi." },
            admin: { latestVersion: "1.0.2", minimumVersion: "1.0.2", iosStoreUrl: "", androidStoreUrl: "https://play.google.com/store/apps/details?id=com.goviet247.admin", updateMessage: "GoViet247 Admin đã có phiên bản mới với các cải tiến và sửa lỗi." },
          },
        },
      });
    }

    return res.json({
      success: true,
      data: {
        supportPhoneDriver: config.supportPhoneDriver,
        supportEmailDriver: config.supportEmailDriver,
        supportPhoneRider: config.supportPhoneRider,
        supportEmailRider: config.supportEmailRider,
        timezone: config.timezone,

        driverTopupBankName: config.driverTopupBankName,
        driverTopupAccountNumber: config.driverTopupAccountNumber,
        driverTopupAccountHolderName: config.driverTopupAccountHolderName,
        driverTopupTransferPrefix: config.driverTopupTransferPrefix,
        driverTopupQrImageUrl: config.driverTopupQrImageUrl,
        driverTopupNote: config.driverTopupNote,

        brandName: config.brandName,
        brandLogoUrl: config.brandLogoUrl,
        riderWebBackgroundImageUrl: config.riderWebBackgroundImageUrl,
        riderMobileBackgroundImageUrl: config.riderMobileBackgroundImageUrl,
        footerCopyright: config.footerCopyright,
        mobileApps: {
          rider: {
            latestVersion: config.riderLatestVersion,
            minimumVersion: config.riderMinimumVersion,
            iosStoreUrl: config.riderIosStoreUrl,
            androidStoreUrl: config.riderAndroidStoreUrl,
            updateMessage: config.riderUpdateMessage,
          },
          driver: {
            latestVersion: config.driverLatestVersion,
            minimumVersion: config.driverMinimumVersion,
            iosStoreUrl: config.driverIosStoreUrl,
            androidStoreUrl: config.driverAndroidStoreUrl,
            updateMessage: config.driverUpdateMessage,
          },
          admin: {
            latestVersion: config.adminLatestVersion,
            minimumVersion: config.adminMinimumVersion,
            iosStoreUrl: config.adminIosStoreUrl,
            androidStoreUrl: config.adminAndroidStoreUrl,
            updateMessage: config.adminUpdateMessage,
          },
        },
      },
    });
  } catch (err) {
    console.error("public system-config error:", err);

    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy system config.",
    });
  }
});

export default router;
