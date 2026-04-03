// Path: goviet247/apps/api/src/routes/publicConfig.js
import { Router } from "express";
import pkg from "@prisma/client";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const router = Router();

/**
 * GET /api/public/system-config
 * API public cho customer site / driver app đọc config hệ thống
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