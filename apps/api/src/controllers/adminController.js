// Path: goviet247/apps/api/src/controllers/adminController.js
// Controller admin cho alert log / pending trips / trip detail / driver wallet / settlement
import {
  sendSystemNotificationToDrivers,
  sendSystemNotificationToDriver,
  sendSystemNotificationToRiders,
} from "../services/notificationService.js";
import fs from "node:fs";
import path from "node:path";
import archiver from "archiver";
import {
  buildS3Key,
  uploadBufferToS3,
  getObjectStreamFromS3,
  deleteObjectFromS3,
} from "../utils/s3.js";
import {
  extractS3KeyFromUrlOrKey,
  getSignedViewUrl,
} from "../services/s3Service.js";

export function makeAdminController(prisma) {
  async function mapDriverDocumentsForAdmin(documents = []) {
    return Promise.all(
      (Array.isArray(documents) ? documents : []).map(async (doc) => {
        const fileKey = extractS3KeyFromUrlOrKey(doc.fileUrl);
        const viewUrl = fileKey ? await getSignedViewUrl(fileKey, 300) : null;

        return {
          ...doc,
          fileKey,
          viewUrl,
        };
      }),
    );
  }

  function normalizeStops(stops = []) {
    if (!Array.isArray(stops)) return [];

    return stops.map((s) => ({
      ...s,
      order: s?.order ?? s?.seq ?? 0,
    }));
  }

  function toPositiveInt(value, fallback) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function parseMoneyAmount(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (!Number.isInteger(n)) return null;
    if (n <= 0) return null;
    return n;
  }

  function getQuarterDateRange(year, quarter) {
    const safeYear = Number.isFinite(Number(year))
      ? Number(year)
      : new Date().getFullYear();

    const safeQuarter = [1, 2, 3, 4].includes(Number(quarter))
      ? Number(quarter)
      : 1;

    const startMonth = (safeQuarter - 1) * 3;
    const start = new Date(safeYear, startMonth, 1, 0, 0, 0, 0);
    const end = new Date(safeYear, startMonth + 3, 0, 23, 59, 59, 999);

    return {
      year: safeYear,
      quarter: safeQuarter,
      start,
      end,
    };
  }

  function mapTripAccountingCarType(value) {
    const normalized = String(value || "").toUpperCase();

    if (normalized === "CAR_5") return "Xe 5 chỗ";
    if (normalized === "CAR_7") return "Xe 7 chỗ";
    if (normalized === "CAR_16") return "Xe 16 chỗ";

    return normalized || "";
  }

  function mapTripAccountingDirection(value) {
    const normalized = String(value || "").toUpperCase();

    if (normalized === "ONE_WAY") return "Một chiều";
    if (normalized === "ROUND_TRIP") return "Khứ hồi";

    return normalized || "";
  }

  function buildCompletedTripAccountingRow(trip) {
    const driverName =
      trip?.driver?.driverProfile?.fullName ||
      trip?.driver?.displayName ||
      trip?.driver?.phones?.[0]?.e164 ||
      "";

    const driverPhone = trip?.driver?.phones?.[0]?.e164 || "";

    const riderName =
      trip?.riderName ||
      trip?.rider?.riderProfile?.fullName ||
      trip?.rider?.displayName ||
      trip?.riderPhone ||
      "";

    return {
      rowType: "COMPLETED_TRIP",
      rowTypeLabel: "Chuyến hoàn thành",

      tripId: trip.id,
      eventAt: trip.updatedAt,
      status: trip.status || "COMPLETED",

      driverName,
      driverPhone,
      riderName,

      carType: trip.carType || "",
      direction: trip.direction || "",

      totalPrice: Number(trip.totalPrice || 0),
      commissionAmount: Number(trip.commissionAmountSnapshot || 0),
      driverVatAmount: Number(trip.driverVatAmountSnapshot || 0),
      driverPitAmount: Number(trip.driverPitAmountSnapshot || 0),

      totalDeduction:
        Number(trip.requiredWalletAmountSnapshot || 0) ||
        Number(trip.driverTaxTotalSnapshot || 0),

      driverReceive: Number(trip.driverReceiveSnapshot || 0),

      penaltyAmount: null,
      note: "",
    };
  }

  function buildPenaltyTripAccountingRow(penalty) {
    const fallbackDriverName =
      penalty?.trip?.driver?.driverProfile?.fullName ||
      penalty?.trip?.driver?.displayName ||
      penalty?.trip?.driver?.phones?.[0]?.e164 ||
      "";

    const fallbackDriverPhone = penalty?.trip?.driver?.phones?.[0]?.e164 || "";

    return {
      rowType: "CANCEL_PENALTY",
      rowTypeLabel: "Phạt huỷ chuyến",

      tripId: penalty.tripId,
      eventAt: penalty.approvedAt || penalty.createdAt,
      status: penalty.tripStatusSnapshot || "CANCELLED",

      driverName: penalty.driverNameSnapshot || fallbackDriverName,
      driverPhone: penalty.driverPhoneSnapshot || fallbackDriverPhone,

      carType: penalty?.trip?.carType || "",
      carTypeLabel: mapTripAccountingCarType(penalty?.trip?.carType),
      direction: penalty?.trip?.direction || "",
      directionLabel: mapTripAccountingDirection(penalty?.trip?.direction),

      totalPrice: null,
      commissionAmount: null,
      driverVatAmount: null,
      driverPitAmount: null,
      totalDeduction: null,
      driverReceive: null,

      penaltyAmount: Number(penalty.penaltyAmount || 0),
      note: `Phạt huỷ chuyến ${penalty.tripId}`,
    };
  }

  function normalizeSystemNotificationAudience(value) {
    const normalized = String(value || "")
      .trim()
      .toUpperCase();

    if (normalized === "DRIVER" || normalized === "RIDER") {
      return normalized;
    }

    return "";
  }

  function sanitizeSystemNotificationText(value) {
    return String(value || "").trim();
  }

  function mapSystemNotificationItem(item) {
    return {
      id: item.id,
      audience: item.audience,
      title: item.title,
      message: item.message,
      isActive: Boolean(item.isActive),
      createdByAdminId: item.createdByAdminId ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      createdBy: item.createdBy
        ? {
            id: item.createdBy.id,
            username: item.createdBy.username,
            role: item.createdBy.role,
          }
        : null,
    };
  }

  function getWeekRange(fromRaw, toRaw) {
    if (fromRaw && toRaw) {
      const from = new Date(fromRaw);
      const to = new Date(toRaw);

      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        return null;
      }

      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);

      return { from, to };
    }

    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const from = new Date(now);
    from.setDate(now.getDate() + diffToMonday);
    from.setHours(0, 0, 0, 0);

    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    to.setHours(23, 59, 59, 999);

    return { from, to };
  }

  function getSettlementWeekKey(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const yyyy = monday.getFullYear();
    const mm = String(monday.getMonth() + 1).padStart(2, "0");
    const dd = String(monday.getDate()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}`;
  }

  function getStartOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getTwentyFourHoursAgo() {
    return new Date(Date.now() - 24 * 60 * 60 * 1000);
  }

  async function createDriverWalletNotification({
    req,
    userId,
    title,
    message,
  }) {
    if (!userId || !title || !message) {
      return null;
    }

    const notification = await prisma.systemNotification.create({
      data: {
        audience: "DRIVER",
        targetType: "USER",
        targetUserId: userId,
        title: String(title).trim(),
        message: String(message).trim(),
        isActive: true,
      },
    });

    emitDriverNotificationChanged(req, {
      source: "driver_wallet_notification_created",
      audience: "DRIVER",
      targetUserId: userId,
      notificationId: notification.id,
      updatedAt: notification.updatedAt || notification.createdAt,
    });

    try {
      await sendSystemNotificationToDriver(userId, notification);
    } catch (pushError) {
      console.error("createDriverWalletNotification push error:", pushError);
    }

    return notification;
  }

  function emitAdminDashboardChanged(req, payload = {}) {
    const io = req.app?.get?.("io");

    if (!io) return;

    const eventPayload = {
      source: payload.source || "admin_ledger_changed",
      withdrawRequestId: payload.withdrawRequestId || null,
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

  function emitDriverNotificationChanged(req, payload = {}) {
    const io = req.app?.get?.("io");

    if (!io) return;

    const audience = String(payload.audience || "DRIVER")
      .trim()
      .toUpperCase();

    const targetUserId = payload.targetUserId
      ? String(payload.targetUserId).trim()
      : "";

    const eventPayload = {
      source: payload.source || "driver_notification_changed",
      audience,
      targetUserId: targetUserId || null,
      notificationId: payload.notificationId || null,
      updatedAt: payload.updatedAt || new Date().toISOString(),
    };

    if (audience !== "DRIVER") {
      return;
    }

    if (targetUserId) {
      io.to(`driver:${targetUserId}`).emit(
        "driver:notification_changed",
        eventPayload,
      );

      console.log(
        `[Socket] Emit driver:notification_changed -> driver:${targetUserId}`,
        JSON.stringify(eventPayload),
      );

      return;
    }

    io.to("drivers").emit("driver:notification_changed", eventPayload);

    console.log(
      '[Socket] Emit driver:notification_changed -> room "drivers"',
      JSON.stringify(eventPayload),
    );
  }

  function emitRiderNotificationChanged(req, payload = {}) {
    const io = req.app?.get?.("io");

    if (!io) return;

    const audience = String(payload.audience || "RIDER")
      .trim()
      .toUpperCase();

    const targetUserId = payload.targetUserId
      ? String(payload.targetUserId).trim()
      : "";

    const eventPayload = {
      source: payload.source || "rider_notification_changed",
      audience,
      targetUserId: targetUserId || null,
      notificationId: payload.notificationId || null,
      updatedAt: payload.updatedAt || new Date().toISOString(),
    };

    if (audience !== "RIDER") {
      return;
    }

    if (targetUserId) {
      io.to(`rider:${targetUserId}`).emit(
        "rider:notification_changed",
        eventPayload,
      );

      console.log(
        `[Socket] Emit rider:notification_changed -> rider:${targetUserId}`,
        JSON.stringify(eventPayload),
      );

      return;
    }

    io.to("riders").emit("rider:notification_changed", eventPayload);

    console.log(
      '[Socket] Emit rider:notification_changed -> room "riders"',
      JSON.stringify(eventPayload),
    );
  }

  async function buildWeeklySettlementSnapshot(from, to) {
    const [
      commissionHoldAgg,
      commissionRefundAgg,
      walletBalanceAgg,
      approvedWithdraws,
      paidWithdraws,
      pendingWithdraws,
    ] = await Promise.all([
      prisma.driverWalletTransaction.aggregate({
        where: {
          type: "COMMISSION_HOLD",
          createdAt: {
            gte: from,
            lte: to,
          },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.driverWalletTransaction.aggregate({
        where: {
          type: "COMMISSION_REFUND",
          createdAt: {
            gte: from,
            lte: to,
          },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.driverProfile.aggregate({
        _sum: { balance: true },
        _count: { id: true },
      }),
      prisma.driverWithdrawRequest.findMany({
        where: {
          status: "APPROVED",
          approvedAt: {
            gte: from,
            lte: to,
          },
        },
        orderBy: { approvedAt: "asc" },
        include: {
          bankAccount: true,
          driverProfile: {
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  phones: {
                    select: {
                      e164: true,
                      isVerified: true,
                      createdAt: true,
                    },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      }),
      prisma.driverWithdrawRequest.aggregate({
        where: {
          status: "PAID",
          paidAt: {
            gte: from,
            lte: to,
          },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.driverWithdrawRequest.aggregate({
        where: {
          status: "PENDING",
          createdAt: {
            gte: from,
            lte: to,
          },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    const commissionHold = Number(commissionHoldAgg._sum.amount || 0);
    const commissionRefund = Number(commissionRefundAgg._sum.amount || 0);
    const commissionNet = commissionHold - commissionRefund;

    const withdrawApprovedTotal = approvedWithdraws.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0,
    );

    const withdrawApprovedCount = approvedWithdraws.length;
    const withdrawPaidTotal = Number(paidWithdraws._sum.amount || 0);
    const withdrawPaidCount = Number(paidWithdraws._count.id || 0);

    const withdrawPendingTotal = Number(pendingWithdraws._sum.amount || 0);
    const withdrawPendingCount = Number(pendingWithdraws._count.id || 0);

    const walletBalanceTotal = Number(walletBalanceAgg._sum.balance || 0);
    const activeDriverCount = Number(walletBalanceAgg._count.id || 0);

    return {
      summary: {
        commissionHold,
        commissionRefund,
        commissionNet,

        withdrawApprovedTotal,
        withdrawApprovedCount,

        withdrawPaidTotal,
        withdrawPaidCount,

        withdrawPendingTotal,
        withdrawPendingCount,

        walletBalanceTotal,
        activeDriverCount,
      },
      withdrawRequests: approvedWithdraws,
    };
  }

  async function buildCommissionPayoutSummary() {
    const [holdAgg, refundAgg, payoutAgg] = await Promise.all([
      prisma.driverWalletTransaction.aggregate({
        where: { type: "COMMISSION_HOLD" },
        _sum: { amount: true },
      }),
      prisma.driverWalletTransaction.aggregate({
        where: { type: "COMMISSION_REFUND" },
        _sum: { amount: true },
      }),
      prisma.commissionPayout.aggregate({
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    const commissionHoldTotal = Number(holdAgg._sum.amount || 0);
    const commissionRefundTotal = Number(refundAgg._sum.amount || 0);
    const commissionTransferredTotal = Number(payoutAgg._sum.amount || 0);
    const commissionNeedTransfer =
      commissionHoldTotal - commissionRefundTotal - commissionTransferredTotal;

    return {
      commissionHoldTotal,
      commissionRefundTotal,
      commissionTransferredTotal,
      commissionNeedTransfer: Math.max(0, commissionNeedTransfer),
      payoutCount: Number(payoutAgg._count.id || 0),
    };
  }

  async function buildDashboardData(currentAdmin) {
    const now = new Date();
    const todayStart = getStartOfToday();
    const last24h = getTwentyFourHoursAgo();
    const isAdmin =
      String(currentAdmin?.role || "")
        .trim()
        .toUpperCase() === "ADMIN";

    const [
      pendingVerifyCount,
      unassignedCount,
      assignedCount,
      recentAlertsCount,
      driverKycPendingCount,
      feedbackNewCount,

      urgentPendingTrips,
      urgentUnassignedTrips,
      urgentDriverKycs,
      urgentFeedbacks,

      todayCreatedCount,
      todayVerifiedCount,
      todayCompletedCount,
      todayCancelledCount,

      walletAgg,
      withdrawPendingAgg,
      withdrawApprovedAgg,
      commissionSummary,
      settlementPendingCount,
      driverConfig,
      systemConfig,
      feedbackInReviewCount,
      driverTripPenaltyPendingCount,
    ] = await Promise.all([
      prisma.trip.count({
        where: {
          status: "PENDING",
          isVerified: false,
          cancelledAt: null,
        },
      }),
      prisma.trip.count({
        where: {
          status: "PENDING",
          isVerified: true,
          cancelledAt: null,
        },
      }),
      prisma.trip.count({
        where: {
          status: {
            in: ["ACCEPTED", "CONTACTED", "IN_PROGRESS"],
          },
        },
      }),
      prisma.adminAlertLog.count({
        where: {
          sentAt: {
            gte: last24h,
          },
        },
      }),
      prisma.driverProfile.count({
        where: {
          status: "PENDING",
        },
      }),
      prisma.feedback.count({
        where: {
          status: "NEW",
        },
      }),

      prisma.trip.findMany({
        where: {
          status: "PENDING",
          isVerified: false,
          cancelledAt: null,
        },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: {
          id: true,
          riderName: true,
          riderPhone: true,
          pickupAddress: true,
          dropoffAddress: true,
          totalPrice: true,
          createdAt: true,
        },
      }),
      prisma.trip.findMany({
        where: {
          status: "PENDING",
          isVerified: true,
          cancelledAt: null,
        },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: {
          id: true,
          riderName: true,
          riderPhone: true,
          pickupAddress: true,
          dropoffAddress: true,
          totalPrice: true,
          createdAt: true,
          unassignedTripAlertCount: true,
          unassignedTripAlertAt: true,
        },
      }),
      prisma.driverProfile.findMany({
        where: {
          status: "PENDING",
        },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: {
          id: true,
          status: true,
          createdAt: true,
          vehicleType: true,
          plateNumber: true,
          user: {
            select: {
              id: true,
              displayName: true,
              phones: {
                select: {
                  e164: true,
                  isVerified: true,
                  createdAt: true,
                },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
        },
      }),
      prisma.feedback.findMany({
        where: {
          status: "NEW",
        },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: {
          id: true,
          actorRole: true,
          source: true,
          subject: true,
          message: true,
          senderName: true,
          senderPhone: true,
          createdAt: true,
        },
      }),

      prisma.trip.count({
        where: {
          createdAt: {
            gte: todayStart,
          },
        },
      }),
      prisma.trip.count({
        where: {
          isVerified: true,
          verifiedAt: {
            gte: todayStart,
          },
        },
      }),
      prisma.trip.count({
        where: {
          status: "COMPLETED",
          updatedAt: {
            gte: todayStart,
          },
        },
      }),
      prisma.trip.count({
        where: {
          status: "CANCELLED",
          cancelledAt: {
            gte: todayStart,
          },
        },
      }),

      prisma.driverProfile.aggregate({
        _sum: { balance: true },
        _count: { id: true },
      }),
      prisma.driverWithdrawRequest.aggregate({
        where: { status: "PENDING" },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.driverWithdrawRequest.aggregate({
        where: { status: "APPROVED" },
        _sum: { amount: true },
        _count: { id: true },
      }),
      buildCommissionPayoutSummary(),
      prisma.weeklyCommissionSettlement.count({
        where: { status: "PENDING" },
      }),
      prisma.driverConfig.findFirst({
        orderBy: { id: "desc" },
      }),
      prisma.systemConfig.findFirst({
        orderBy: { id: "desc" },
      }),
      prisma.feedback.count({
        where: {
          status: "IN_REVIEW",
        },
      }),
      prisma.driverTripPenaltyLog.count({
        where: {
          status: "PENDING",
        },
      }),
    ]);

    const dashboard = {
      stats: {
        pendingVerifyCount,
        unassignedCount,
        assignedCount,
        recentAlertsCount,
        driverKycPendingCount,
        feedbackNewCount,
      },
      urgent: {
        pendingTrips: urgentPendingTrips.map((item) => ({
          ...item,
          waitingMinutes: Math.floor(
            (now.getTime() - new Date(item.createdAt).getTime()) / 60000,
          ),
        })),
        unassignedTrips: urgentUnassignedTrips.map((item) => ({
          ...item,
          waitingMinutes: Math.floor(
            (now.getTime() - new Date(item.createdAt).getTime()) / 60000,
          ),
        })),
        driverKycs: urgentDriverKycs,
        feedbacks: urgentFeedbacks,
      },
      today: {
        createdCount: todayCreatedCount,
        verifiedCount: todayVerifiedCount,
        completedCount: todayCompletedCount,
        cancelledCount: todayCancelledCount,
      },
    };

    if (isAdmin) {
      const pendingVerifyTooLongCount = await prisma.trip.count({
        where: {
          status: "PENDING",
          isVerified: false,
          cancelledAt: null,
          createdAt: {
            lte: new Date(now.getTime() - 30 * 60 * 1000),
          },
        },
      });

      const unassignedTooLongCount = await prisma.trip.count({
        where: {
          status: "PENDING",
          isVerified: true,
          cancelledAt: null,
          createdAt: {
            lte: new Date(now.getTime() - 30 * 60 * 1000),
          },
        },
      });

      dashboard.adminOnly = {
        finance: {
          walletBalanceTotal: Number(walletAgg._sum.balance || 0),
          driverCount: Number(walletAgg._count.id || 0),

          // Việt: Trang chủ phần tài chính cần phản ánh số tiền/yêu cầu
          // đang chờ CHUYỂN thực tế cho tài xế, tức là status APPROVED.
          withdrawPendingTotal: Number(withdrawApprovedAgg._sum.amount || 0),
          withdrawPendingCount: Number(withdrawApprovedAgg._count.id || 0),

          commissionNeedTransfer: Number(
            commissionSummary.commissionNeedTransfer || 0,
          ),
          settlementPendingCount,
        },
        system: {
          commissionPercent: Number(driverConfig?.commissionPercent || 0),
          driverDepositAmount: Number(driverConfig?.driverDepositAmount || 0),
          supportPhoneDriver: systemConfig?.supportPhoneDriver || "",
          supportPhoneRider: systemConfig?.supportPhoneRider || "",
          timezone: systemConfig?.timezone || "Asia/Ho_Chi_Minh",
        },
        risks: {
          pendingVerifyTooLongCount,
          unassignedTooLongCount,

          // Việt: Phần rủi ro vẫn giữ số yêu cầu PENDING
          // để admin biết còn bao nhiêu yêu cầu chưa được duyệt.
          withdrawPendingCount: Number(withdrawPendingAgg._count.id || 0),

          feedbackBacklogCount:
            Number(feedbackNewCount || 0) + Number(feedbackInReviewCount || 0),
          driverTripPenaltyPendingCount: Number(
            driverTripPenaltyPendingCount || 0,
          ),
        },
      };
    }

    return dashboard;
  }

  const ACCOUNTING_EXPORT_GROUPS = [
    {
      key: "BANK_STATEMENT",
      label: "Sao kê ngân hàng",
      kind: "document",
      documentType: "BANK_STATEMENT",
    },
    {
      key: "INPUT_INVOICE",
      label: "HĐ đầu vào",
      kind: "document",
      documentType: "INPUT_INVOICE",
    },
    {
      key: "OUTPUT_INVOICE",
      label: "HĐ đầu ra",
      kind: "document",
      documentType: "OUTPUT_INVOICE",
    },
    {
      key: "COMPANY_CASH_EXPORT",
      label: "Thu chi công ty",
      kind: "company_cash",
    },
    {
      key: "DRIVER_WALLET_EXPORT",
      label: "Ví tài xế",
      kind: "driver_wallet",
    },
    {
      key: "TRIP_EXPORT",
      label: "Chuyến đi",
      kind: "trip_accounting",
    },
    {
      key: "DRIVER_WITHDRAW_EXPORT",
      label: "Tài xế rút ví",
      kind: "driver_withdraw",
    },
    {
      key: "PAYROLL_HR",
      label: "Lương & nhân sự",
      kind: "document",
      documentType: "PAYROLL_HR",
    },
    {
      key: "LEGAL_CONTRACT",
      label: "Hợp đồng pháp lý",
      kind: "document",
      documentType: "LEGAL_CONTRACT",
    },
    {
      key: "REVENUE_REPORT_EXPORT",
      label: "Báo cáo doanh thu lợi nhuận",
      kind: "revenue_report",
    },
    {
      key: "ACCOUNTING_NOTE",
      label: "Ghi chú kế toán",
      kind: "accounting_note",
    },
  ];

  function formatDateOnly(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toISOString().slice(0, 10);
  }

  async function getAccountingExportPreviewGroups({ quarter, year }) {
    const {
      start,
      end,
      quarter: safeQuarter,
      year: safeYear,
    } = getQuarterDateRange(year, quarter);

    const [
      bankStatementCount,
      inputInvoiceCount,
      outputInvoiceCount,
      payrollHrCount,
      legalContractCount,
      accountingNoteCount,
      companyCashCount,
      driverWalletCount,
      driverWithdrawCount,
      completedTripCount,
      approvedPenaltyCount,
    ] = await Promise.all([
      prisma.accountingDocument.count({
        where: {
          documentType: "BANK_STATEMENT",
          quarter: safeQuarter,
          year: safeYear,
        },
      }),
      prisma.accountingDocument.count({
        where: {
          documentType: "INPUT_INVOICE",
          quarter: safeQuarter,
          year: safeYear,
        },
      }),
      prisma.accountingDocument.count({
        where: {
          documentType: "OUTPUT_INVOICE",
          quarter: safeQuarter,
          year: safeYear,
        },
      }),
      prisma.accountingDocument.count({
        where: {
          documentType: "PAYROLL_HR",
          quarter: safeQuarter,
          year: safeYear,
        },
      }),
      prisma.accountingDocument.count({
        where: {
          documentType: "LEGAL_CONTRACT",
          quarter: safeQuarter,
          year: safeYear,
        },
      }),
      prisma.accountingNote.count({
        where: {
          quarter: safeQuarter,
          year: safeYear,
        },
      }),
      prisma.companyCashTransaction.count({
        where: {
          txnDate: {
            gte: start,
            lte: end,
          },
        },
      }),
      prisma.driverWalletTransaction.count({
        where: {
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      }),
      prisma.driverWithdrawRequest.count({
        where: {
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      }),
      prisma.trip.count({
        where: {
          status: "COMPLETED",
          updatedAt: {
            gte: start,
            lte: end,
          },
        },
      }),
      prisma.driverTripPenaltyLog.count({
        where: {
          status: "APPROVED",
          approvedAt: {
            gte: start,
            lte: end,
          },
        },
      }),
    ]);

    const countMap = {
      BANK_STATEMENT: bankStatementCount,
      INPUT_INVOICE: inputInvoiceCount,
      OUTPUT_INVOICE: outputInvoiceCount,
      COMPANY_CASH_EXPORT: companyCashCount,
      DRIVER_WALLET_EXPORT: driverWalletCount,
      TRIP_EXPORT: completedTripCount + approvedPenaltyCount,
      DRIVER_WITHDRAW_EXPORT: driverWithdrawCount,
      PAYROLL_HR: payrollHrCount,
      LEGAL_CONTRACT: legalContractCount,
      REVENUE_REPORT_EXPORT: 1,
      ACCOUNTING_NOTE: accountingNoteCount,
    };

    const groups = ACCOUNTING_EXPORT_GROUPS.map((group) => {
      const count = countMap[group.key] || 0;

      return {
        key: group.key,
        label: group.label,
        count,
        hasData: count > 0,
      };
    });

    const totalItems = groups.reduce((sum, item) => sum + item.count, 0);

    return {
      quarter: safeQuarter,
      year: safeYear,
      fromDate: formatDateOnly(start),
      toDate: formatDateOnly(end),
      groups,
      totalItems,
    };
  }

  async function getAccountingExportPackageData({ quarter, year }) {
    const preview = await getAccountingExportPreviewGroups({ quarter, year });

    const groups = preview.groups.map((group) => {
      switch (group.key) {
        case "BANK_STATEMENT":
          return {
            ...group,
            type: "documents",
            folderName: "01-sao-ke-ngan-hang",
          };

        case "INPUT_INVOICE":
          return {
            ...group,
            type: "documents",
            folderName: "02-hoa-don-dau-vao",
          };

        case "OUTPUT_INVOICE":
          return {
            ...group,
            type: "documents",
            folderName: "03-hoa-don-dau-ra",
          };

        case "COMPANY_CASH_EXPORT":
          return {
            ...group,
            type: "csv",
            folderName: "04-thu-chi-cong-ty",
            fileName: `thu_chi_cong_ty_Q${quarter}_${year}.csv`,
          };

        case "DRIVER_WALLET_EXPORT":
          return {
            ...group,
            type: "csv",
            folderName: "05-vi-tai-xe",
            fileName: `vi_tai_xe_Q${quarter}_${year}.csv`,
          };

        case "TRIP_EXPORT":
          return {
            ...group,
            type: "csv",
            folderName: "06-chuyen-di",
            fileName: `chuyen_di_Q${quarter}_${year}.csv`,
          };

        case "DRIVER_WITHDRAW_EXPORT":
          return {
            ...group,
            type: "csv",
            folderName: "07-tai-xe-rut-vi",
            fileName: `tai_xe_rut_vi_Q${quarter}_${year}.csv`,
          };

        case "PAYROLL_HR":
          return {
            ...group,
            type: "documents",
            folderName: "08-luong-nhan-su",
          };

        case "LEGAL_CONTRACT":
          return {
            ...group,
            type: "documents",
            folderName: "09-hop-dong-phap-ly",
          };

        case "REVENUE_REPORT_EXPORT":
          return {
            ...group,
            type: "csv",
            folderName: "10-bao-cao-doanh-thu-loi-nhuan",
            fileName: `bao_cao_doanh_thu_loi_nhuan_Q${quarter}_${year}.csv`,
          };

        case "ACCOUNTING_NOTE":
          return {
            ...group,
            type: "csv",
            folderName: "11-ghi-chu-ke-toan",
            fileName: `ghi_chu_ke_toan_Q${quarter}_${year}.csv`,
          };

        default:
          return {
            ...group,
            type: "unknown",
          };
      }
    });

    return {
      quarter,
      year,
      fromDate: preview.fromDate,
      toDate: preview.toDate,
      zipFileName: `ViNaLighthouse_goviet247_ke_toan_Q${quarter}_${year}.zip`,
      readmeFileName: "README.txt",
      groups,
      totalItems: preview.totalItems,
    };
  }

  function escapeCsvCell(value) {
    const str = String(value ?? "");
    return `"${str.replace(/"/g, '""')}"`;
  }

  function buildCsvString(rows = []) {
    return (
      "\uFEFF" + rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")
    );
  }

  function formatDateTimeExport(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("vi-VN");
  }

  function formatDateOnlyExport(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  }

  function getPhoneValue(user) {
    return user?.phones?.[0]?.e164 || "";
  }

  function getDriverDisplayName(driverProfile) {
    return (
      driverProfile?.fullName ||
      driverProfile?.user?.displayName ||
      driverProfile?.user?.phones?.[0]?.e164 ||
      ""
    );
  }

  function resolveStoredFileAbsolutePath(filePath) {
    const cleanPath = String(filePath || "").trim();
    if (!cleanPath) return null;

    return cleanPath;
  }

  function buildAccountingExportReadme({
    quarter,
    year,
    fromDate,
    toDate,
    groups = [],
    totalItems = 0,
    adminUsername = "",
  }) {
    const lines = [
      "GO VIET 247 - GOI EXPORT KE TOAN",
      "=================================",
      `Quy: Q${quarter}`,
      `Nam: ${year}`,
      `Pham vi: ${fromDate} -> ${toDate}`,
      `Nguoi export: ${adminUsername || "admin"}`,
      `Thoi gian export: ${formatDateTimeExport(new Date())}`,
      `Tong so muc du lieu: ${totalItems}`,
      "",
      "CAC NHOM DU LIEU:",
      ...groups.map(
        (group) =>
          `- (${group.folderName || "-"}) ${group.label}: ${group.count} muc`,
      ),
      "",
      "GIAI THICH NGHIEP VU QUAN TRONG:",
      "- Khach hang thanh toan truc tiep cho tai xe, khong di qua he thong.",
      "- Doanh thu cong ty CHI gom: phi moi gioi va phat huy chuyen.",
      "- Bao cao doanh thu loi nhuan KHONG tinh tong gia tri chuyen la doanh thu cong ty.",
      "- Tai xe nap vi va tai xe rut vi la dong tien giu ho / hoan tra, khong phai doanh thu cong ty.",
      "- Chi phi cong ty chi tinh cac khoan chi thuc te nhu Marketing, AWS, Server, Luong, Van hanh, Chu so huu rut tien, Chi khac, va cac khoan Refund neu duoc ghi nhan la chi phi.",
      "",
      "GHI CHU:",
      "- Cac file CSV dung dinh dang UTF-8 BOM de mo Excel de hon.",
      "- Cac folder chung tu se chua file upload thuc te neu file ton tai tren server.",
      "- Cac nhom khong co du lieu co the khong xuat file CSV ben trong ZIP.",
      "",
    ];

    return lines.join("\n");
  }

  async function buildAccountingNotesCsvForQuarter({ quarter, year }) {
    const {
      start,
      end,
      quarter: safeQuarter,
      year: safeYear,
    } = getQuarterDateRange(year, quarter);

    const completedAgg = await prisma.trip.aggregate({
      where: {
        status: "COMPLETED",
        updatedAt: {
          gte: start,
          lte: end,
        },
      },
      _sum: {
        totalPrice: true,
        commissionAmountSnapshot: true,
        driverVatAmountSnapshot: true,
        driverPitAmountSnapshot: true,
        requiredWalletAmountSnapshot: true,
        driverReceiveSnapshot: true,
      },
      _count: { id: true },
    });

    const penaltyAgg = await prisma.driverTripPenaltyLog.aggregate({
      where: {
        status: "APPROVED",
        approvedAt: {
          gte: start,
          lte: end,
        },
      },
      _sum: {
        penaltyAmount: true,
      },
      _count: { id: true },
    });

    const cashItems = await prisma.companyCashTransaction.findMany({
      where: {
        txnDate: {
          gte: start,
          lte: end,
        },
      },
      select: {
        type: true,
        category: true,
        amount: true,
      },
    });

    const noteItems = await prisma.accountingNote.findMany({
      where: {
        quarter: safeQuarter,
        year: safeYear,
      },
      orderBy: { createdAt: "desc" },
    });

    let totalIn = 0;
    let totalOut = 0;
    let driverTopupTotal = 0;
    let driverWithdrawPaidTotal = 0;

    cashItems.forEach((i) => {
      const amount = Number(i.amount || 0);

      if (i.type === "IN") totalIn += amount;
      if (i.type === "OUT") totalOut += amount;
      if (i.category === "DRIVER_TOPUP") driverTopupTotal += amount;
      if (i.category === "DRIVER_WITHDRAW") driverWithdrawPaidTotal += amount;
    });

    const summaryItems = [
      {
        code: "COMPLETED_TRIP_TOTAL",
        label: "Tổng giá trị chuyến hoàn thành",
        value: Number(completedAgg._sum.totalPrice || 0),
      },
      {
        code: "COMMISSION_TOTAL",
        label: "Tổng phí môi giới công ty thu được",
        value: Number(completedAgg._sum.commissionAmountSnapshot || 0),
      },
      {
        code: "DRIVER_VAT_TOTAL",
        label: "Tổng VAT tài xế",
        value: Number(completedAgg._sum.driverVatAmountSnapshot || 0),
      },
      {
        code: "DRIVER_PIT_TOTAL",
        label: "Tổng PIT tài xế",
        value: Number(completedAgg._sum.driverPitAmountSnapshot || 0),
      },
      {
        code: "DRIVER_DEDUCTION_TOTAL",
        label: "Tổng khấu trừ ví tài xế",
        value: Number(completedAgg._sum.requiredWalletAmountSnapshot || 0),
      },
      {
        code: "DRIVER_RECEIVE_TOTAL",
        label: "Tổng tiền tài xế thực nhận",
        value: Number(completedAgg._sum.driverReceiveSnapshot || 0),
      },
      {
        code: "CANCEL_PENALTY_TOTAL",
        label: "Tổng phạt huỷ chuyến đã thu",
        value: Number(penaltyAgg._sum.penaltyAmount || 0),
      },
      {
        code: "CANCEL_PENALTY_COUNT",
        label: "Số lượt phạt huỷ chuyến",
        value: Number(penaltyAgg._count.id || 0),
      },
      {
        code: "DRIVER_TOPUP_TOTAL",
        label: "Tổng tiền tài xế nạp ví",
        value: driverTopupTotal,
      },
      {
        code: "DRIVER_WITHDRAW_PAID_TOTAL",
        label: "Tổng tiền tài xế rút ví đã chi",
        value: driverWithdrawPaidTotal,
      },
      {
        code: "COMPANY_CASH_IN_TOTAL",
        label: "Tổng thu công ty",
        value: totalIn,
      },
      {
        code: "COMPANY_CASH_OUT_TOTAL",
        label: "Tổng chi công ty",
        value: totalOut,
      },
      {
        code: "COMPANY_CASH_BALANCE",
        label: "Chênh lệch thu chi công ty",
        value: totalIn - totalOut,
      },
    ];

    const rows = [
      [
        "Nhóm",
        "Mã nhóm",
        "Hạng mục",
        "Mã hạng mục",
        "Giá trị",
        "Ghi chú",
        "Người tạo",
        "Ngày tạo",
      ],
      [
        getAccountingNoteGroupLabel("SUMMARY"),
        "SUMMARY",
        `Q${safeQuarter}/${safeYear}`,
        "",
        "",
        "",
        "",
        "",
      ],
      ...summaryItems.map((item) => [
        getAccountingNoteGroupLabel("SUMMARY"),
        "SUMMARY",
        item.label,
        item.code,
        formatMoneyExport(item.value ?? 0),
        "",
        "",
        "",
      ]),
      ["", "", "", "", "", "", "", ""],
      [
        getAccountingNoteGroupLabel("NOTE"),
        "NOTE",
        `Q${safeQuarter}/${safeYear}`,
        "",
        "",
        "",
        "",
        "",
      ],
      ...noteItems.map((item) => [
        getAccountingNoteGroupLabel("NOTE"),
        "NOTE",
        item.title || "",
        "ACCOUNTING_NOTE",
        "",
        item.content || "",
        item.createdByUsername || "",
        formatDateTimeExport(item.createdAt),
      ]),
    ];

    return buildCsvString(rows);
  }

  async function buildCompanyCashCsvForQuarter({ start, end }) {
    const items = await prisma.companyCashTransaction.findMany({
      where: {
        txnDate: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { txnDate: "asc" },
    });

    const rows = [
      [
        "Ngày",
        "Loại",
        "Mã loại",
        "Nhóm",
        "Mã nhóm",
        "Số tiền",
        "Ghi chú",
        "Nguồn",
        "Mã nguồn",
        "Mã tham chiếu",
        "Người tạo",
      ],
      ...items.map((item) => [
        formatDateTimeExport(item.txnDate),
        getCompanyCashTypeLabel(item.type),
        item.type || "",
        getCompanyCashCategoryLabel(item.category),
        item.category || "",
        formatMoneyExport(item.amount || 0),
        item.note || "",
        getCompanyCashSourceLabel(item.source),
        item.source || "",
        item.referenceCode || "",
        item.createdByUsername || "",
      ]),
    ];

    return buildCsvString(rows);
  }

  const DRIVER_WALLET_EXPORT_TYPE_LABELS = {
    TOPUP: "Tài xế nạp ví",
    COMMISSION_HOLD: "Phí môi giới",
    COMMISSION_REFUND: "Hoàn phí môi giới",
    TRIP_CANCEL_PENALTY: "Phạt huỷ chuyến",
    DRIVER_VAT_HOLD: "VAT tài xế",
    DRIVER_VAT_REFUND: "Hoàn VAT tài xế",
    DRIVER_PIT_HOLD: "PIT tài xế",
    DRIVER_PIT_REFUND: "Hoàn PIT tài xế",
    WITHDRAW_REQUEST: "Yêu cầu rút tiền",
    WITHDRAW_REJECT_REFUND: "Hoàn tiền từ chối rút",
    WITHDRAW_PAID: "Tài xế rút ví",
    ADJUST_ADD: "Điều chỉnh cộng",
    ADJUST_SUBTRACT: "Điều chỉnh trừ",
  };

  const COMPANY_CASH_TYPE_LABELS = {
    IN: "Thu",
    OUT: "Chi",
  };

  const COMPANY_CASH_CATEGORY_LABELS = {
    DRIVER_TOPUP: "Tài xế nạp ví",
    DRIVER_WITHDRAW: "Tài xế rút ví",
    OWNER_CAPITAL: "Chủ sở hữu nạp vốn",
    MARKETING: "Marketing",
    AWS: "AWS",
    SERVER: "Server",
    SALARY: "Lương",
    OPERATIONS: "Vận hành",
    OWNER_WITHDRAW: "Chủ sở hữu rút tiền",
    REFUND: "Hoàn tiền",
    OTHER_IN: "Thu khác",
    OTHER_OUT: "Chi khác",
  };

  const COMPANY_CASH_SOURCE_LABELS = {
    DRIVER_WALLET_TOPUP: "Tài xế nạp ví",
    DRIVER_WITHDRAW_PAID: "Chi trả tài xế rút ví",
    MANUAL: "Thủ công",
  };

  const DRIVER_WITHDRAW_STATUS_LABELS = {
    PENDING: "Chờ duyệt",
    APPROVED: "Đã duyệt",
    PAID: "Đã chi trả",
    REJECTED: "Đã từ chối",
  };

  const ACCOUNTING_NOTE_GROUP_LABELS = {
    SUMMARY: "TỔNG HỢP",
    NOTE: "GHI CHÚ",
  };

  function getCompanyCashTypeLabel(type) {
    return COMPANY_CASH_TYPE_LABELS[type] || type || "";
  }

  function getCompanyCashCategoryLabel(category) {
    return COMPANY_CASH_CATEGORY_LABELS[category] || category || "";
  }

  function getCompanyCashSourceLabel(source) {
    return COMPANY_CASH_SOURCE_LABELS[source] || source || "";
  }

  function getDriverWalletTypeLabel(type) {
    return DRIVER_WALLET_EXPORT_TYPE_LABELS[type] || type || "";
  }

  function getDriverWithdrawStatusLabel(status) {
    return DRIVER_WITHDRAW_STATUS_LABELS[status] || status || "";
  }

  function getAccountingNoteGroupLabel(code) {
    return ACCOUNTING_NOTE_GROUP_LABELS[code] || code || "";
  }

  async function buildRevenueReportCsvForQuarter({ start, end }) {
    const completedAgg = await prisma.trip.aggregate({
      where: {
        status: "COMPLETED",
        updatedAt: {
          gte: start,
          lte: end,
        },
      },
      _sum: {
        commissionAmountSnapshot: true,
        totalPrice: true,
      },
      _count: { id: true },
    });

    const penaltyAgg = await prisma.driverTripPenaltyLog.aggregate({
      where: {
        status: "APPROVED",
        approvedAt: {
          gte: start,
          lte: end,
        },
      },
      _sum: {
        penaltyAmount: true,
      },
      _count: { id: true },
    });

    const EXPENSE_CATEGORIES = [
      "MARKETING",
      "AWS",
      "SERVER",
      "SALARY",
      "OPERATIONS",
      "OWNER_WITHDRAW",
      "OTHER_OUT",
      "REFUND",
    ];

    const cashItems = await prisma.companyCashTransaction.findMany({
      where: {
        type: "OUT",
        category: {
          in: EXPENSE_CATEGORIES,
        },
        txnDate: {
          gte: start,
          lte: end,
        },
      },
      select: {
        category: true,
        amount: true,
      },
    });

    const commission = Number(completedAgg._sum.commissionAmountSnapshot || 0);
    const penalty = Number(penaltyAgg._sum.penaltyAmount || 0);
    const revenueTotal = commission + penalty;

    let expenseTotal = 0;
    const expenseByCategory = {};

    cashItems.forEach((item) => {
      const category = String(item.category || "").trim();
      const amount = Number(item.amount || 0);

      expenseTotal += amount;

      if (!expenseByCategory[category]) {
        expenseByCategory[category] = 0;
      }

      expenseByCategory[category] += amount;
    });

    const profitAmount = revenueTotal - expenseTotal;

    const expenseRows =
      Object.keys(expenseByCategory).length > 0
        ? Object.entries(expenseByCategory).map(([category, value]) => [
            "CHI_PHI",
            getCompanyCashCategoryLabel(category),
            formatMoneyExport(value || 0),
          ])
        : [["CHI_PHI", "Chưa có chi phí nào trong kỳ này", "0"]];

    const rows = [
      ["Nhóm", "Hạng mục", "Giá trị"],

      ["DOANH_THU", "Doanh thu phí môi giới", formatMoneyExport(commission)],
      ["DOANH_THU", "Doanh thu phạt huỷ chuyến", formatMoneyExport(penalty)],
      ["DOANH_THU", "Tổng doanh thu", formatMoneyExport(revenueTotal)],

      ["", "", ""],

      ...expenseRows,
      ["CHI_PHI", "Tổng chi phí", formatMoneyExport(expenseTotal)],

      ["", "", ""],

      ["LOI_NHUAN", "Lợi nhuận tạm tính", formatMoneyExport(profitAmount)],

      ["", "", ""],

      [
        "THAM_CHIEU",
        "Tổng giá trị chuyến hoàn thành",
        formatMoneyExport(Number(completedAgg._sum.totalPrice || 0)),
      ],
      [
        "THAM_CHIEU",
        "Số chuyến hoàn thành",
        formatMoneyExport(Number(completedAgg._count.id || 0)),
      ],
      [
        "THAM_CHIEU",
        "Số lượt phạt huỷ chuyến",
        formatMoneyExport(Number(penaltyAgg._count.id || 0)),
      ],
    ];

    return buildCsvString(rows);
  }

  function formatMoneyExport(value) {
    return Number(value || 0).toLocaleString("vi-VN");
  }

  function normalizeDriverWalletItemsForAccounting(items = []) {
    const list = Array.isArray(items) ? items : [];

    const cancelledTripIds = new Set(
      list
        .filter((item) => item?.type === "TRIP_CANCEL_PENALTY" && item?.tripId)
        .map((item) => String(item.tripId)),
    );

    const withdrawRequestMap = new Map(
      list
        .filter(
          (item) =>
            item?.type === "WITHDRAW_REQUEST" && item?.withdrawRequestId,
        )
        .map((item) => [String(item.withdrawRequestId), item]),
    );

    return list
      .filter((item) => {
        const type = String(item?.type || "");
        const tripId = item?.tripId ? String(item.tripId) : "";

        if (type === "WITHDRAW_REQUEST") {
          return false;
        }

        if (
          tripId &&
          cancelledTripIds.has(tripId) &&
          ["COMMISSION_HOLD", "DRIVER_VAT_HOLD", "DRIVER_PIT_HOLD"].includes(
            type,
          )
        ) {
          return false;
        }

        return true;
      })
      .map((item) => {
        const type = String(item?.type || "");

        if (type !== "WITHDRAW_PAID" || !item?.withdrawRequestId) {
          if (type === "WITHDRAW_PAID") {
            return {
              ...item,
              amount: -Math.abs(Number(item.amount || 0)),
            };
          }

          return item;
        }

        const requestRow = withdrawRequestMap.get(
          String(item.withdrawRequestId),
        );

        if (!requestRow) {
          return {
            ...item,
            amount: -Math.abs(Number(item.amount || 0)),
          };
        }

        return {
          ...item,
          amount: -Math.abs(Number(requestRow.amount || 0)),
          balanceBefore: requestRow.balanceBefore,
          balanceAfter: requestRow.balanceAfter,
        };
      });
  }

  async function buildDriverWalletCsvForQuarter({ start, end }) {
    const rawItems = await prisma.driverWalletTransaction.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        driverProfile: {
          select: {
            fullName: true,
            user: {
              select: {
                displayName: true,
                phones: {
                  select: {
                    e164: true,
                    createdAt: true,
                  },
                  orderBy: { createdAt: "asc" },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const items = normalizeDriverWalletItemsForAccounting(rawItems);

    const rows = [
      [
        "Ngày giờ",
        "Mã giao dịch",
        "Tài xế",
        "SĐT",
        "Loại giao dịch",
        "Mã loại giao dịch",
        "Số tiền",
        "Số dư trước",
        "Số dư sau",
        "Liên quan",
        "Mã chuyến",
        "Mã yêu cầu rút",
        "Ghi chú",
      ],
      ...items.map((item) => {
        const relatedRef = item.tripId
          ? `Chuyến: ${item.tripId}`
          : item.withdrawRequestId
            ? `Rút tiền: ${item.withdrawRequestId}`
            : "-";

        return [
          formatDateTimeExport(item.createdAt),
          item.id,
          getDriverDisplayName(item.driverProfile),
          getPhoneValue(item.driverProfile?.user),
          getDriverWalletTypeLabel(item.type),
          item.type || "",
          formatMoneyExport(item.amount || 0),
          formatMoneyExport(item.balanceBefore || 0),
          formatMoneyExport(item.balanceAfter || 0),
          relatedRef,
          item.tripId || "",
          item.withdrawRequestId || "",
          item.note || "",
        ];
      }),
    ];

    return buildCsvString(rows);
  }

  async function buildDriverWithdrawCsvForQuarter({ start, end }) {
    const items = await prisma.driverWithdrawRequest.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        driverProfile: {
          select: {
            fullName: true,
            user: {
              select: {
                displayName: true,
                phones: {
                  select: {
                    e164: true,
                    createdAt: true,
                  },
                  orderBy: { createdAt: "asc" },
                  take: 1,
                },
              },
            },
          },
        },
        bankAccount: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const rows = [
      [
        "Ngày tạo",
        "Mã yêu cầu",
        "Tài xế",
        "SĐT",
        "Số tiền",
        "Trạng thái",
        "Mã trạng thái",
        "Ngân hàng",
        "Số tài khoản",
        "Chủ tài khoản",
        "Ghi chú",
        "Lý do từ chối",
        "Ngày duyệt",
        "Ngày chi trả",
      ],
      ...items.map((item) => [
        formatDateTimeExport(item.createdAt),
        item.id,
        getDriverDisplayName(item.driverProfile),
        getPhoneValue(item.driverProfile?.user),
        formatMoneyExport(item.amount || 0),
        getDriverWithdrawStatusLabel(item.status),
        item.status || "",
        item.bankAccount?.bankName || "",
        item.bankAccount?.accountNumber || "",
        item.bankAccount?.accountHolderName || "",
        item.note || "",
        item.rejectReason || "",
        formatDateTimeExport(item.approvedAt),
        formatDateTimeExport(item.paidAt),
      ]),
    ];

    return buildCsvString(rows);
  }

  async function buildTripAccountingCsvForQuarter({ start, end }) {
    const [completedTrips, approvedPenaltyLogs] = await Promise.all([
      prisma.trip.findMany({
        where: {
          status: "COMPLETED",
          updatedAt: {
            gte: start,
            lte: end,
          },
        },
        select: {
          id: true,
          updatedAt: true,
          status: true,
          totalPrice: true,
          carType: true,
          direction: true,
          commissionAmountSnapshot: true,
          driverVatAmountSnapshot: true,
          driverPitAmountSnapshot: true,
          driverTaxTotalSnapshot: true,
          requiredWalletAmountSnapshot: true,
          driverReceiveSnapshot: true,

          driver: {
            select: {
              displayName: true,
              phones: {
                select: {
                  e164: true,
                  createdAt: true,
                },
                orderBy: { createdAt: "asc" },
                take: 1,
              },
              driverProfile: {
                select: {
                  fullName: true,
                },
              },
            },
          },

          rider: {
            select: {
              displayName: true,
              phones: {
                select: {
                  e164: true,
                  createdAt: true,
                },
                orderBy: { createdAt: "asc" },
                take: 1,
              },
              riderProfile: {
                select: {
                  fullName: true,
                },
              },
            },
          },

          riderName: true,
          riderPhone: true,
        },
        orderBy: { updatedAt: "desc" },
      }),

      prisma.driverTripPenaltyLog.findMany({
        where: {
          status: "APPROVED",
          approvedAt: {
            gte: start,
            lte: end,
          },
        },
        select: {
          id: true,
          tripId: true,
          penaltyAmount: true,
          status: true,
          createdAt: true,
          approvedAt: true,
          driverNameSnapshot: true,
          driverPhoneSnapshot: true,
          tripStatusSnapshot: true,
          trip: {
            select: {
              id: true,
              carType: true,
              direction: true,
            },
          },
        },
        orderBy: { approvedAt: "desc" },
      }),
    ]);

    const completedRows = completedTrips.map(buildCompletedTripAccountingRow);
    const penaltyRows = approvedPenaltyLogs.map(buildPenaltyTripAccountingRow);

    const items = [...completedRows, ...penaltyRows].sort((a, b) => {
      const timeA = new Date(a.eventAt || 0).getTime();
      const timeB = new Date(b.eventAt || 0).getTime();
      return timeA - timeB;
    });

    const rows = [
      [
        "Loại dòng",
        "Mã loại dòng",
        "Mã chuyến",
        "Ngày sự kiện",
        "Trạng thái",
        "Mã trạng thái",
        "Tài xế",
        "SĐT",
        "Loại xe",
        "Mã loại xe",
        "Chiều chuyến",
        "Mã chiều chuyến",
        "Giá chuyến",
        "Phí môi giới",
        "VAT tài xế",
        "PIT tài xế",
        "Tổng khấu trừ",
        "Tài xế thực nhận",
        "Phạt huỷ chuyến",
        "Ghi chú",
      ],
      ...items.map((item) => {
        const rowTypeCode =
          item.penaltyAmount != null && Number(item.penaltyAmount || 0) !== 0
            ? "TRIP_CANCEL_PENALTY"
            : "COMPLETED_TRIP";

        const rowTypeLabel =
          rowTypeCode === "TRIP_CANCEL_PENALTY"
            ? "Phạt huỷ chuyến"
            : "Chuyến hoàn thành";

        return [
          rowTypeLabel,
          rowTypeCode,
          item.tripId || "",
          formatDateTimeExport(item.eventAt),
          item.statusLabel || item.status || "",
          item.status || "",
          item.driverName || "",
          item.driverPhone || "",
          item.carTypeLabel || item.carType || "",
          item.carType || "",
          item.directionLabel || item.direction || "",
          item.direction || "",
          item.totalPrice == null
            ? ""
            : formatMoneyExport(item.totalPrice || 0),
          item.commissionAmount == null
            ? ""
            : formatMoneyExport(item.commissionAmount || 0),
          item.driverVatAmount == null
            ? ""
            : formatMoneyExport(item.driverVatAmount || 0),
          item.driverPitAmount == null
            ? ""
            : formatMoneyExport(item.driverPitAmount || 0),
          item.totalDeduction == null
            ? ""
            : formatMoneyExport(item.totalDeduction || 0),
          item.driverReceive == null
            ? ""
            : formatMoneyExport(item.driverReceive || 0),
          item.penaltyAmount == null
            ? ""
            : formatMoneyExport(item.penaltyAmount || 0),
          item.note || "",
        ];
      }),
    ];

    return buildCsvString(rows);
  }

  async function appendAccountingDocumentsToArchive({
    archive,
    quarter,
    year,
    documentType,
    folderName,
  }) {
    const items = await prisma.accountingDocument.findMany({
      where: {
        documentType,
        quarter,
        year,
      },
      orderBy: { createdAt: "asc" },
    });

    for (const [index, item] of items.entries()) {
      const s3Key = resolveStoredFileAbsolutePath(item.filePath);

      if (!s3Key) {
        continue;
      }

      try {
        const objectStream = await getObjectStreamFromS3(s3Key);

        const originalName = String(item.fileName || "").trim();
        const safeFileName =
          originalName || `${String(index + 1).padStart(2, "0")}_${item.id}`;

        archive.append(objectStream, {
          name: `${folderName}/${safeFileName}`,
        });
      } catch (error) {
        console.error(
          "appendAccountingDocumentsToArchive getObjectStreamFromS3 error:",
          {
            documentId: item.id,
            s3Key,
            error,
          },
        );
      }
    }

    return items.length;
  }

  return {
    async getDashboard(req, res) {
      try {
        const data = await buildDashboardData(req.admin);

        return res.json({
          success: true,
          data,
        });
      } catch (e) {
        console.error("[Admin] getDashboard error:", e);
        return res.status(500).json({
          success: false,
          message: "Lỗi server khi lấy dữ liệu trang chủ.",
        });
      }
    },

    async listAlerts(req, res) {
      try {
        const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);

        const rows = await prisma.adminAlertLog.findMany({
          orderBy: { sentAt: "desc" },
          take: limit,
        });

        res.json({ success: true, alerts: rows });
      } catch (e) {
        console.error("[Admin] listAlerts error:", e);
        res.status(500).json({ success: false, error: "INTERNAL_ERROR" });
      }
    },

    async listAlertsByTrip(req, res) {
      try {
        const { tripId } = req.params;

        const rows = await prisma.adminAlertLog.findMany({
          where: { tripId },
          orderBy: { sentAt: "asc" },
        });

        res.json({ success: true, alerts: rows });
      } catch (e) {
        console.error("[Admin] listAlertsByTrip error:", e);
        res.status(500).json({ success: false, error: "INTERNAL_ERROR" });
      }
    },

    async listSystemNotifications(req, res) {
      try {
        const audience = normalizeSystemNotificationAudience(
          req.query.audience,
        );
        const activeRaw = String(req.query.active || "")
          .trim()
          .toLowerCase();
        const limit = Math.min(toPositiveInt(req.query.limit, 50), 200);

        const where = {
          targetType: "ALL",
        };

        if (audience) {
          where.audience = audience;
        }

        if (activeRaw === "true") {
          where.isActive = true;
        }

        if (activeRaw === "false") {
          where.isActive = false;
        }

        const items = await prisma.systemNotification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          include: {
            createdBy: {
              select: {
                id: true,
                username: true,
                role: true,
              },
            },
          },
        });

        return res.json({
          success: true,
          items: items.map(mapSystemNotificationItem),
        });
      } catch (e) {
        console.error("[Admin] listSystemNotifications error:", e);
        return res.status(500).json({
          success: false,
          message: "Lỗi server khi lấy danh sách thông báo hệ thống.",
        });
      }
    },

    async createSystemNotification(req, res) {
      try {
        const title = String(req.body?.title || "").trim();
        const message = String(req.body?.message || "").trim();
        const audience = String(req.body?.audience || "")
          .trim()
          .toUpperCase();

        if (!title) {
          return res.status(400).json({
            success: false,
            message: "Vui lòng nhập tiêu đề thông báo.",
          });
        }

        if (!message) {
          return res.status(400).json({
            success: false,
            message: "Vui lòng nhập nội dung thông báo.",
          });
        }

        if (!["DRIVER", "RIDER"].includes(audience)) {
          return res.status(400).json({
            success: false,
            message: "Đối tượng thông báo không hợp lệ.",
          });
        }

        const notification = await prisma.systemNotification.create({
          data: {
            title,
            message,
            audience,
            targetType: "ALL",
            isActive: true,
            createdByAdminId: req.admin?.id ?? null,
          },
        });

        if (audience === "DRIVER") {
          emitDriverNotificationChanged(req, {
            source: "admin_system_notification_created",
            audience: "DRIVER",
            notificationId: notification.id,
            updatedAt: notification.updatedAt || notification.createdAt,
          });

          try {
            await sendSystemNotificationToDrivers(notification);
          } catch (pushError) {
            console.error(
              "[Admin] createSystemNotification push error:",
              pushError,
            );
          }
        }

        if (audience === "RIDER") {
          emitRiderNotificationChanged(req, {
            source: "admin_system_notification_created",
            audience: "RIDER",
            notificationId: notification.id,
            updatedAt: notification.updatedAt || notification.createdAt,
          });

          try {
            await sendSystemNotificationToRiders(notification);
          } catch (pushError) {
            console.error(
              "[Admin] createSystemNotification push error for rider:",
              pushError,
            );
          }
        }

        return res.json({
          success: true,
          message: "Tạo thông báo hệ thống thành công.",
          item: notification,
        });
      } catch (err) {
        console.error("[Admin] createSystemNotification error:", err);
        return res.status(500).json({
          success: false,
          message: "Lỗi server khi tạo thông báo hệ thống.",
        });
      }
    },

    async updateSystemNotification(req, res) {
      try {
        const { id } = req.params;
        const hasIsActiveField = Object.prototype.hasOwnProperty.call(
          req.body || {},
          "isActive",
        );

        if (!hasIsActiveField) {
          return res.status(400).json({
            success: false,
            message: "Thiếu trường isActive để cập nhật trạng thái.",
          });
        }

        const isActive = Boolean(req.body?.isActive);

        const existed = await prisma.systemNotification.findUnique({
          where: { id },
          select: { id: true },
        });

        if (!existed) {
          return res.status(404).json({
            success: false,
            message: "Không tìm thấy thông báo hệ thống.",
          });
        }

        const item = await prisma.systemNotification.update({
          where: { id },
          data: { isActive },
          include: {
            createdBy: {
              select: {
                id: true,
                username: true,
                role: true,
              },
            },
          },
        });

        if (String(item.audience || "").toUpperCase() === "DRIVER") {
          emitDriverNotificationChanged(req, {
            source: "admin_system_notification_updated",
            audience: "DRIVER",
            notificationId: item.id,
            updatedAt: item.updatedAt || new Date().toISOString(),
          });
        }

        return res.json({
          success: true,
          message: "Đã cập nhật trạng thái thông báo.",
          item: mapSystemNotificationItem(item),
        });
      } catch (e) {
        console.error("[Admin] updateSystemNotification error:", e);
        return res.status(500).json({
          success: false,
          message: "Lỗi server khi cập nhật trạng thái thông báo.",
        });
      }
    },

    async listPendingTrips(req, res) {
      try {
        const now = new Date();

        const verified = String(req.query.verified || "1");
        const cancelled = String(req.query.cancelled || "0");

        const where = {};

        if (cancelled === "1") {
          where.status = "CANCELLED";
          where.cancelledAt = { not: null };
        } else {
          where.status = "PENDING";
          where.cancelledAt = null;
        }

        if (verified === "1") where.isVerified = true;
        if (verified === "0") where.isVerified = false;

        const trips = await prisma.trip.findMany({
          where,
          orderBy: { createdAt: "asc" },
          include: {
            alertLogs: true,
            stops: {
              orderBy: { seq: "asc" },
            },
          },
          take: 200,
        });

        const mapped = trips.map((t) => {
          const pendingMinutes = Math.floor(
            (now.getTime() - t.createdAt.getTime()) / 60000,
          );

          const isVerifiedTrip = Boolean(t.isVerified);

          const alertCount = isVerifiedTrip
            ? Number(t.unassignedTripAlertCount || 0)
            : Number(t.pendingTripAlertCount || 0);

          const lastAlertAt = isVerifiedTrip
            ? t.unassignedTripAlertAt
            : t.pendingTripAlertAt;

          return {
            tripId: t.id,
            riderName: t.riderName,
            riderPhone: t.riderPhone,
            pickupAddress: t.pickupAddress,
            dropoffAddress: t.dropoffAddress,
            stops: normalizeStops(t.stops),
            createdAt: t.createdAt,
            pendingMinutes,
            alertCount,
            lastAlertAt,
            status: t.status,
            isVerified: t.isVerified,
            cancelledAt: t.cancelledAt,
          };
        });

        return res.json({ success: true, trips: mapped });
      } catch (e) {
        console.error("[Admin] listPendingTrips error:", e);
        return res
          .status(500)
          .json({ success: false, error: "INTERNAL_ERROR" });
      }
    },

    async getTripDetail(req, res) {
      try {
        const { id } = req.params;

        const trip = await prisma.trip.findUnique({
          where: { id },
          include: {
            alertLogs: { orderBy: { sentAt: "asc" } },
            rider: {
              select: {
                id: true,
                displayName: true,
              },
            },
            driver: {
              select: {
                id: true,
                displayName: true,
                phones: {
                  select: { e164: true, isVerified: true, createdAt: true },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
                driverProfile: {
                  select: {
                    id: true,
                    fullName: true,
                    status: true,
                    balance: true,
                    vehicleType: true,
                    vehicleBrand: true,
                    vehicleModel: true,
                    vehicleYear: true,
                    plateNumber: true,
                    verifiedAt: true,
                    rejectReason: true,
                    suspendReason: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
              },
            },
            stops: {
              orderBy: { seq: "asc" },
            },
          },
        });

        if (!trip) {
          return res.status(404).json({
            success: false,
            error: "TRIP_NOT_FOUND",
          });
        }

        const driverProfile = trip?.driver?.driverProfile || null;
        const driverPhone = trip?.driver?.phones?.[0]?.e164 || "";

        res.json({
          success: true,
          trip: {
            ...trip,
            stops: normalizeStops(trip.stops),
            driverName:
              driverProfile?.fullName ||
              trip?.driver?.displayName ||
              driverPhone ||
              "Tài xế",
            driverPhone,
          },
        });
      } catch (e) {
        console.error("[Admin] getTripDetail error:", e);
        res.status(500).json({ success: false, error: "INTERNAL_ERROR" });
      }
    },

    async getDrivers(req, res) {
      try {
        const q = String(req.query.q || "").trim();
        const status = String(req.query.status || "ALL");
        const phoneVerified = String(req.query.phoneVerified || "all");
        const sort = String(req.query.sort || "createdAt_desc");

        const page = Math.max(1, parseInt(req.query.page || "1", 10));
        const pageSizeRaw = parseInt(req.query.pageSize || "20", 10);
        const pageSize = Math.min(
          100,
          Math.max(1, isNaN(pageSizeRaw) ? 20 : pageSizeRaw),
        );

        const where = {};

        if (status && status !== "ALL") {
          where.status = status;
        }

        if (q) {
          where.OR = [
            { plateNumber: { contains: q, mode: "insensitive" } },
            { user: { displayName: { contains: q, mode: "insensitive" } } },
            { user: { phones: { some: { e164: { contains: q } } } } },
          ];
        }

        if (phoneVerified === "true") {
          where.user = {
            ...(where.user || {}),
            phones: { some: { isVerified: true } },
          };
        }
        if (phoneVerified === "false") {
          where.user = {
            ...(where.user || {}),
            phones: { some: { isVerified: false } },
          };
        }

        let orderBy = { createdAt: "desc" };
        if (sort === "createdAt_asc") orderBy = { createdAt: "asc" };
        if (sort === "status_asc") orderBy = { status: "asc" };
        if (sort === "status_desc") orderBy = { status: "desc" };

        const skip = (page - 1) * pageSize;
        const take = pageSize;

        const [items, total] = await Promise.all([
          prisma.driverProfile.findMany({
            where,
            orderBy,
            skip,
            take,
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  phones: {
                    select: { e164: true, isVerified: true, createdAt: true },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                  },
                },
              },
            },
          }),
          prisma.driverProfile.count({ where }),
        ]);

        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        return res.json({
          success: true,
          items,
          drivers: items,
          meta: { page, pageSize, total, totalPages },
        });
      } catch (e) {
        console.error("getDrivers error:", e);
        return res.status(500).json({
          success: false,
          message: "Lỗi server khi lấy danh sách tài xế.",
        });
      }
    },

    async getDriverDetail(req, res) {
      try {
        const { id } = req.params;

        const driver = await prisma.driverProfile.findUnique({
          where: { id },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                phones: {
                  select: { e164: true, isVerified: true, createdAt: true },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
              },
            },
            documents: true,
            bankAccounts: {
              orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
            },
          },
        });

        if (!driver) {
          return res.status(404).json({ message: "Không tìm thấy tài xế" });
        }

        const documents = await mapDriverDocumentsForAdmin(driver.documents);

        return res.json({
          ...driver,
          documents,
        });
      } catch (error) {
        console.error("Lỗi getDriverDetail:", error);
        return res.status(500).json({ message: "Lỗi server" });
      }
    },

    async updateDriverKyc(req, res) {
      try {
        const { id } = req.params;
        const { action, reason } = req.body;

        if (!action || !["APPROVE", "REJECT"].includes(action)) {
          return res.status(400).json({
            message: "Action không hợp lệ. Chỉ nhận APPROVE hoặc REJECT.",
          });
        }

        if (action === "REJECT") {
          const r = (reason || "").trim();
          if (!r) {
            return res
              .status(400)
              .json({ message: "Vui lòng nhập lý do từ chối (bắt buộc)." });
          }
        }

        const actorId = req.admin?.id ?? null;
        const actorUsername = req.admin?.username ?? "admin";

        const profile = await prisma.driverProfile.findUnique({
          where: { id },
          select: { id: true, status: true },
        });

        if (!profile) {
          return res
            .status(404)
            .json({ message: "Không tìm thấy hồ sơ tài xế." });
        }

        const now = new Date();

        const data =
          action === "APPROVE"
            ? {
                status: "VERIFIED",
                verifiedAt: now,
                verifiedById: actorId,
                rejectReason: null,
                suspendReason: null,
              }
            : {
                status: "REJECTED",
                verifiedAt: now,
                verifiedById: actorId,
                rejectReason: reason.trim(),
                suspendReason: null,
              };

        const updated = await prisma.driverProfile.update({
          where: { id },
          data,
          include: {
            user: { select: { id: true, displayName: true } },
            documents: true,
          },
        });

        await prisma.adminDriverActionLog.create({
          data: {
            driverProfileId: id,
            actorId,
            actorUsername,
            action: action === "APPROVE" ? "APPROVE_KYC" : "REJECT_KYC",
            fromStatus: profile.status,
            toStatus: updated.status,
            note: action === "REJECT" ? reason.trim() : null,
          },
        });

        // Gửi notification đúng tài xế vừa được duyệt / từ chối
        try {
          const driverUserId = updated?.user?.id;

          if (driverUserId) {
            let notification = null;

            if (action === "APPROVE") {
              notification = await prisma.systemNotification.create({
                data: {
                  title: "🎉 Hồ sơ đã được duyệt",
                  message:
                    "Chúc mừng! Hồ sơ tài xế của bạn đã được duyệt. Vui lòng đọc Quy định & Quy tắc trước khi nhận chuyến.",
                  audience: "DRIVER",
                  targetType: "USER",
                  targetUserId: driverUserId,
                  isActive: true,
                },
              });
            }

            if (action === "REJECT") {
              notification = await prisma.systemNotification.create({
                data: {
                  title: "❌ Hồ sơ bị từ chối",
                  message:
                    reason.trim() ||
                    "Hồ sơ tài xế của bạn đã bị từ chối. Vui lòng liên hệ hỗ trợ để biết thêm chi tiết.",
                  audience: "DRIVER",
                  targetType: "USER",
                  targetUserId: driverUserId,
                  isActive: true,
                },
              });
            }

            if (notification) {
              emitDriverNotificationChanged(req, {
                source: "driver_kyc_notification_created",
                audience: "DRIVER",
                targetUserId: driverUserId,
                notificationId: notification.id,
                updatedAt: notification.updatedAt || notification.createdAt,
              });

              await sendSystemNotificationToDriver(driverUserId, notification);
            }
          }
        } catch (notifyError) {
          console.error("updateDriverKyc notify error:", notifyError);
        }

        return res.json({
          message:
            action === "APPROVE"
              ? "Đã duyệt KYC tài xế."
              : "Đã từ chối KYC tài xế.",
          data: updated,
        });
      } catch (err) {
        console.error("updateDriverKyc error:", err);
        return res
          .status(500)
          .json({ message: "Lỗi server khi cập nhật KYC tài xế." });
      }
    },

    async updateDriverAccount(req, res) {
      try {
        const { id } = req.params;
        const { action, reason } = req.body;

        if (!action || !["SUSPEND", "UNSUSPEND"].includes(action)) {
          return res.status(400).json({
            message: "Action không hợp lệ. Chỉ nhận SUSPEND hoặc UNSUSPEND.",
          });
        }

        if (action === "SUSPEND" || action === "UNSUSPEND") {
          const r = (reason || "").trim();
          if (!r) {
            return res
              .status(400)
              .json({ message: "Vui lòng nhập lý do (bắt buộc)." });
          }
        }

        const actorId = req.admin?.id ?? req.user?.id ?? null;
        const actorUsername =
          req.admin?.username ?? req.user?.username ?? "ADMIN";

        const profile = await prisma.driverProfile.findUnique({
          where: { id },
          select: { id: true, status: true },
        });

        if (!profile) {
          return res
            .status(404)
            .json({ message: "Không tìm thấy hồ sơ tài xế." });
        }

        const data =
          action === "SUSPEND"
            ? {
                status: "SUSPENDED",
                suspendReason: reason.trim(),
                rejectReason: null,
                verifiedById: actorId,
              }
            : {
                status: "VERIFIED",
                suspendReason: null,
                rejectReason: null,
                verifiedById: actorId,
              };

        const updated = await prisma.driverProfile.update({
          where: { id },
          data,
          include: {
            user: { select: { id: true, displayName: true } },
            documents: true,
          },
        });

        await prisma.adminDriverActionLog.create({
          data: {
            driverProfileId: id,
            actorId,
            actorUsername,
            action: action === "SUSPEND" ? "SUSPEND" : "UNSUSPEND",
            fromStatus: profile.status,
            toStatus: updated.status,
            note: reason.trim(),
          },
        });

        // Gửi notification đúng tài xế bị khoá / mở khoá
        try {
          const driverUserId = updated?.user?.id;

          if (driverUserId) {
            let notification = null;

            if (action === "SUSPEND") {
              notification = await prisma.systemNotification.create({
                data: {
                  title: "⛔ Tài khoản bị tạm khóa",
                  message:
                    reason.trim() ||
                    "Tài khoản tài xế của bạn đang bị tạm khóa. Vui lòng liên hệ hỗ trợ để biết thêm chi tiết.",
                  audience: "DRIVER",
                  targetType: "USER",
                  targetUserId: driverUserId,
                  isActive: true,
                },
              });
            }

            if (action === "UNSUSPEND") {
              notification = await prisma.systemNotification.create({
                data: {
                  title: "✅ Tài khoản đã hoạt động lại",
                  message:
                    reason.trim() ||
                    "Tài khoản tài xế của bạn đã được mở lại. Bạn có thể tiếp tục sử dụng ứng dụng và nhận chuyến.",
                  audience: "DRIVER",
                  targetType: "USER",
                  targetUserId: driverUserId,
                  isActive: true,
                },
              });
            }

            if (notification) {
              emitDriverNotificationChanged(req, {
                source: "driver_account_notification_created",
                audience: "DRIVER",
                targetUserId: driverUserId,
                notificationId: notification.id,
                updatedAt: notification.updatedAt || notification.createdAt,
              });

              await sendSystemNotificationToDriver(driverUserId, notification);
            }
          }
        } catch (notifyError) {
          console.error("updateDriverAccount notify error:", notifyError);
        }

        return res.json({
          message:
            action === "SUSPEND"
              ? "Đã khoá tài khoản tài xế."
              : "Đã mở khoá tài khoản tài xế.",
          data: updated,
        });
      } catch (err) {
        console.error("updateDriverAccount error:", err);
        return res
          .status(500)
          .json({ message: "Lỗi server khi cập nhật trạng thái tài xế." });
      }
    },

    async getDriverLogs(req, res) {
      try {
        const { id } = req.params;

        const logs = await prisma.adminDriverActionLog.findMany({
          where: { driverProfileId: id },
          orderBy: { createdAt: "desc" },
        });

        return res.json({ success: true, logs });
      } catch (e) {
        console.error("getDriverLogs error:", e);
        return res.status(500).json({
          success: false,
          message: "Lỗi server khi lấy lịch sử tài xế.",
        });
      }
    },

    async getDriverWalletTransactions(req, res) {
      try {
        const { id } = req.params;
        const limit = Math.min(toPositiveInt(req.query.limit, 50), 200);

        const profile = await prisma.driverProfile.findUnique({
          where: { id },
          select: { id: true },
        });

        if (!profile) {
          return res.status(404).json({
            success: false,
            message: "Không tìm thấy hồ sơ tài xế.",
          });
        }

        const items = await prisma.driverWalletTransaction.findMany({
          where: { driverProfileId: id },
          orderBy: { createdAt: "desc" },
          take: limit,
          include: {
            trip: {
              select: {
                id: true,
                pickupAddress: true,
                dropoffAddress: true,
                totalPrice: true,
              },
            },
            withdrawRequest: {
              select: {
                id: true,
                amount: true,
                status: true,
                createdAt: true,
                paidAt: true,
              },
            },
          },
        });

        return res.json({
          success: true,
          items,
        });
      } catch (e) {
        console.error("getDriverWalletTransactions error:", e);
        return res.status(500).json({
          success: false,
          message: "Lỗi server khi lấy lịch sử ví tài xế.",
        });
      }
    },

    async topupDriverWallet(req, res) {
      try {
        const { id } = req.params;
        const amount = parseMoneyAmount(req.body?.amount);
        const note = String(req.body?.note || "").trim();

        if (!amount) {
          return res.status(400).json({
            success: false,
            message: "Số tiền nạp không hợp lệ.",
          });
        }

        if (!note) {
          return res.status(400).json({
            success: false,
            message: "Vui lòng nhập ghi chú.",
          });
        }

        const actorId = req.admin?.id ?? null;
        const actorUsername = req.admin?.username || "admin";

        const result = await prisma.$transaction(async (tx) => {
          const profile = await tx.driverProfile.findUnique({
            where: { id },
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  phones: {
                    select: { e164: true, isVerified: true, createdAt: true },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                  },
                },
              },
            },
          });

          if (!profile) {
            const err = new Error("Không tìm thấy hồ sơ tài xế.");
            err.statusCode = 404;
            throw err;
          }

          const balanceBefore = Number(profile.balance || 0);
          const balanceAfter = balanceBefore + amount;
          const now = new Date();

          const updatedProfile = await tx.driverProfile.update({
            where: { id },
            data: { balance: balanceAfter },
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  phones: {
                    select: { e164: true, isVerified: true, createdAt: true },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                  },
                },
              },
            },
          });

          const transaction = await tx.driverWalletTransaction.create({
            data: {
              driverProfileId: id,
              type: "TOPUP",
              amount,
              balanceBefore,
              balanceAfter,
              note: `[ADMIN ${actorUsername}] ${note}`,
            },
          });

          const driverName = getDriverDisplayName(profile) || "Tài xế";

          const cashTxn = await tx.companyCashTransaction.create({
            data: {
              txnDate: now,
              type: "IN",
              category: "DRIVER_TOPUP",
              amount,
              note: `Tài xế ${driverName} nạp ví. ${note}`,
              source: "DRIVER_WALLET_TOPUP",
              referenceCode: transaction.id,
              createdByAdminId: actorId,
              createdByUsername: actorUsername,
            },
          });

          return {
            profile: updatedProfile,
            transaction,
            cashTransaction: cashTxn,
            driverUserId: profile.user?.id || null,
            balanceAfter,
            amount,
          };
        });

        emitAdminDashboardChanged(req, {
          source: "driver_wallet_topup",
          driverProfileId: result.profile?.id || id,
          updatedAt: new Date().toISOString(),
          status: "TOPUP",
        });

        await createDriverWalletNotification({
          req,
          userId: result.driverUserId,
          title: "💰 Ví được cộng tiền",
          message: `Ví của bạn đã được cộng ${Number(
            result.amount || 0,
          ).toLocaleString("vi-VN")}đ. Số dư hiện tại: ${Number(
            result.balanceAfter || 0,
          ).toLocaleString("vi-VN")}đ.`,
        });

        return res.json({
          success: true,
          message: "Đã nạp tiền vào ví tài xế và ghi nhận vào thu chi công ty.",
          item: result,
        });
      } catch (e) {
        console.error("topupDriverWallet error:", e);
        return res.status(e.statusCode || 500).json({
          success: false,
          message: e.message || "Lỗi server khi nạp tiền ví tài xế.",
        });
      }
    },

    async adjustAddDriverWallet(req, res) {
      try {
        const { id } = req.params;
        const amount = parseMoneyAmount(req.body?.amount);
        const note = String(req.body?.note || "").trim();

        if (!amount) {
          return res.status(400).json({
            success: false,
            message: "Số tiền cộng không hợp lệ.",
          });
        }

        if (!note) {
          return res.status(400).json({
            success: false,
            message: "Vui lòng nhập ghi chú.",
          });
        }

        const actorUsername = req.admin?.username || "admin";

        const result = await prisma.$transaction(async (tx) => {
          const profile = await tx.driverProfile.findUnique({
            where: { id },
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  phones: {
                    select: { e164: true, isVerified: true, createdAt: true },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                  },
                },
              },
            },
          });

          if (!profile) {
            const err = new Error("Không tìm thấy hồ sơ tài xế.");
            err.statusCode = 404;
            throw err;
          }

          const balanceBefore = Number(profile.balance || 0);
          const balanceAfter = balanceBefore + amount;

          const updatedProfile = await tx.driverProfile.update({
            where: { id },
            data: { balance: balanceAfter },
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  phones: {
                    select: { e164: true, isVerified: true, createdAt: true },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                  },
                },
              },
            },
          });

          const transaction = await tx.driverWalletTransaction.create({
            data: {
              driverProfileId: id,
              type: "ADJUST_ADD",
              amount,
              balanceBefore,
              balanceAfter,
              note: `[ADMIN ${actorUsername}] ${note}`,
            },
          });

          return {
            profile: updatedProfile,
            transaction,
            driverUserId: profile.user?.id || null,
            balanceAfter,
            amount,
          };
        });

        await createDriverWalletNotification({
          req,
          userId: result.driverUserId,
          title: "➕ Ví được điều chỉnh cộng",
          message: `Ví của bạn đã được cộng thêm ${Number(
            result.amount || 0,
          ).toLocaleString("vi-VN")}đ. Số dư hiện tại: ${Number(
            result.balanceAfter || 0,
          ).toLocaleString("vi-VN")}đ.`,
        });

        return res.json({
          success: true,
          message: "Đã điều chỉnh cộng ví tài xế.",
          item: result,
        });
      } catch (e) {
        console.error("adjustAddDriverWallet error:", e);
        return res.status(e.statusCode || 500).json({
          success: false,
          message: e.message || "Lỗi server khi điều chỉnh cộng ví tài xế.",
        });
      }
    },

    async subtractDriverWallet(req, res) {
      try {
        const { id } = req.params;
        const amount = parseMoneyAmount(req.body?.amount);
        const note = String(req.body?.note || "").trim();

        if (!amount) {
          return res.status(400).json({
            success: false,
            message: "Số tiền trừ không hợp lệ.",
          });
        }

        if (!note) {
          return res.status(400).json({
            success: false,
            message: "Vui lòng nhập ghi chú.",
          });
        }

        const actorUsername = req.admin?.username || "admin";

        const result = await prisma.$transaction(async (tx) => {
          const profile = await tx.driverProfile.findUnique({
            where: { id },
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  phones: {
                    select: { e164: true, isVerified: true, createdAt: true },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                  },
                },
              },
            },
          });

          if (!profile) {
            const err = new Error("Không tìm thấy hồ sơ tài xế.");
            err.statusCode = 404;
            throw err;
          }

          const balanceBefore = Number(profile.balance || 0);

          if (balanceBefore < amount) {
            const err = new Error("Số dư ví không đủ để trừ.");
            err.statusCode = 400;
            throw err;
          }

          const balanceAfter = balanceBefore - amount;

          const updatedProfile = await tx.driverProfile.update({
            where: { id },
            data: { balance: balanceAfter },
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  phones: {
                    select: { e164: true, isVerified: true, createdAt: true },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                  },
                },
              },
            },
          });

          const transaction = await tx.driverWalletTransaction.create({
            data: {
              driverProfileId: id,
              type: "ADJUST_SUBTRACT",
              amount,
              balanceBefore,
              balanceAfter,
              note: `[ADMIN ${actorUsername}] ${note}`,
            },
          });

          return {
            profile: updatedProfile,
            transaction,
            driverUserId: profile.user?.id || null,
            balanceAfter,
            amount,
          };
        });

        await createDriverWalletNotification({
          req,
          userId: result.driverUserId,
          title: "➖ Ví bị điều chỉnh trừ",
          message: `Ví của bạn đã bị trừ ${Number(
            result.amount || 0,
          ).toLocaleString("vi-VN")}đ. Số dư hiện tại: ${Number(
            result.balanceAfter || 0,
          ).toLocaleString("vi-VN")}đ.`,
        });

        return res.json({
          success: true,
          message: "Đã điều chỉnh trừ ví tài xế.",
          item: result,
        });
      } catch (e) {
        console.error("subtractDriverWallet error:", e);
        return res.status(e.statusCode || 500).json({
          success: false,
          message: e.message || "Lỗi server khi điều chỉnh trừ ví tài xế.",
        });
      }
    },

    async listDriverWithdrawRequests(req, res) {
      try {
        const status = String(req.query.status || "ALL").toUpperCase();
        const q = String(req.query.q || "").trim();

        const fromDateRaw = String(req.query.fromDate || "").trim();
        const toDateRaw = String(req.query.toDate || "").trim();

        const page = Math.max(1, parseInt(req.query.page || "1", 10));
        const pageSize = Math.min(
          100,
          Math.max(1, parseInt(req.query.pageSize || "20", 10) || 20),
        );

        const where = {};

        if (status !== "ALL") {
          where.status = status;
        }

        if (fromDateRaw || toDateRaw) {
          where.createdAt = {};

          if (fromDateRaw) {
            const fromDate = new Date(fromDateRaw);
            if (!Number.isNaN(fromDate.getTime())) {
              fromDate.setHours(0, 0, 0, 0);
              where.createdAt.gte = fromDate;
            }
          }

          if (toDateRaw) {
            const toDate = new Date(toDateRaw);
            if (!Number.isNaN(toDate.getTime())) {
              toDate.setHours(23, 59, 59, 999);
              where.createdAt.lte = toDate;
            }
          }
        }

        if (q) {
          where.OR = [
            { id: { equals: q } },
            {
              bankAccount: {
                bankName: { contains: q, mode: "insensitive" },
              },
            },
            {
              bankAccount: {
                accountNumber: { contains: q },
              },
            },
            {
              bankAccount: {
                accountHolderName: { contains: q, mode: "insensitive" },
              },
            },
            {
              driverProfile: {
                fullName: { contains: q, mode: "insensitive" },
              },
            },
            {
              driverProfile: {
                user: {
                  displayName: { contains: q, mode: "insensitive" },
                },
              },
            },
            {
              driverProfile: {
                user: {
                  phones: {
                    some: {
                      e164: { contains: q },
                    },
                  },
                },
              },
            },
          ];
        }

        const [items, total] = await Promise.all([
          prisma.driverWithdrawRequest.findMany({
            where,
            orderBy: [
              { paidAt: "desc" },
              { approvedAt: "desc" },
              { createdAt: "desc" },
            ],
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: {
              bankAccount: true,
              driverProfile: {
                select: {
                  id: true,
                  fullName: true,
                  user: {
                    select: {
                      id: true,
                      displayName: true,
                      phones: {
                        select: {
                          e164: true,
                          isVerified: true,
                          createdAt: true,
                        },
                        orderBy: { createdAt: "desc" },
                        take: 1,
                      },
                    },
                  },
                },
              },
            },
          }),
          prisma.driverWithdrawRequest.count({ where }),
        ]);

        return res.json({
          success: true,
          items,
          meta: {
            page,
            pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
          },
        });
      } catch (e) {
        console.error("listDriverWithdrawRequests error:", e);
        return res.status(500).json({
          success: false,
          message: "Lỗi server khi lấy danh sách yêu cầu rút tiền.",
        });
      }
    },

    async approveDriverWithdrawRequest(req, res) {
      try {
        const { id } = req.params;
        const actorId = req.admin?.id ?? null;

        const request = await prisma.driverWithdrawRequest.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            driverProfileId: true,
          },
        });

        if (!request) {
          return res.status(404).json({
            success: false,
            message: "Không tìm thấy yêu cầu rút tiền.",
          });
        }

        if (request.status !== "PENDING") {
          return res.status(400).json({
            success: false,
            message: "Chỉ có thể duyệt yêu cầu đang PENDING.",
          });
        }

        const updated = await prisma.driverWithdrawRequest.update({
          where: { id },
          data: {
            status: "APPROVED",
            approvedAt: new Date(),
            approvedByAdminId: actorId,
            settlementWeek: getSettlementWeekKey(new Date()),
          },
          include: {
            bankAccount: true,
            driverProfile: {
              include: {
                user: {
                  select: {
                    id: true,
                    displayName: true,
                    phones: {
                      select: {
                        e164: true,
                        isVerified: true,
                        createdAt: true,
                      },
                      orderBy: { createdAt: "desc" },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        });

        emitAdminDashboardChanged(req, {
          source: "admin_withdraw_request_approved",
          withdrawRequestId: updated.id,
          driverProfileId: updated.driverProfileId,
          status: updated.status,
          updatedAt: updated.approvedAt || updated.createdAt,
        });

        return res.json({
          success: true,
          message: "Đã duyệt yêu cầu rút tiền.",
          item: updated,
        });
      } catch (e) {
        console.error("approveDriverWithdrawRequest error:", e);
        return res.status(500).json({
          success: false,
          message: "Lỗi server khi duyệt yêu cầu rút tiền.",
        });
      }
    },

    async rejectDriverWithdrawRequest(req, res) {
      try {
        const { id } = req.params;
        const rejectReason = String(req.body?.reason || "").trim();

        if (!rejectReason) {
          return res.status(400).json({
            success: false,
            message: "Vui lòng nhập lý do từ chối.",
          });
        }

        const request = await prisma.driverWithdrawRequest.findUnique({
          where: { id },
          include: {
            driverProfile: {
              select: {
                id: true,
                balance: true,
              },
            },
          },
        });

        if (!request) {
          return res.status(404).json({
            success: false,
            message: "Không tìm thấy yêu cầu rút tiền.",
          });
        }

        if (request.status !== "PENDING") {
          return res.status(400).json({
            success: false,
            message: "Chỉ có thể từ chối yêu cầu đang PENDING.",
          });
        }

        const result = await prisma.$transaction(async (tx) => {
          const latestProfile = await tx.driverProfile.findUnique({
            where: { id: request.driverProfileId },
            select: {
              id: true,
              balance: true,
            },
          });

          if (!latestProfile) {
            const err = new Error("Không tìm thấy hồ sơ tài xế.");
            err.statusCode = 404;
            throw err;
          }

          const balanceBefore = latestProfile.balance;
          const balanceAfter = balanceBefore + request.amount;

          await tx.driverProfile.update({
            where: { id: latestProfile.id },
            data: { balance: balanceAfter },
          });

          const updatedRequest = await tx.driverWithdrawRequest.update({
            where: { id },
            data: {
              status: "REJECTED",
              rejectReason,
            },
          });

          await tx.driverWalletTransaction.create({
            data: {
              driverProfileId: latestProfile.id,
              type: "WITHDRAW_REJECT_REFUND",
              amount: request.amount,
              balanceBefore,
              balanceAfter,
              withdrawRequestId: request.id,
              note: `Hoàn ví do từ chối yêu cầu rút tiền ${request.id}`,
            },
          });

          return updatedRequest;
        });

        emitAdminDashboardChanged(req, {
          source: "admin_withdraw_request_rejected",
          withdrawRequestId: result.id,
          driverProfileId: result.driverProfileId,
          status: result.status,
          updatedAt: new Date().toISOString(),
        });

        return res.json({
          success: true,
          message: "Đã từ chối yêu cầu rút tiền và hoàn lại ví.",
          item: result,
        });
      } catch (e) {
        console.error("rejectDriverWithdrawRequest error:", e);
        return res.status(e.statusCode || 500).json({
          success: false,
          message: e.message || "Lỗi server khi từ chối yêu cầu rút tiền.",
        });
      }
    },

    async markDriverWithdrawRequestPaid(req, res) {
      try {
        const { id } = req.params;
        const actorId = req.admin?.id ?? null;
        const actorUsername = req.admin?.username ?? "admin";

        const request = await prisma.driverWithdrawRequest.findUnique({
          where: { id },
          include: {
            bankAccount: true,
            driverProfile: {
              include: {
                user: {
                  select: {
                    id: true,
                    displayName: true,
                    phones: {
                      select: {
                        e164: true,
                        isVerified: true,
                        createdAt: true,
                      },
                      orderBy: { createdAt: "desc" },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        });

        if (!request) {
          return res.status(404).json({
            success: false,
            message: "Không tìm thấy yêu cầu rút tiền.",
          });
        }

        if (request.status !== "APPROVED") {
          return res.status(400).json({
            success: false,
            message: "Chỉ có thể đánh dấu PAID cho yêu cầu đã APPROVED.",
          });
        }

        const updated = await prisma.$transaction(async (tx) => {
          const latestProfile = await tx.driverProfile.findUnique({
            where: { id: request.driverProfileId },
            select: {
              id: true,
              balance: true,
            },
          });

          if (!latestProfile) {
            const err = new Error("Không tìm thấy hồ sơ tài xế.");
            err.statusCode = 404;
            throw err;
          }

          const existedCashTxn = await tx.companyCashTransaction.findFirst({
            where: {
              source: "DRIVER_WITHDRAW_PAID",
              referenceCode: request.id,
            },
            select: { id: true },
          });

          if (existedCashTxn) {
            const err = new Error(
              "Yêu cầu rút tiền này đã được ghi nhận vào thu chi công ty trước đó.",
            );
            err.statusCode = 400;
            throw err;
          }

          const paidAt = new Date();

          const updatedRequest = await tx.driverWithdrawRequest.update({
            where: { id },
            data: {
              status: "PAID",
              paidAt,
              paidByAdminId: actorId,
            },
          });

          await tx.driverWalletTransaction.create({
            data: {
              driverProfileId: latestProfile.id,
              type: "WITHDRAW_PAID",
              amount: request.amount,
              balanceBefore: latestProfile.balance,
              balanceAfter: latestProfile.balance,
              withdrawRequestId: request.id,
              note: `Đã chuyển khoản payout cho yêu cầu rút tiền ${request.id}`,
            },
          });

          const driverName =
            getDriverDisplayName(request.driverProfile) ||
            request.bankAccount?.accountHolderName ||
            "Tài xế";

          const bankName = request.bankAccount?.bankName || "";
          const accountNumber = request.bankAccount?.accountNumber || "";

          const cashTxn = await tx.companyCashTransaction.create({
            data: {
              txnDate: paidAt,
              type: "OUT",
              category: "DRIVER_WITHDRAW",
              amount: Number(request.amount || 0),
              note: `Chi chuyển khoản rút ví cho tài xế ${driverName}${
                bankName ? ` - ${bankName}` : ""
              }${accountNumber ? ` - STK ${accountNumber}` : ""}`,
              source: "DRIVER_WITHDRAW_PAID",
              referenceCode: request.id,
              createdByAdminId: actorId,
              createdByUsername: actorUsername,
            },
          });

          return {
            updatedRequest,
            cashTxn,
            driverUserId: request.driverProfile?.user?.id || null,
            amount: Number(request.amount || 0),
          };
        });

        emitAdminDashboardChanged(req, {
          source: "admin_withdraw_request_paid",
          withdrawRequestId: updated.updatedRequest.id,
          driverProfileId: updated.updatedRequest.driverProfileId,
          status: updated.updatedRequest.status,
          updatedAt: updated.updatedRequest.paidAt || new Date().toISOString(),
        });

        await createDriverWalletNotification({
          req,
          userId: updated.driverUserId,
          title: "🏦 Đã chuyển tiền rút ví",
          message: `Yêu cầu rút ${Number(updated.amount || 0).toLocaleString(
            "vi-VN",
          )}đ của bạn đã được chuyển. Vui lòng kiểm tra tài khoản ngân hàng.`,
        });

        return res.json({
          success: true,
          message:
            "Đã đánh dấu yêu cầu rút tiền là PAID và ghi nhận vào thu chi công ty.",
          item: updated.updatedRequest,
          cashTransaction: updated.cashTxn,
        });
      } catch (e) {
        console.error("markDriverWithdrawRequestPaid error:", e);
        return res.status(e.statusCode || 500).json({
          success: false,
          message:
            e.message || "Lỗi server khi cập nhật trạng thái thanh toán.",
        });
      }
    },

    async getWeeklySettlementSummary(req, res) {
      try {
        const range = getWeekRange(req.query.from, req.query.to);

        if (!range) {
          return res.status(400).json({
            success: false,
            message: "from/to không hợp lệ.",
          });
        }

        const { from, to } = range;
        const weekKey = getSettlementWeekKey(from);
        const snapshot = await buildWeeklySettlementSnapshot(from, to);

        const settlement = await prisma.weeklyCommissionSettlement.findUnique({
          where: { weekKey },
        });

        return res.json({
          success: true,
          range: {
            from,
            to,
          },
          weekKey,
          summary: snapshot.summary,
          withdrawRequests: snapshot.withdrawRequests,
          settlement,
        });
      } catch (e) {
        console.error("getWeeklySettlementSummary error:", e);
        return res.status(500).json({
          success: false,
          message: "Lỗi server khi lấy dữ liệu tất toán tuần.",
        });
      }
    },

    async markWeeklyCommissionSettlementTransferred(req, res) {
      try {
        const range = getWeekRange(req.body?.from, req.body?.to);

        if (!range) {
          return res.status(400).json({
            success: false,
            message: "from/to không hợp lệ.",
          });
        }

        const { from, to } = range;
        const weekKey = getSettlementWeekKey(from);
        const actorId = req.admin?.id ?? null;
        const actorUsername = req.admin?.username ?? "admin";
        const note = String(req.body?.note || "").trim() || null;

        const snapshot = await buildWeeklySettlementSnapshot(from, to);

        const existed = await prisma.weeklyCommissionSettlement.findUnique({
          where: { weekKey },
        });

        if (existed?.status === "TRANSFERRED") {
          return res.status(400).json({
            success: false,
            message: "Tuần này đã được đánh dấu chuyển phí môi giới rồi.",
          });
        }

        const item = await prisma.weeklyCommissionSettlement.upsert({
          where: { weekKey },
          create: {
            weekKey,
            fromDate: from,
            toDate: to,
            commissionHoldTotal: snapshot.summary.commissionHold,
            commissionRefundTotal: snapshot.summary.commissionRefund,
            commissionNetTotal: snapshot.summary.commissionNet,
            status: "TRANSFERRED",
            transferredAt: new Date(),
            transferredByAdminId: actorId,
            transferredByAdminUsername: actorUsername,
            note,
          },
          update: {
            fromDate: from,
            toDate: to,
            commissionHoldTotal: snapshot.summary.commissionHold,
            commissionRefundTotal: snapshot.summary.commissionRefund,
            commissionNetTotal: snapshot.summary.commissionNet,
            status: "TRANSFERRED",
            transferredAt: new Date(),
            transferredByAdminId: actorId,
            transferredByAdminUsername: actorUsername,
            note,
          },
        });

        return res.json({
          success: true,
          message: "Đã đánh dấu chuyển phí môi giới tuần này.",
          item,
        });
      } catch (e) {
        console.error("markWeeklyCommissionSettlementTransferred error:", e);
        return res.status(500).json({
          success: false,
          message: "Lỗi server khi đánh dấu chuyển phí môi giới tuần.",
        });
      }
    },

    async getCommissionPayoutSummary(req, res) {
      try {
        const summary = await buildCommissionPayoutSummary();
        return res.json({
          success: true,
          summary,
        });
      } catch (e) {
        console.error("getCommissionPayoutSummary error:", e);
        return res.status(500).json({
          success: false,
          message: "Lỗi server khi lấy tổng quan phí môi giới.",
        });
      }
    },

    async listCommissionPayouts(req, res) {
      try {
        const q = String(req.query.q || "").trim();
        const page = Math.max(1, parseInt(req.query.page || "1", 10));
        const pageSize = Math.min(
          100,
          Math.max(1, parseInt(req.query.pageSize || "20", 10) || 20),
        );

        const where = {};

        if (q) {
          where.OR = [
            { id: { equals: q } },
            { paidByUsername: { contains: q, mode: "insensitive" } },
            { note: { contains: q, mode: "insensitive" } },
          ];
        }

        const [items, total] = await Promise.all([
          prisma.commissionPayout.findMany({
            where,
            orderBy: { paidAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          prisma.commissionPayout.count({ where }),
        ]);

        return res.json({
          success: true,
          items,
          meta: {
            page,
            pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
          },
        });
      } catch (e) {
        console.error("listCommissionPayouts error:", e);
        return res.status(500).json({
          success: false,
          message: "Lỗi server khi lấy lịch sử chuyển phí môi giới.",
        });
      }
    },

    async createCommissionPayout(req, res) {
      try {
        const amount = parseMoneyAmount(req.body?.amount);
        const note = String(req.body?.note || "").trim() || null;
        const actorId = req.admin?.id ?? null;
        const actorUsername = req.admin?.username ?? "admin";

        if (!amount) {
          return res.status(400).json({
            success: false,
            message: "Số tiền chuyển phí môi giới không hợp lệ.",
          });
        }

        const summary = await buildCommissionPayoutSummary();

        if (amount > Number(summary.commissionNeedTransfer || 0)) {
          return res.status(400).json({
            success: false,
            message: "Số tiền nhập lớn hơn số phí môi giới còn cần chuyển.",
          });
        }

        const item = await prisma.commissionPayout.create({
          data: {
            amount,
            note,
            status: "PAID",
            paidAt: new Date(),
            paidByAdminId: actorId,
            paidByUsername: actorUsername,
          },
        });

        return res.json({
          success: true,
          message: "Đã ghi nhận chuyển phí môi giới ngoài đời thật.",
          item,
        });
      } catch (e) {
        console.error("createCommissionPayout error:", e);
        return res.status(500).json({
          success: false,
          message: "Lỗi server khi ghi nhận chuyển phí môi giới.",
        });
      }
    },

    async listUnverifiedCancelledTrips(req, res) {
      try {
        const trips = await prisma.trip.findMany({
          where: { status: "CANCELLED", isVerified: false },
          orderBy: { cancelledAt: "desc" },
          include: {
            stops: {
              orderBy: { seq: "asc" },
            },
          },
          take: 200,
        });

        const items = trips.map((t) => ({
          id: t.id,
          riderName: t.riderName,
          riderPhone: t.riderPhone,
          pickupAddress: t.pickupAddress,
          dropoffAddress: t.dropoffAddress,
          stops: normalizeStops(t.stops),
          pickupTime: t.pickupTime,
          totalPrice: t.totalPrice,
          cancelReason: t.cancelReason,
          cancelledAt: t.cancelledAt,
          isVerified: t.isVerified,
          status: t.status,
          createdAt: t.createdAt,
        }));

        return res.json({ success: true, items });
      } catch (e) {
        console.error("[Admin] listUnverifiedCancelledTrips error:", e);
        return res.status(500).json({ success: false, message: "Lỗi server" });
      }
    },

    async listPendingCancelledTrips(req, res) {
      try {
        const trips = await prisma.trip.findMany({
          where: { status: "CANCELLED", isVerified: true },
          orderBy: { cancelledAt: "desc" },
          include: {
            stops: {
              orderBy: { seq: "asc" },
            },
          },
          take: 200,
        });

        const items = trips.map((t) => ({
          id: t.id,
          riderName: t.riderName,
          riderPhone: t.riderPhone,
          pickupAddress: t.pickupAddress,
          dropoffAddress: t.dropoffAddress,
          stops: normalizeStops(t.stops),
          pickupTime: t.pickupTime,
          totalPrice: t.totalPrice,
          cancelReason: t.cancelReason,
          cancelledAt: t.cancelledAt,
          isVerified: t.isVerified,
          status: t.status,
          createdAt: t.createdAt,
        }));

        return res.json({ success: true, items });
      } catch (e) {
        console.error("[Admin] listPendingCancelledTrips error:", e);
        return res.status(500).json({ success: false, message: "Lỗi server" });
      }
    },

    async listDriverTripPenaltyLogs(req, res) {
      try {
        const status = String(req.query.status || "ALL")
          .trim()
          .toUpperCase();
        const q = String(req.query.q || "").trim();

        const page = Math.max(1, parseInt(req.query.page || "1", 10));
        const pageSize = Math.min(
          100,
          Math.max(1, parseInt(req.query.pageSize || "20", 10) || 20),
        );

        const where = {};

        if (status !== "ALL") {
          where.status = status;
        }

        if (q) {
          where.OR = [
            { id: { equals: q } },
            { tripId: { equals: q } },
            {
              driverNameSnapshot: {
                contains: q,
                mode: "insensitive",
              },
            },
            {
              driverPhoneSnapshot: {
                contains: q,
              },
            },
            {
              tripStatusSnapshot: {
                contains: q,
                mode: "insensitive",
              },
            },
          ];
        }

        const [items, total] = await Promise.all([
          prisma.driverTripPenaltyLog.findMany({
            where,
            orderBy: [{ createdAt: "desc" }],
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          prisma.driverTripPenaltyLog.count({ where }),
        ]);

        return res.json({
          success: true,
          items,
          meta: {
            page,
            pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
          },
        });
      } catch (e) {
        console.error("listDriverTripPenaltyLogs error:", e);
        return res.status(500).json({
          success: false,
          message: "Lỗi server khi lấy danh sách phạt huỷ chuyến.",
        });
      }
    },

    async approveDriverTripPenaltyLog(req, res) {
      try {
        const { id } = req.params;
        const actorId = req.admin?.id ?? null;

        const result = await prisma.$transaction(async (tx) => {
          const penalty = await tx.driverTripPenaltyLog.findUnique({
            where: { id },
            include: {
              driverProfile: {
                select: {
                  id: true,
                  userId: true,
                  balance: true,
                  fullName: true,
                  user: {
                    select: {
                      id: true,
                      displayName: true,
                      phones: {
                        select: {
                          e164: true,
                          isVerified: true,
                          createdAt: true,
                        },
                        orderBy: { createdAt: "desc" },
                        take: 1,
                      },
                    },
                  },
                },
              },
            },
          });

          if (!penalty) {
            const err = new Error("Không tìm thấy log phạt huỷ chuyến.");
            err.statusCode = 404;
            throw err;
          }

          if (String(penalty.status || "").toUpperCase() !== "PENDING") {
            const err = new Error("Chỉ có thể duyệt log phạt đang PENDING.");
            err.statusCode = 400;
            throw err;
          }

          if (!penalty.driverProfile) {
            const err = new Error(
              "Không tìm thấy hồ sơ tài xế cho log phạt này.",
            );
            err.statusCode = 400;
            throw err;
          }

          const penaltyAmount = Number(penalty.penaltyAmount || 0);
          const balanceAfter = Number(penalty.driverProfile.balance || 0);
          const balanceBefore = balanceAfter + penaltyAmount;
          const approvedAt = new Date();

          const approvedPenalty = await tx.driverTripPenaltyLog.update({
            where: { id: penalty.id },
            data: {
              status: "APPROVED",
              approvedAt,
              approvedByAdminId: actorId,
            },
          });

          let walletTxn = null;

          if (penaltyAmount > 0) {
            walletTxn = await tx.driverWalletTransaction.create({
              data: {
                driverProfileId: penalty.driverProfile.id,
                type: "TRIP_CANCEL_PENALTY",
                amount: -penaltyAmount,
                balanceBefore,
                balanceAfter,
                note: `Phạt huỷ chuyến ${penalty.tripId}`,
                tripId: penalty.tripId,
              },
            });
          }

          return {
            penalty: approvedPenalty,
            walletTxn,
            driverUserId: penalty.driverProfile.userId || null,
            penaltyAmount,
            balanceAfter,
            tripId: penalty.tripId,
          };
        });

        if (result.driverUserId) {
          await createDriverWalletNotification({
            req,
            userId: result.driverUserId,
            title: "Phạt huỷ chuyến đã được duyệt",
            message: `Admin đã duyệt khoản phạt huỷ chuyến ${String(
              result.tripId || "",
            ).slice(-8)}. Hệ thống ghi nhận giữ lại ${Number(
              result.penaltyAmount || 0,
            ).toLocaleString("vi-VN")}đ.`,
          });
        }

        emitAdminDashboardChanged(req, {
          source: "driver_trip_penalty_approved",
          driverProfileId: result.penalty.driverProfileId || null,
          updatedAt: new Date().toISOString(),
          status: result.penalty.status,
        });

        return res.json({
          success: true,
          message: "Đã duyệt phạt huỷ chuyến.",
          item: result.penalty,
          walletTxn: result.walletTxn,
        });
      } catch (e) {
        console.error("approveDriverTripPenaltyLog error:", e);
        return res.status(e.statusCode || 500).json({
          success: false,
          message: e.message || "Lỗi server khi duyệt phạt huỷ chuyến.",
        });
      }
    },

    async listLedgerTransactions(req, res) {
      try {
        const q = String(req.query.q || "").trim();
        const type = String(req.query.type || "ALL").toUpperCase();

        const page = Math.max(1, parseInt(req.query.page || "1", 10));
        const pageSize = Math.min(
          100,
          Math.max(1, parseInt(req.query.pageSize || "20", 10) || 20),
        );

        const where = {};

        if (type !== "ALL") {
          where.type = type;
        }

        if (req.query.dateFrom || req.query.dateTo) {
          where.createdAt = {};

          if (req.query.dateFrom) {
            where.createdAt.gte = new Date(req.query.dateFrom);
          }

          if (req.query.dateTo) {
            where.createdAt.lte = new Date(req.query.dateTo);
          }
        }

        if (q) {
          where.OR = [
            {
              driverProfile: {
                fullName: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            },
            {
              driverProfile: {
                user: {
                  displayName: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              driverProfile: {
                user: {
                  phones: {
                    some: {
                      e164: {
                        contains: q,
                      },
                    },
                  },
                },
              },
            },
            {
              note: {
                contains: q,
                mode: "insensitive",
              },
            },
            {
              tripId: {
                equals: q,
              },
            },
            {
              withdrawRequestId: {
                equals: q,
              },
            },
          ];
        }

        const items = await prisma.driverWalletTransaction.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            trip: {
              select: {
                id: true,
                pickupAddress: true,
                dropoffAddress: true,
                totalPrice: true,
              },
            },
            withdrawRequest: {
              select: {
                id: true,
                amount: true,
                status: true,
                createdAt: true,
                paidAt: true,
              },
            },
            driverProfile: {
              select: {
                id: true,
                fullName: true,
                user: {
                  select: {
                    displayName: true,
                    phones: {
                      select: {
                        e164: true,
                        isVerified: true,
                        createdAt: true,
                      },
                      orderBy: { createdAt: "desc" },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        });

        const total = await prisma.driverWalletTransaction.count({ where });

        return res.json({
          success: true,
          items,
          meta: {
            page,
            pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
          },
        });
      } catch (e) {
        console.error("listLedgerTransactions error:", e);
        return res.status(500).json({
          success: false,
          message: "Lỗi server khi lấy sổ giao dịch ví.",
        });
      }
    },

    async getLedgerSummary(req, res) {
      try {
        const [
          walletAgg,
          commissionHold,
          commissionRefund,
          withdrawPending,
          withdrawApproved,
          withdrawPaid,
        ] = await Promise.all([
          prisma.driverProfile.aggregate({
            _sum: { balance: true },
            _count: { id: true },
          }),
          prisma.driverWalletTransaction.aggregate({
            where: { type: "COMMISSION_HOLD" },
            _sum: { amount: true },
          }),
          prisma.driverWalletTransaction.aggregate({
            where: { type: "COMMISSION_REFUND" },
            _sum: { amount: true },
          }),
          prisma.driverWithdrawRequest.aggregate({
            where: { status: "PENDING" },
            _sum: { amount: true },
            _count: { id: true },
          }),
          prisma.driverWithdrawRequest.aggregate({
            where: { status: "APPROVED" },
            _sum: { amount: true },
            _count: { id: true },
          }),
          prisma.driverWithdrawRequest.aggregate({
            where: { status: "PAID" },
            _sum: { amount: true },
            _count: { id: true },
          }),
        ]);

        return res.json({
          success: true,
          summary: {
            walletBalanceTotal: Number(walletAgg._sum.balance || 0),
            driverCount: Number(walletAgg._count.id || 0),

            commissionHold: Number(commissionHold._sum.amount || 0),
            commissionRefund: Number(commissionRefund._sum.amount || 0),

            withdrawPendingTotal: Number(withdrawPending._sum.amount || 0),
            withdrawPendingCount: Number(withdrawPending._count.id || 0),

            withdrawApprovedTotal: Number(withdrawApproved._sum.amount || 0),
            withdrawApprovedCount: Number(withdrawApproved._count.id || 0),

            withdrawPaidTotal: Number(withdrawPaid._sum.amount || 0),
            withdrawPaidCount: Number(withdrawPaid._count.id || 0),
          },
        });
      } catch (e) {
        console.error("getLedgerSummary error:", e);
        return res.status(500).json({
          success: false,
          message: "Lỗi server khi lấy tổng quan sổ sách.",
        });
      }
    },

    async listTripAccountingRows(req, res) {
      try {
        const quarter = Number(req.query?.quarter || 1);
        const year = Number(req.query?.year || new Date().getFullYear());

        const {
          start,
          end,
          quarter: safeQuarter,
          year: safeYear,
        } = getQuarterDateRange(year, quarter);

        const [completedTrips, approvedPenaltyLogs] = await Promise.all([
          prisma.trip.findMany({
            where: {
              status: "COMPLETED",
              updatedAt: {
                gte: start,
                lte: end,
              },
            },
            select: {
              id: true,
              updatedAt: true,
              status: true,
              totalPrice: true,
              carType: true,
              direction: true,

              commissionAmountSnapshot: true,
              driverVatAmountSnapshot: true,
              driverPitAmountSnapshot: true,
              driverTaxTotalSnapshot: true,
              requiredWalletAmountSnapshot: true,
              driverReceiveSnapshot: true,

              // ✅ FIX ĐÚNG CHỖ NÀY
              driver: {
                select: {
                  displayName: true,
                  phones: {
                    select: { e164: true },
                    orderBy: { createdAt: "asc" },
                    take: 1,
                  },
                  driverProfile: {
                    select: {
                      fullName: true,
                    },
                  },
                },
              },

              // rider để chuẩn luôn
              rider: {
                select: {
                  displayName: true,
                  phones: {
                    select: { e164: true },
                    orderBy: { createdAt: "asc" },
                    take: 1,
                  },
                  riderProfile: {
                    select: {
                      fullName: true,
                    },
                  },
                },
              },

              riderName: true,
              riderPhone: true,
            },
            orderBy: {
              updatedAt: "desc",
            },
          }),

          prisma.driverTripPenaltyLog.findMany({
            where: {
              status: "APPROVED",
              approvedAt: {
                gte: start,
                lte: end,
              },
            },
            select: {
              id: true,
              tripId: true,
              penaltyAmount: true,
              status: true,
              createdAt: true,
              approvedAt: true,
              driverNameSnapshot: true,
              driverPhoneSnapshot: true,
              tripStatusSnapshot: true,
              trip: {
                select: {
                  id: true,
                  carType: true,
                  direction: true,
                  driver: {
                    select: {
                      displayName: true,
                      phones: {
                        select: {
                          e164: true,
                          createdAt: true,
                        },
                        orderBy: { createdAt: "asc" },
                        take: 1,
                      },
                      driverProfile: {
                        select: {
                          fullName: true,
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy: {
              approvedAt: "desc",
            },
          }),
        ]);

        const completedRows = completedTrips.map(
          buildCompletedTripAccountingRow,
        );
        const penaltyRows = approvedPenaltyLogs.map(
          buildPenaltyTripAccountingRow,
        );

        const items = [...completedRows, ...penaltyRows].sort((a, b) => {
          const timeA = new Date(a.eventAt || 0).getTime();
          const timeB = new Date(b.eventAt || 0).getTime();
          return timeB - timeA;
        });

        return res.json({
          success: true,
          items,
          meta: {
            quarter: safeQuarter,
            year: safeYear,
            start,
            end,
            completedCount: completedRows.length,
            penaltyCount: penaltyRows.length,
            total: items.length,
          },
        });
      } catch (e) {
        console.error("listTripAccountingRows error:", e);
        return res.status(500).json({
          success: false,
          message: "Lỗi server khi lấy dữ liệu tab Chuyến đi.",
        });
      }
    },

    async getAccountingSummary(req, res) {
      try {
        const quarter = Number(req.query?.quarter || 1);
        const year = Number(req.query?.year || new Date().getFullYear());

        const {
          start,
          end,
          quarter: safeQuarter,
          year: safeYear,
        } = getQuarterDateRange(year, quarter);

        // ===============================
        // 1. COMPLETED TRIPS
        // ===============================
        const completedAgg = await prisma.trip.aggregate({
          where: {
            status: "COMPLETED",
            updatedAt: {
              gte: start,
              lte: end,
            },
          },
          _sum: {
            totalPrice: true,
            commissionAmountSnapshot: true,
            driverVatAmountSnapshot: true,
            driverPitAmountSnapshot: true,
            requiredWalletAmountSnapshot: true,
            driverReceiveSnapshot: true,
          },
          _count: { id: true },
        });

        // ===============================
        // 2. PENALTY
        // ===============================
        const penaltyAgg = await prisma.driverTripPenaltyLog.aggregate({
          where: {
            status: "APPROVED",
            approvedAt: {
              gte: start,
              lte: end,
            },
          },
          _sum: {
            penaltyAmount: true,
          },
          _count: { id: true },
        });

        // ===============================
        // 3. COMPANY CASH
        // ===============================
        const cashItems = await prisma.companyCashTransaction.findMany({
          where: {
            txnDate: {
              gte: start,
              lte: end,
            },
          },
          select: {
            type: true,
            category: true,
            amount: true,
          },
        });

        let totalIn = 0;
        let totalOut = 0;
        let driverTopupTotal = 0;
        let driverWithdrawPaidTotal = 0;

        cashItems.forEach((i) => {
          const amount = Number(i.amount || 0);

          if (i.type === "IN") totalIn += amount;
          if (i.type === "OUT") totalOut += amount;

          if (i.category === "DRIVER_TOPUP") {
            driverTopupTotal += amount;
          }

          if (i.category === "DRIVER_WITHDRAW") {
            driverWithdrawPaidTotal += amount;
          }
        });

        // ===============================
        // FINAL SUMMARY
        // ===============================
        const summary = {
          quarter: safeQuarter,
          year: safeYear,
          items: [
            {
              key: "completed_trip_total",
              label: "Tổng giá trị chuyến hoàn thành",
              value: Number(completedAgg._sum.totalPrice || 0),
            },
            {
              key: "commission_total",
              label: "Tổng phí môi giới công ty thu được",
              value: Number(completedAgg._sum.commissionAmountSnapshot || 0),
            },
            {
              key: "driver_vat_total",
              label: "Tổng VAT tài xế",
              value: Number(completedAgg._sum.driverVatAmountSnapshot || 0),
            },
            {
              key: "driver_pit_total",
              label: "Tổng PIT tài xế",
              value: Number(completedAgg._sum.driverPitAmountSnapshot || 0),
            },
            {
              key: "driver_deduction_total",
              label: "Tổng khấu trừ ví tài xế",
              value: Number(
                completedAgg._sum.requiredWalletAmountSnapshot || 0,
              ),
            },
            {
              key: "driver_receive_total",
              label: "Tổng tiền tài xế thực nhận",
              value: Number(completedAgg._sum.driverReceiveSnapshot || 0),
            },
            {
              key: "cancel_penalty_total",
              label: "Tổng phạt huỷ chuyến đã thu",
              value: Number(penaltyAgg._sum.penaltyAmount || 0),
            },
            {
              key: "cancel_penalty_count",
              label: "Số lượt phạt huỷ chuyến",
              value: Number(penaltyAgg._count.id || 0),
            },
            {
              key: "driver_topup_total",
              label: "Tổng tiền tài xế nạp ví",
              value: driverTopupTotal,
            },
            {
              key: "driver_withdraw_paid_total",
              label: "Tổng tiền tài xế rút ví đã chi",
              value: driverWithdrawPaidTotal,
            },
            {
              key: "company_cash_in_total",
              label: "Tổng thu công ty",
              value: totalIn,
            },
            {
              key: "company_cash_out_total",
              label: "Tổng chi công ty",
              value: totalOut,
            },
            {
              key: "company_cash_balance",
              label: "Chênh lệch thu chi công ty",
              value: totalIn - totalOut,
            },
          ],
        };

        return res.json({
          success: true,
          summary,
        });
      } catch (e) {
        console.error("getAccountingSummary error:", e);
        return res.status(500).json({
          success: false,
          message: "Lỗi server khi lấy summary kế toán.",
        });
      }
    },

    async getAccountingExportPreview(req, res) {
      try {
        const quarter = Number(req.query?.quarter || 0);
        const year = Number(req.query?.year || 0);

        if (![1, 2, 3, 4].includes(quarter)) {
          return res.status(400).json({
            success: false,
            message: "Quý không hợp lệ. Vui lòng chọn từ 1 đến 4.",
          });
        }

        if (!Number.isInteger(year) || year < 2000 || year > 2100) {
          return res.status(400).json({
            success: false,
            message: "Năm không hợp lệ.",
          });
        }

        const data = await getAccountingExportPreviewGroups({
          quarter,
          year,
        });

        return res.json({
          success: true,
          data,
        });
      } catch (err) {
        console.error("getAccountingExportPreview error", err);
        return res.status(500).json({
          success: false,
          message: "Lỗi lấy dữ liệu xem trước export kế toán.",
        });
      }
    },

    async getAccountingExportPackage(req, res) {
      try {
        const quarter = Number(req.query?.quarter || 0);
        const year = Number(req.query?.year || 0);

        if (![1, 2, 3, 4].includes(quarter)) {
          return res.status(400).json({
            success: false,
            message: "Quý không hợp lệ. Vui lòng chọn từ 1 đến 4.",
          });
        }

        if (!Number.isInteger(year) || year < 2000 || year > 2100) {
          return res.status(400).json({
            success: false,
            message: "Năm không hợp lệ.",
          });
        }

        const data = await getAccountingExportPackageData({
          quarter,
          year,
        });

        return res.json({
          success: true,
          data,
        });
      } catch (err) {
        console.error("getAccountingExportPackage error", err);
        return res.status(500).json({
          success: false,
          message: "Lỗi chuẩn bị dữ liệu export kế toán.",
        });
      }
    },

    async exportAccountingZip(req, res) {
      try {
        const quarter = Number(req.query?.quarter || 0);
        const year = Number(req.query?.year || 0);

        if (![1, 2, 3, 4].includes(quarter)) {
          return res.status(400).json({
            success: false,
            message: "Quý không hợp lệ. Vui lòng chọn từ 1 đến 4.",
          });
        }

        if (!Number.isInteger(year) || year < 2000 || year > 2100) {
          return res.status(400).json({
            success: false,
            message: "Năm không hợp lệ.",
          });
        }

        const {
          start,
          end,
          quarter: safeQuarter,
          year: safeYear,
        } = getQuarterDateRange(year, quarter);

        const packageData = await getAccountingExportPackageData({
          quarter: safeQuarter,
          year: safeYear,
        });

        const zipFileName =
          packageData?.zipFileName ||
          `ViNaLighthouse_goviet247_ke_toan_Q${safeQuarter}_${safeYear}.zip`;

        // Build hết nội dung trước, tránh đang stream mới lỗi giữa chừng làm ZIP bị corrupt
        const readmeText = buildAccountingExportReadme({
          ...packageData,
          adminUsername: req.admin?.username || req.user?.username || "admin",
        });

        const companyCashCsv = await buildCompanyCashCsvForQuarter({
          start,
          end,
        });

        const driverWalletCsv = await buildDriverWalletCsvForQuarter({
          start,
          end,
        });

        const tripAccountingCsv = await buildTripAccountingCsvForQuarter({
          start,
          end,
        });

        const driverWithdrawCsv = await buildDriverWithdrawCsvForQuarter({
          start,
          end,
        });

        const revenueReportCsv = await buildRevenueReportCsvForQuarter({
          start,
          end,
        });

        const accountingNotesCsv = await buildAccountingNotesCsvForQuarter({
          quarter: safeQuarter,
          year: safeYear,
        });

        res.setHeader("Content-Type", "application/zip");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${zipFileName}"`,
        );

        const archive = archiver("zip", {
          zlib: { level: 9 },
        });

        const streamDonePromise = new Promise((resolve, reject) => {
          archive.on("warning", (err) => {
            console.warn("exportAccountingZip warning:", err);
          });

          archive.on("error", (err) => {
            console.error("exportAccountingZip archive error:", err);
            reject(err);
          });

          archive.on("end", () => {
            console.log(
              "exportAccountingZip archive end, bytes:",
              archive.pointer(),
            );
          });

          res.on("finish", () => {
            console.log("exportAccountingZip finish");
            resolve();
          });

          res.on("close", () => {
            console.log("exportAccountingZip close");
          });

          res.on("error", (err) => {
            console.error("exportAccountingZip response error:", err);
            reject(err);
          });
        });

        archive.pipe(res);

        archive.append(readmeText, { name: "README.txt" });

        await appendAccountingDocumentsToArchive({
          archive,
          quarter: safeQuarter,
          year: safeYear,
          documentType: "BANK_STATEMENT",
          folderName: "01-sao-ke-ngan-hang",
        });

        await appendAccountingDocumentsToArchive({
          archive,
          quarter: safeQuarter,
          year: safeYear,
          documentType: "INPUT_INVOICE",
          folderName: "02-hoa-don-dau-vao",
        });

        await appendAccountingDocumentsToArchive({
          archive,
          quarter: safeQuarter,
          year: safeYear,
          documentType: "OUTPUT_INVOICE",
          folderName: "03-hoa-don-dau-ra",
        });

        archive.append(companyCashCsv, {
          name: `04-thu-chi-cong-ty/thu_chi_cong_ty_Q${safeQuarter}_${safeYear}.csv`,
        });

        archive.append(driverWalletCsv, {
          name: `05-vi-tai-xe/vi_tai_xe_Q${safeQuarter}_${safeYear}.csv`,
        });

        archive.append(tripAccountingCsv, {
          name: `06-chuyen-di/chuyen_di_Q${safeQuarter}_${safeYear}.csv`,
        });

        archive.append(driverWithdrawCsv, {
          name: `07-tai-xe-rut-vi/tai_xe_rut_vi_Q${safeQuarter}_${safeYear}.csv`,
        });

        await appendAccountingDocumentsToArchive({
          archive,
          quarter: safeQuarter,
          year: safeYear,
          documentType: "PAYROLL_HR",
          folderName: "08-luong-nhan-su",
        });

        await appendAccountingDocumentsToArchive({
          archive,
          quarter: safeQuarter,
          year: safeYear,
          documentType: "LEGAL_CONTRACT",
          folderName: "09-hop-dong-phap-ly",
        });

        archive.append(revenueReportCsv, {
          name: `10-bao-cao-doanh-thu-loi-nhuan/bao_cao_doanh_thu_loi_nhuan_Q${safeQuarter}_${safeYear}.csv`,
        });

        archive.append(accountingNotesCsv, {
          name: `11-ghi-chu-ke-toan/ghi_chu_ke_toan_Q${safeQuarter}_${safeYear}.csv`,
        });

        await archive.finalize();
        await streamDonePromise;
      } catch (err) {
        console.error("exportAccountingZip error", err);

        if (!res.headersSent) {
          return res.status(500).json({
            success: false,
            message: "Lỗi export file ZIP kế toán.",
          });
        }

        try {
          res.destroy(err);
        } catch {
          // ignore
        }
      }
    },

    async listAccountingDocuments(req, res) {
      try {
        const documentType = String(req.query.documentType || "").trim();
        const quarter = parseInt(req.query.quarter || "0", 10);
        const year = parseInt(req.query.year || "0", 10);

        if (!documentType || !quarter || !year) {
          return res.status(400).json({
            success: false,
            message: "Thiếu documentType / quarter / year.",
          });
        }

        const items = await prisma.accountingDocument.findMany({
          where: {
            documentType,
            quarter,
            year,
          },
          orderBy: { createdAt: "desc" },
        });

        return res.json({
          success: true,
          items,
        });
      } catch (err) {
        console.error("listAccountingDocuments error", err);
        return res.status(500).json({
          success: false,
          message: "Lỗi lấy danh sách tài liệu kế toán.",
        });
      }
    },

    async createAccountingDocument(req, res) {
      try {
        const { documentType, title, description, quarter, year, month } =
          req.body;

        if (!documentType || !title || !quarter || !year) {
          return res.status(400).json({
            success: false,
            message: "Thiếu dữ liệu bắt buộc.",
          });
        }

        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: "Vui lòng chọn file upload.",
          });
        }

        if (!req.file.buffer) {
          return res.status(400).json({
            success: false,
            message: "File upload không hợp lệ.",
          });
        }

        const admin = req.admin || {};
        const safeQuarter = Number(quarter);
        const safeYear = Number(year);

        const uploadedByAdminId =
          admin.id === undefined || admin.id === null ? null : String(admin.id);

        const s3Key = buildS3Key({
          year: safeYear,
          quarter: safeQuarter,
          fileName: req.file.originalname,
        });

        await uploadBufferToS3({
          buffer: req.file.buffer,
          key: s3Key,
          contentType: req.file.mimetype,
        });

        const item = await prisma.accountingDocument.create({
          data: {
            documentType,
            title,
            description: description || null,
            quarter: safeQuarter,
            year: safeYear,
            month: month ? Number(month) : null,
            fileName: req.file.originalname,
            filePath: s3Key,
            mimeType: req.file.mimetype,
            fileSize: req.file.size,
            uploadedByAdminId,
            uploadedByUsername: admin.username || null,
          },
        });

        return res.json({
          success: true,
          item,
        });
      } catch (err) {
        console.error("createAccountingDocument error", err);
        return res.status(500).json({
          success: false,
          message: "Lỗi upload tài liệu kế toán.",
        });
      }
    },

    async deleteAccountingDocument(req, res) {
      try {
        const { id } = req.params;

        const existed = await prisma.accountingDocument.findUnique({
          where: { id },
          select: {
            id: true,
            filePath: true,
          },
        });

        if (!existed) {
          return res.status(404).json({
            success: false,
            message: "Không tìm thấy tài liệu kế toán.",
          });
        }

        const s3Key = String(existed.filePath || "").trim();

        await prisma.accountingDocument.delete({
          where: { id },
        });

        if (s3Key) {
          try {
            await deleteObjectFromS3(s3Key);
          } catch (s3Error) {
            console.error(
              "deleteAccountingDocument deleteObjectFromS3 error:",
              {
                id,
                s3Key,
                error: s3Error,
              },
            );
          }
        }

        return res.json({
          success: true,
        });
      } catch (err) {
        console.error("deleteAccountingDocument error", err);
        return res.status(500).json({
          success: false,
          message: "Lỗi xoá tài liệu kế toán.",
        });
      }
    },

    async listAccountingNotes(req, res) {
      try {
        const quarter = Number(req.query?.quarter || 1);
        const year = Number(req.query?.year || new Date().getFullYear());

        const items = await prisma.accountingNote.findMany({
          where: {
            quarter,
            year,
          },
          orderBy: { createdAt: "desc" },
        });

        return res.json({
          success: true,
          items,
        });
      } catch (err) {
        console.error("listAccountingNotes error", err);
        return res.status(500).json({
          success: false,
          message: "Lỗi lấy ghi chú kế toán.",
        });
      }
    },

    async createAccountingNote(req, res) {
      try {
        const { title, content, quarter, year } = req.body;

        if (!title || !content || !quarter || !year) {
          return res.status(400).json({
            success: false,
            message: "Thiếu dữ liệu bắt buộc.",
          });
        }

        const admin = req.admin || {};

        const item = await prisma.accountingNote.create({
          data: {
            title,
            content,
            quarter: Number(quarter),
            year: Number(year),
            createdByAdminId: admin.id || null,
            createdByUsername: admin.username || null,
          },
        });

        return res.json({
          success: true,
          item,
        });
      } catch (err) {
        console.error("createAccountingNote error", err);
        return res.status(500).json({
          success: false,
          message: "Lỗi tạo ghi chú kế toán.",
        });
      }
    },

    async deleteAccountingNote(req, res) {
      try {
        const { id } = req.params;

        await prisma.accountingNote.delete({
          where: { id },
        });

        return res.json({
          success: true,
        });
      } catch (err) {
        console.error("deleteAccountingNote error", err);
        return res.status(500).json({
          success: false,
          message: "Lỗi xoá ghi chú kế toán.",
        });
      }
    },

    async exportAccountingNotesCsv(req, res) {
      try {
        const quarter = Number(req.query?.quarter || 1);
        const year = Number(req.query?.year || new Date().getFullYear());

        const { quarter: safeQuarter, year: safeYear } = getQuarterDateRange(
          year,
          quarter,
        );

        const csv = await buildAccountingNotesCsvForQuarter({
          quarter: safeQuarter,
          year: safeYear,
        });

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="ghi_chu_ke_toan_Q${safeQuarter}_${safeYear}.csv"`,
        );

        return res.send(csv);
      } catch (err) {
        console.error("exportAccountingNotesCsv error", err);
        return res.status(500).json({
          success: false,
          message: "Lỗi export CSV ghi chú kế toán.",
        });
      }
    },

    async listCompanyCashTransactions(req, res) {
      try {
        const { fromDate, toDate, type, category } = req.query;

        const where = {};

        if (fromDate || toDate) {
          where.txnDate = {};
          if (fromDate) where.txnDate.gte = new Date(fromDate);
          if (toDate) where.txnDate.lte = new Date(toDate);
        }

        if (type) where.type = type;
        if (category) where.category = category;

        const items = await prisma.companyCashTransaction.findMany({
          where,
          orderBy: { txnDate: "desc" },
        });

        return res.json({
          success: true,
          items,
        });
      } catch (err) {
        console.error("listCompanyCashTransactions error", err);
        return res.status(500).json({
          success: false,
          message: "Lỗi lấy danh sách thu chi công ty.",
        });
      }
    },

    async createCompanyCashTransaction(req, res) {
      try {
        const { txnDate, type, category, amount, note, source, referenceCode } =
          req.body;

        if (!txnDate || !type || !category || !amount) {
          return res.status(400).json({
            success: false,
            message: "Thiếu dữ liệu bắt buộc.",
          });
        }

        const admin = req.admin || {};

        const item = await prisma.companyCashTransaction.create({
          data: {
            txnDate: new Date(txnDate),
            type,
            category,
            amount: Number(amount),
            note: note || null,
            source: source || null,
            referenceCode: referenceCode || null,
            createdByAdminId: admin.id || null,
            createdByUsername: admin.username || null,
          },
        });

        return res.json({
          success: true,
          item,
        });
      } catch (err) {
        console.error("createCompanyCashTransaction error", err);
        return res.status(500).json({
          success: false,
          message: "Lỗi tạo thu chi công ty.",
        });
      }
    },

    async deleteCompanyCashTransaction(req, res) {
      try {
        const { id } = req.params;

        await prisma.companyCashTransaction.delete({
          where: { id },
        });

        return res.json({
          success: true,
        });
      } catch (err) {
        console.error("deleteCompanyCashTransaction error", err);
        return res.status(500).json({
          success: false,
          message: "Lỗi xoá thu chi.",
        });
      }
    },

    async getCompanyCashSummary(req, res) {
      try {
        const { fromDate, toDate } = req.query;

        const where = {};

        if (fromDate || toDate) {
          where.txnDate = {};
          if (fromDate) where.txnDate.gte = new Date(fromDate);
          if (toDate) where.txnDate.lte = new Date(toDate);
        }

        const items = await prisma.companyCashTransaction.findMany({
          where,
        });

        let totalIn = 0;
        let totalOut = 0;

        items.forEach((i) => {
          if (i.type === "IN") totalIn += i.amount;
          else totalOut += i.amount;
        });

        return res.json({
          success: true,
          summary: {
            totalIn,
            totalOut,
            balance: totalIn - totalOut,
          },
        });
      } catch (err) {
        console.error("getCompanyCashSummary error", err);
        return res.status(500).json({
          success: false,
          message: "Lỗi tổng hợp thu chi.",
        });
      }
    },

    async exportCompanyCashTransactions(req, res) {
      try {
        const { fromDate, toDate } = req.query;

        const where = {};

        if (fromDate || toDate) {
          where.txnDate = {};
          if (fromDate) where.txnDate.gte = new Date(fromDate);
          if (toDate) where.txnDate.lte = new Date(toDate);
        }

        const items = await prisma.companyCashTransaction.findMany({
          where,
          orderBy: { txnDate: "asc" },
        });

        const header = [
          "Ngày",
          "Loại",
          "Nhóm",
          "Số tiền",
          "Ghi chú",
          "Nguồn",
          "Mã tham chiếu",
          "Người tạo",
        ];

        const rows = items.map((i) => [
          new Date(i.txnDate).toISOString(),
          i.type,
          i.category,
          i.amount,
          i.note || "",
          i.source || "",
          i.referenceCode || "",
          i.createdByUsername || "",
        ]);

        const csv = [header, ...rows].map((row) => row.join(",")).join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="cash_transactions.csv"`,
        );

        return res.send(csv);
      } catch (err) {
        console.error("exportCompanyCashTransactions error", err);
        return res.status(500).json({
          success: false,
          message: "Lỗi export CSV.",
        });
      }
    },

    async getRevenueReport(req, res) {
      try {
        const quarter = Number(req.query?.quarter || 1);
        const year = Number(req.query?.year || new Date().getFullYear());

        const { start, end } = getQuarterDateRange(year, quarter);

        // ===============================
        // 1. REVENUE
        // ===============================
        const completedAgg = await prisma.trip.aggregate({
          where: {
            status: "COMPLETED",
            updatedAt: { gte: start, lte: end },
          },
          _sum: {
            commissionAmountSnapshot: true,
            totalPrice: true,
          },
          _count: { id: true },
        });

        const penaltyAgg = await prisma.driverTripPenaltyLog.aggregate({
          where: {
            status: "APPROVED",
            approvedAt: { gte: start, lte: end },
          },
          _sum: { penaltyAmount: true },
          _count: { id: true },
        });

        const commission = Number(
          completedAgg._sum.commissionAmountSnapshot || 0,
        );
        const penalty = Number(penaltyAgg._sum.penaltyAmount || 0);

        const revenueTotal = commission + penalty;

        // ===============================
        // 2. EXPENSE
        // ===============================
        const EXPENSE_CATEGORIES = [
          "MARKETING",
          "AWS",
          "SERVER",
          "SALARY",
          "OPERATIONS",
          "OWNER_WITHDRAW",
          "OTHER_OUT",
          "REFUND", // tạm tính là chi phí
        ];

        const cashItems = await prisma.companyCashTransaction.findMany({
          where: {
            type: "OUT",
            category: {
              in: EXPENSE_CATEGORIES,
            },
            txnDate: { gte: start, lte: end },
          },
          select: {
            category: true,
            amount: true,
          },
        });

        let expenseTotal = 0;
        const byCategory = {};

        cashItems.forEach((i) => {
          const amount = Number(i.amount || 0);
          expenseTotal += amount;

          if (!byCategory[i.category]) {
            byCategory[i.category] = 0;
          }

          byCategory[i.category] += amount;
        });

        // ===============================
        // 3. PROFIT
        // ===============================
        const profit = revenueTotal - expenseTotal;

        return res.json({
          success: true,
          data: {
            revenue: {
              commission,
              penalty,
              total: revenueTotal,
            },
            expense: {
              total: expenseTotal,
              byCategory,
            },
            profit: {
              amount: profit,
            },
            meta: {
              totalCompletedTrips: Number(completedAgg._count.id || 0),
              totalTripValue: Number(completedAgg._sum.totalPrice || 0),
              totalPenalties: Number(penaltyAgg._count.id || 0),
            },
          },
        });
      } catch (e) {
        console.error("getRevenueReport error:", e);
        return res.status(500).json({
          success: false,
          message: "Lỗi server khi lấy báo cáo doanh thu.",
        });
      }
    },
  };
}
