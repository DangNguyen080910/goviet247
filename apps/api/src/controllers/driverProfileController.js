// Path: goviet247/apps/api/src/controllers/driverProfileController.js
import { z } from "zod";
import { prisma } from "../utils/db.js";
import {
  extractS3KeyFromUrlOrKey,
  getSignedViewUrl,
} from "../services/s3Service.js";

const REQUIRED_DOCUMENT_TYPES = [
  "CCCD_FRONT",
  "CCCD_BACK",
  "PORTRAIT",
  "DRIVER_LICENSE",
  "VEHICLE_REGISTRATION",
];

const MIN_WITHDRAW_AMOUNT = 50000;

async function mapDriverDocumentsWithSignedUrl(documents = []) {
  return Promise.all(
    (Array.isArray(documents) ? documents : []).map(async (doc) => {
      const fileKey = extractS3KeyFromUrlOrKey(doc.fileUrl);
      const signedUrl = fileKey ? await getSignedViewUrl(fileKey, 300) : null;

      return {
        id: doc.id,
        type: doc.type,
        status: doc.status,
        fileUrl: doc.fileUrl,
        fileKey,
        viewUrl: signedUrl,
        note: doc.note,
        reviewedAt: doc.reviewedAt,
        reviewedById: doc.reviewedById,
        createdAt: doc.createdAt,
      };
    }),
  );
}

const DEFAULT_DRIVER_CONTRACT = {
  code: "GOVIET247_DRIVER_PARTNERSHIP",
  title: "Hợp đồng hợp tác tài xế GoViet247",
  version: "v1.0",
};

function normalizeIpAddress(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0] || "").trim() || null;
  }

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() || null;
  }

  const ip =
    req.ip ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    null;

  return ip ? String(ip).trim() : null;
}

function normalizeDeviceInfo(req) {
  const userAgent = String(req.headers["user-agent"] || "").trim();
  return userAgent || null;
}

function normalizeAppVersion(req, body) {
  const headerValue =
    String(req.headers["x-app-version"] || "").trim() ||
    String(body?.contractAppVersion || "").trim();

  return headerValue || null;
}

function isDriverRole(user) {
  const roleList = Array.isArray(user?.roles)
    ? user.roles.map((item) =>
        String(item?.role || "")
          .trim()
          .toUpperCase(),
      )
    : [];

  if (roleList.includes("DRIVER")) return true;

  const primaryRole = String(user?.primaryRole || "")
    .trim()
    .toUpperCase();

  return primaryRole === "DRIVER";
}

function maskAccountNumber(value) {
  const raw = String(value || "").replace(/\s+/g, "");

  if (!raw) {
    return "";
  }

  const visibleTail = raw.slice(-4);

  return `****${visibleTail}`;
}

function normalizeAccountNumber(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .trim();
}

function normalizeBankName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normalizePlateNumber(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s.-]+/g, "");
}

function toBankAccountSummary(item) {
  return {
    id: item.id,
    bankName: item.bankName,
    accountNumber: item.accountNumber,
    accountNumberMasked: maskAccountNumber(item.accountNumber),
    accountHolderName: item.accountHolderName,
    isDefault: item.isDefault,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function toWithdrawBankAccountSummary(item) {
  return {
    id: item.id,
    bankName: item.bankName,
    accountNumber: item.accountNumber,
    accountNumberMasked: maskAccountNumber(item.accountNumber),
    accountHolderName: item.accountHolderName,
    isDefault: item.isDefault,
  };
}

function buildWalletSummaryData(profile) {
  const defaultBankAccount =
    profile.bankAccounts.find((item) => item.isDefault) ||
    profile.bankAccounts[0] ||
    null;

  return {
    balance: profile.balance,
    defaultBankAccount: defaultBankAccount
      ? toBankAccountSummary(defaultBankAccount)
      : null,
    bankAccounts: profile.bankAccounts.map(toBankAccountSummary),
    recentTransactions: profile.walletTransactions.map((item) => ({
      id: item.id,
      type: item.type,
      amount: item.amount,
      balanceBefore: item.balanceBefore,
      balanceAfter: item.balanceAfter,
      note: item.note,
      tripId: item.tripId,
      withdrawRequestId: item.withdrawRequestId,
      createdAt: item.createdAt,
    })),
    recentWithdrawRequests: profile.withdrawRequests.map((item) => ({
      id: item.id,
      amount: item.amount,
      status: item.status,
      note: item.note,
      rejectReason: item.rejectReason,
      settlementWeek: item.settlementWeek,
      createdAt: item.createdAt,
      approvedAt: item.approvedAt,
      paidAt: item.paidAt,
      bankAccount: item.bankAccount
        ? toWithdrawBankAccountSummary(item.bankAccount)
        : null,
    })),
  };
}

function emitAdminDashboardChanged(req, payload = {}) {
  const io = req.app?.get?.("io");

  if (!io) return;

  const eventPayload = {
    source: payload.source || "unknown",
    withdrawRequestId: payload.withdrawRequestId || null,
    driverId: payload.driverId || null,
    driverProfileId: payload.driverProfileId || null,
    status: payload.status || null,
    updatedAt: payload.updatedAt || new Date().toISOString(),
  };

  io.to("admins").emit("admin:dashboard_changed", eventPayload);

  console.log(
    "[Socket] Emit admin:dashboard_changed -> admins",
    JSON.stringify(eventPayload),
  );
}

const createDriverProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Tên tài xế phải có ít nhất 2 ký tự.")
    .max(100, "Tên tài xế không được vượt quá 100 ký tự."),
  vehicleType: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập loại xe.")
    .max(50, "Loại xe không được vượt quá 50 ký tự."),
  vehicleBrand: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập hãng xe.")
    .max(100, "Hãng xe không được vượt quá 100 ký tự."),
  vehicleModel: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập dòng xe.")
    .max(100, "Dòng xe không được vượt quá 100 ký tự."),
  vehicleYear: z.coerce
    .number()
    .int("Năm xe phải là số nguyên.")
    .min(1950, "Năm xe không hợp lệ.")
    .max(2100, "Năm xe không hợp lệ."),
  plateNumber: z
    .string()
    .trim()
    .min(5, "Biển số xe không hợp lệ.")
    .max(30, "Biển số xe không được vượt quá 30 ký tự."),
  documents: z.object({
    CCCD_FRONT: z.string().trim().min(1, "Thiếu ảnh CCCD mặt trước."),
    CCCD_BACK: z.string().trim().min(1, "Thiếu ảnh CCCD mặt sau."),
    PORTRAIT: z.string().trim().min(1, "Thiếu ảnh chân dung."),
    DRIVER_LICENSE: z.string().trim().min(1, "Thiếu ảnh bằng lái xe."),
    VEHICLE_REGISTRATION: z
      .string()
      .trim()
      .min(1, "Thiếu ảnh cavet xe hoặc giấy tờ tương đương."),
  }),

  contractAccepted: z.literal(true, {
    errorMap: () => ({
      message: "Bạn cần đọc và đồng ý hợp đồng trước khi gửi hồ sơ.",
    }),
  }),

  contractCode: z
    .string()
    .trim()
    .min(1, "Thiếu mã hợp đồng.")
    .max(120, "Mã hợp đồng không được vượt quá 120 ký tự.")
    .default(DEFAULT_DRIVER_CONTRACT.code),

  contractTitle: z
    .string()
    .trim()
    .min(1, "Thiếu tiêu đề hợp đồng.")
    .max(255, "Tiêu đề hợp đồng không được vượt quá 255 ký tự.")
    .default(DEFAULT_DRIVER_CONTRACT.title),

  contractVersion: z
    .string()
    .trim()
    .min(1, "Thiếu phiên bản hợp đồng.")
    .max(50, "Phiên bản hợp đồng không được vượt quá 50 ký tự.")
    .default(DEFAULT_DRIVER_CONTRACT.version),

  contractFileUrl: z
    .string()
    .trim()
    .url("Link hợp đồng không hợp lệ.")
    .optional(),
  contractFileHash: z
    .string()
    .trim()
    .max(255, "Mã hash hợp đồng không được vượt quá 255 ký tự.")
    .optional(),

  contractAppVersion: z
    .string()
    .trim()
    .max(50, "App version không được vượt quá 50 ký tự.")
    .optional(),
});

const createDriverBankAccountSchema = z.object({
  bankName: z
    .string()
    .trim()
    .min(2, "Tên ngân hàng phải có ít nhất 2 ký tự.")
    .max(120, "Tên ngân hàng không được vượt quá 120 ký tự."),
  accountNumber: z
    .string()
    .trim()
    .min(6, "Số tài khoản không hợp lệ.")
    .max(50, "Số tài khoản không được vượt quá 50 ký tự."),
  accountHolderName: z
    .string()
    .trim()
    .min(2, "Tên chủ tài khoản phải có ít nhất 2 ký tự.")
    .max(120, "Tên chủ tài khoản không được vượt quá 120 ký tự."),
  isDefault: z.boolean().optional(),
});

const createDriverWithdrawRequestSchema = z.object({
  amount: z.coerce
    .number()
    .int("Số tiền rút phải là số nguyên.")
    .min(
      MIN_WITHDRAW_AMOUNT,
      `Số tiền rút tối thiểu là ${MIN_WITHDRAW_AMOUNT.toLocaleString("vi-VN")}đ.`,
    ),
});

async function getDriverUserOrFail(uid) {
  const user = await prisma.user.findUnique({
    where: { id: uid },
    include: {
      roles: true,
      driverProfile: {
        include: {
          bankAccounts: {
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
          },
        },
      },
    },
  });

  if (!user) {
    return {
      ok: false,
      status: 404,
      payload: {
        success: false,
        message: "User không tồn tại.",
      },
    };
  }

  if (!isDriverRole(user)) {
    return {
      ok: false,
      status: 403,
      payload: {
        success: false,
        message: "Tài khoản này không phải tài xế.",
      },
    };
  }

  if (!user.driverProfile) {
    return {
      ok: false,
      status: 404,
      payload: {
        success: false,
        message: "Chưa tìm thấy hồ sơ tài xế.",
      },
    };
  }

  return {
    ok: true,
    user,
    profile: user.driverProfile,
  };
}

/**
 * GET /api/driver/profile/me
 * Lấy hồ sơ tài xế của user hiện tại
 */
export async function getMyDriverProfile(req, res) {
  try {
    const { uid } = req.user || {};

    if (!uid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: uid },
      include: {
        roles: true,
        phones: {
          orderBy: { createdAt: "desc" },
        },
        driverProfile: {
          include: {
            documents: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User không tồn tại.",
      });
    }

    if (!isDriverRole(user)) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản này không phải tài xế.",
      });
    }

    if (!user.driverProfile) {
      return res.json({
        success: true,
        hasDriverProfile: false,
        profile: null,
      });
    }

    const profile = user.driverProfile;
    const resolvedFullName =
      profile.fullName || user.displayName || user.phones?.[0]?.e164 || null;

    const documents = await mapDriverDocumentsWithSignedUrl(profile.documents);

    return res.json({
      success: true,
      hasDriverProfile: true,
      profile: {
        id: profile.id,
        userId: profile.userId,
        fullName: resolvedFullName,
        displayName: resolvedFullName,
        phone: user.phones?.[0]?.e164 || null,
        status: profile.status,
        balance: profile.balance,
        vehicleType: profile.vehicleType,
        vehicleBrand: profile.vehicleBrand,
        vehicleModel: profile.vehicleModel,
        vehicleYear: profile.vehicleYear,
        plateNumber: profile.plateNumber,
        verifiedAt: profile.verifiedAt,
        rejectReason: profile.rejectReason,
        suspendReason: profile.suspendReason,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        documents,
      },
    });
  } catch (error) {
    console.error("GET /api/driver/profile/me error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal error",
    });
  }
}

/**
 * GET /api/driver/profile/wallet-summary
 * Lấy tổng quan ví tài xế của user hiện tại
 */
export async function getMyDriverWalletSummary(req, res) {
  try {
    const { uid } = req.user || {};

    if (!uid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: uid },
      include: {
        roles: true,
        driverProfile: {
          include: {
            bankAccounts: {
              orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
            },
            walletTransactions: {
              orderBy: { createdAt: "desc" },
              take: 10,
            },
            withdrawRequests: {
              orderBy: { createdAt: "desc" },
              take: 10,
              include: {
                bankAccount: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User không tồn tại.",
      });
    }

    if (!isDriverRole(user)) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản này không phải tài xế.",
      });
    }

    if (!user.driverProfile) {
      return res.status(404).json({
        success: false,
        message: "Chưa tìm thấy hồ sơ tài xế.",
      });
    }

    const profile = user.driverProfile;

    return res.json({
      success: true,
      data: buildWalletSummaryData(profile),
    });
  } catch (error) {
    console.error("GET /api/driver/profile/wallet-summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal error",
    });
  }
}

/**
 * POST /api/driver/profile/bank-accounts
 * Thêm tài khoản ngân hàng cho tài xế hiện tại
 */
export async function createMyDriverBankAccount(req, res) {
  try {
    const { uid } = req.user || {};

    if (!uid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const parsed = createDriverBankAccountSchema.parse(req.body || {});

    const result = await getDriverUserOrFail(uid);

    if (!result.ok) {
      return res.status(result.status).json(result.payload);
    }

    const profile = result.profile;
    const normalizedAccountNumber = normalizeAccountNumber(
      parsed.accountNumber,
    );
    const normalizedBankName = normalizeBankName(parsed.bankName);

    const duplicated = profile.bankAccounts.find(
      (item) =>
        normalizeBankName(item.bankName) === normalizedBankName &&
        normalizeAccountNumber(item.accountNumber) === normalizedAccountNumber,
    );

    if (duplicated) {
      return res.status(400).json({
        success: false,
        message: "Tài khoản ngân hàng này đã tồn tại.",
      });
    }

    const shouldBeDefault =
      Boolean(parsed.isDefault) || profile.bankAccounts.length === 0;

    const created = await prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.driverBankAccount.updateMany({
          where: {
            driverProfileId: profile.id,
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        });
      }

      return tx.driverBankAccount.create({
        data: {
          driverProfileId: profile.id,
          bankName: parsed.bankName.trim().replace(/\s+/g, " "),
          accountNumber: normalizedAccountNumber,
          accountHolderName: parsed.accountHolderName.trim(),
          isDefault: shouldBeDefault,
        },
      });
    });

    const bankAccounts = await prisma.driverBankAccount.findMany({
      where: {
        driverProfileId: profile.id,
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return res.json({
      success: true,
      message: "Thêm tài khoản ngân hàng thành công.",
      item: toBankAccountSummary(created),
      items: bankAccounts.map(toBankAccountSummary),
      defaultBankAccount:
        bankAccounts.find((item) => item.isDefault) || bankAccounts[0] || null,
    });
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({
        success: false,
        message: error.issues?.[0]?.message || "Dữ liệu không hợp lệ.",
      });
    }

    console.error("POST /api/driver/profile/bank-accounts error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal error",
    });
  }
}

/**
 * DELETE /api/driver/profile/bank-accounts/:bankAccountId
 * Xoá tài khoản ngân hàng của tài xế hiện tại
 */
export async function deleteMyDriverBankAccount(req, res) {
  try {
    const { uid } = req.user || {};
    const bankAccountId = String(req.params?.bankAccountId || "").trim();

    if (!uid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!bankAccountId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu bankAccountId.",
      });
    }

    const result = await getDriverUserOrFail(uid);

    if (!result.ok) {
      return res.status(result.status).json(result.payload);
    }

    const profile = result.profile;
    const existing = profile.bankAccounts.find(
      (item) => item.id === bankAccountId,
    );

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản ngân hàng.",
      });
    }

    if (profile.bankAccounts.length <= 1) {
      return res.status(400).json({
        success: false,
        message: "Bạn phải giữ lại ít nhất 1 tài khoản ngân hàng.",
      });
    }

    const activeWithdrawRequest = await prisma.driverWithdrawRequest.findFirst({
      where: {
        bankAccountId,
        status: {
          in: ["PENDING", "APPROVED"],
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (activeWithdrawRequest) {
      return res.status(400).json({
        success: false,
        message:
          "Không thể xoá tài khoản này vì đang có yêu cầu rút tiền chờ xử lý hoặc đã duyệt.",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.driverBankAccount.delete({
        where: { id: bankAccountId },
      });

      if (existing.isDefault) {
        const nextDefault = await tx.driverBankAccount.findFirst({
          where: {
            driverProfileId: profile.id,
          },
          orderBy: [{ createdAt: "desc" }],
        });

        if (nextDefault) {
          await tx.driverBankAccount.update({
            where: { id: nextDefault.id },
            data: { isDefault: true },
          });
        }
      }
    });

    const bankAccounts = await prisma.driverBankAccount.findMany({
      where: {
        driverProfileId: profile.id,
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return res.json({
      success: true,
      message: "Đã xoá tài khoản ngân hàng.",
      items: bankAccounts.map(toBankAccountSummary),
      defaultBankAccount:
        bankAccounts.find((item) => item.isDefault) || bankAccounts[0] || null,
    });
  } catch (error) {
    console.error(
      "DELETE /api/driver/profile/bank-accounts/:bankAccountId error:",
      error,
    );
    return res.status(500).json({
      success: false,
      message: "Internal error",
    });
  }
}

/**
 * PATCH /api/driver/profile/bank-accounts/:bankAccountId/default
 * Đặt tài khoản mặc định cho tài xế hiện tại
 */
export async function setMyDriverDefaultBankAccount(req, res) {
  try {
    const { uid } = req.user || {};
    const bankAccountId = String(req.params?.bankAccountId || "").trim();

    if (!uid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!bankAccountId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu bankAccountId.",
      });
    }

    const result = await getDriverUserOrFail(uid);

    if (!result.ok) {
      return res.status(result.status).json(result.payload);
    }

    const profile = result.profile;

    const existing = profile.bankAccounts.find(
      (item) => item.id === bankAccountId,
    );

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản ngân hàng.",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.driverBankAccount.updateMany({
        where: {
          driverProfileId: profile.id,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });

      await tx.driverBankAccount.update({
        where: { id: bankAccountId },
        data: {
          isDefault: true,
        },
      });
    });

    const bankAccounts = await prisma.driverBankAccount.findMany({
      where: {
        driverProfileId: profile.id,
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return res.json({
      success: true,
      message: "Đã cập nhật tài khoản mặc định.",
      items: bankAccounts.map(toBankAccountSummary),
      defaultBankAccount:
        bankAccounts.find((item) => item.isDefault) || bankAccounts[0] || null,
    });
  } catch (error) {
    console.error(
      "PATCH /api/driver/profile/bank-accounts/:bankAccountId/default error:",
      error,
    );
    return res.status(500).json({
      success: false,
      message: "Internal error",
    });
  }
}

/**
 * POST /api/driver/profile/withdraw-requests
 * Tạo yêu cầu rút tiền cho tài xế hiện tại và trừ tiền ngay trong ví
 */
export async function createMyDriverWithdrawRequest(req, res) {
  try {
    const { uid } = req.user || {};

    if (!uid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const parsed = createDriverWithdrawRequestSchema.parse(req.body || {});
    const amount = Number(parsed.amount || 0);

    const result = await getDriverUserOrFail(uid);

    if (!result.ok) {
      return res.status(result.status).json(result.payload);
    }

    const profile = result.profile;
    const defaultBankAccount =
      profile.bankAccounts.find((item) => item.isDefault) ||
      profile.bankAccounts[0] ||
      null;

    if (!defaultBankAccount) {
      return res.status(400).json({
        success: false,
        message: "Bạn cần có tài khoản ngân hàng mặc định trước khi rút tiền.",
      });
    }

    if (amount > profile.balance) {
      return res.status(400).json({
        success: false,
        message: "Số dư ví không đủ để tạo yêu cầu rút tiền này.",
      });
    }

    const note = `Driver gửi yêu cầu rút ${amount.toLocaleString("vi-VN")}đ.`;

    const created = await prisma.$transaction(async (tx) => {
      const freshProfile = await tx.driverProfile.findUnique({
        where: { id: profile.id },
        include: {
          bankAccounts: {
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
          },
        },
      });

      if (!freshProfile) {
        throw new Error("Chưa tìm thấy hồ sơ tài xế.");
      }

      const freshDefaultBank =
        freshProfile.bankAccounts.find((item) => item.isDefault) ||
        freshProfile.bankAccounts[0] ||
        null;

      if (!freshDefaultBank) {
        throw new Error(
          "Bạn cần có tài khoản ngân hàng mặc định trước khi rút tiền.",
        );
      }

      if (amount > freshProfile.balance) {
        throw new Error("Số dư ví không đủ để tạo yêu cầu rút tiền này.");
      }

      const balanceBefore = freshProfile.balance;
      const balanceAfter = balanceBefore - amount;

      const withdrawRequest = await tx.driverWithdrawRequest.create({
        data: {
          driverProfileId: freshProfile.id,
          bankAccountId: freshDefaultBank.id,
          amount,
          status: "PENDING",
          note,
        },
        include: {
          bankAccount: true,
        },
      });

      await tx.driverProfile.update({
        where: { id: freshProfile.id },
        data: {
          balance: balanceAfter,
        },
      });

      await tx.driverWalletTransaction.create({
        data: {
          driverProfileId: freshProfile.id,
          type: "WITHDRAW_REQUEST",
          amount,
          balanceBefore,
          balanceAfter,
          note,
          withdrawRequestId: withdrawRequest.id,
        },
      });

      const updatedProfile = await tx.driverProfile.findUnique({
        where: { id: freshProfile.id },
        include: {
          bankAccounts: {
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
          },
          walletTransactions: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
          withdrawRequests: {
            orderBy: { createdAt: "desc" },
            take: 10,
            include: {
              bankAccount: true,
            },
          },
        },
      });

      return {
        withdrawRequest,
        updatedProfile,
        driverProfileId: freshProfile.id,
      };
    });

    const updatedProfile = created.updatedProfile;

    if (created?.withdrawRequest) {
      emitAdminDashboardChanged(req, {
        source: "driver_withdraw_request_created",
        withdrawRequestId: created.withdrawRequest.id,
        driverId: uid,
        driverProfileId: created.driverProfileId,
        status: created.withdrawRequest.status,
        updatedAt: created.withdrawRequest.createdAt,
      });
    }

    return res.json({
      success: true,
      message:
        "Đã gửi yêu cầu rút tiền. Yêu cầu sẽ được xử lý và chuyển khoản trong thời gian sớm nhất.",
      item: created.withdrawRequest
        ? {
            id: created.withdrawRequest.id,
            amount: created.withdrawRequest.amount,
            status: created.withdrawRequest.status,
            note: created.withdrawRequest.note,
            rejectReason: created.withdrawRequest.rejectReason,
            settlementWeek: created.withdrawRequest.settlementWeek,
            createdAt: created.withdrawRequest.createdAt,
            approvedAt: created.withdrawRequest.approvedAt,
            paidAt: created.withdrawRequest.paidAt,
            bankAccount: created.withdrawRequest.bankAccount
              ? toWithdrawBankAccountSummary(
                  created.withdrawRequest.bankAccount,
                )
              : null,
          }
        : null,
      data: updatedProfile ? buildWalletSummaryData(updatedProfile) : null,
    });
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({
        success: false,
        message: error.issues?.[0]?.message || "Dữ liệu không hợp lệ.",
      });
    }

    const message = String(error?.message || "").trim();

    if (
      message === "Chưa tìm thấy hồ sơ tài xế." ||
      message ===
        "Bạn cần có tài khoản ngân hàng mặc định trước khi rút tiền." ||
      message === "Số dư ví không đủ để tạo yêu cầu rút tiền này."
    ) {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    console.error("POST /api/driver/profile/withdraw-requests error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal error",
    });
  }
}

/**
 * POST /api/driver/profile
 * Tạo hồ sơ tài xế + 5 giấy tờ bắt buộc + lưu chấp thuận hợp đồng
 */
export async function createDriverProfile(req, res) {
  try {
    const { uid } = req.user || {};

    if (!uid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const body = createDriverProfileSchema.parse(req.body || {});
    const normalizedPlateNumber = normalizePlateNumber(body.plateNumber);

    const user = await prisma.user.findUnique({
      where: { id: uid },
      include: {
        roles: true,
        driverProfile: true,
        phones: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User không tồn tại.",
      });
    }

    if (!isDriverRole(user)) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản này không phải tài xế.",
      });
    }

    if (user.driverProfile) {
      return res.status(400).json({
        success: false,
        message: "Hồ sơ tài xế đã tồn tại.",
      });
    }

    const [systemConfig, duplicatedPlateProfile] = await Promise.all([
      prisma.systemConfig.findFirst({
        select: {
          supportPhoneDriver: true,
        },
      }),
      prisma.driverProfile.findMany({
        where: {
          status: {
            in: ["PENDING", "VERIFIED"],
          },
          plateNumber: {
            not: null,
          },
        },
        select: {
          id: true,
          userId: true,
          status: true,
          plateNumber: true,
        },
      }),
    ]).then(([config, profiles]) => {
      const duplicated = profiles.find((item) => {
        return normalizePlateNumber(item.plateNumber) === normalizedPlateNumber;
      });

      return [config, duplicated];
    });

    if (duplicatedPlateProfile) {
      const supportPhone = String(
        systemConfig?.supportPhoneDriver || "",
      ).trim();
      const supportSuffix = supportPhone
        ? ` Nếu cần hỗ trợ, vui lòng nhắn Zalo admin qua số ${supportPhone} để được kiểm tra.`
        : " Nếu cần hỗ trợ, vui lòng liên hệ admin để được kiểm tra.";

      const duplicateMessage =
        duplicatedPlateProfile.status === "VERIFIED"
          ? "Biển số xe này đã được hệ thống duyệt cho một tài xế khác."
          : "Biển số xe này đang tồn tại trong một hồ sơ chờ duyệt khác.";

      return res.status(400).json({
        success: false,
        message: `${duplicateMessage}${supportSuffix}`,
      });
    }

    const ipAddress = normalizeIpAddress(req);
    const deviceInfo = normalizeDeviceInfo(req);
    const appVersion = normalizeAppVersion(req, body);
    const phoneE164 = user.phones?.[0]?.e164 || null;

    const profile = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: uid },
        data: {
          primaryRole: "DRIVER",
        },
      });

      const createdProfile = await tx.driverProfile.create({
        data: {
          userId: uid,
          fullName: body.fullName,
          status: "PENDING",
          vehicleType: body.vehicleType,
          vehicleBrand: body.vehicleBrand,
          vehicleModel: body.vehicleModel,
          vehicleYear: body.vehicleYear,
          plateNumber: body.plateNumber.trim().toUpperCase(),
        },
      });

      await tx.driverDocument.createMany({
        data: REQUIRED_DOCUMENT_TYPES.map((type) => ({
          driverId: createdProfile.id,
          type,
          status: "UPLOADED",
          fileUrl: body.documents[type],
        })),
      });

      await tx.driverContractAcceptance.create({
        data: {
          driverProfileId: createdProfile.id,
          contractCode: body.contractCode,
          contractTitle: body.contractTitle,
          contractVersion: body.contractVersion,
          contractFileUrl: body.contractFileUrl || null,
          contractFileHash: body.contractFileHash || null,
          ipAddress,
          deviceInfo,
          appVersion,
          phoneE164,
          isActive: true,
        },
      });

      return tx.driverProfile.findUnique({
        where: { id: createdProfile.id },
        include: {
          documents: {
            orderBy: { createdAt: "asc" },
          },
          user: {
            include: {
              phones: {
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      });
    });

    return res.json({
      success: true,
      message:
        "Tạo hồ sơ tài xế và xác nhận hợp đồng thành công. Vui lòng chờ admin duyệt.",
      profile: profile
        ? {
            id: profile.id,
            userId: profile.userId,
            fullName:
              profile.fullName ||
              profile.user?.displayName ||
              profile.user?.phones?.[0]?.e164 ||
              null,
            displayName:
              profile.fullName ||
              profile.user?.displayName ||
              profile.user?.phones?.[0]?.e164 ||
              null,
            phone: profile.user?.phones?.[0]?.e164 || null,
            status: profile.status,
            balance: profile.balance,
            vehicleType: profile.vehicleType,
            vehicleBrand: profile.vehicleBrand,
            vehicleModel: profile.vehicleModel,
            vehicleYear: profile.vehicleYear,
            plateNumber: profile.plateNumber,
            verifiedAt: profile.verifiedAt,
            rejectReason: profile.rejectReason,
            suspendReason: profile.suspendReason,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
            documents: profile.documents.map((doc) => ({
              id: doc.id,
              type: doc.type,
              status: doc.status,
              fileUrl: doc.fileUrl,
              note: doc.note,
              reviewedAt: doc.reviewedAt,
              reviewedById: doc.reviewedById,
              createdAt: doc.createdAt,
            })),
          }
        : null,
    });
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({
        success: false,
        message: error.issues?.[0]?.message || "Dữ liệu không hợp lệ.",
      });
    }

    console.error("POST /api/driver/profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal error",
    });
  }
}
