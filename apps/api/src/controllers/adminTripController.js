// Path: goviet247/apps/api/src/controllers/adminTripController.js
import { lockDriverProfile, lockTrip } from "../services/tripAcceptancePolicy.js";
import { refundCustomerCancellationHold } from "../services/customerCancellationRefund.js";
import { prisma } from "../utils/db.js";
import {
  sendAdminPushNotification,
  sendSystemNotificationToDriver,
  sendTripStatusChangedToRider,
} from "../services/notificationService.js";

// Acceptance already debits the wallet. A penalty is an accounting
// classification of that debit, so never create a second wallet debit here.
async function recordAdminCancellationPenalty(tx, trip, actorId) {
  const profile = trip.driver?.driverProfile;
  const amount = Number(trip.requiredWalletAmountSnapshot || 0) ||
    Number(trip.commissionAmountSnapshot || 0) +
    Number(trip.driverVatAmountSnapshot || 0) +
    Number(trip.driverPitAmountSnapshot || 0);
  if (!trip.driverId || !profile || amount <= 0) return null;
  return tx.driverTripPenaltyLog.create({
    data: {
      tripId: trip.id, driverId: trip.driverId, driverProfileId: profile.id,
      driverNameSnapshot: profile.fullName || trip.driver?.displayName || null,
      driverPhoneSnapshot: trip.driver?.phones?.[0]?.e164 || null,
      tripStatusSnapshot: trip.status,
      verifiedByIdSnapshot: trip.verifiedById || null,
      verifiedAtSnapshot: trip.verifiedAt || null,
      penaltyAmount: amount, status: "APPROVED",
      approvedAt: new Date(), approvedByAdminId: actorId,
    },
  });
}

// POST /api/admin/trips/:id/driver-cancel-to-review
// Admin can release a trip accepted by the wrong driver. The hold was charged
// when the driver accepted; this action records the penalty without another wallet debit.
export async function adminDriverCancelToReview(req, res) {
  const tripId = String(req.params.id || "").trim();
  const reason = String(req.body?.reason || "").trim();
  if (!tripId || !reason) {
    return res.status(400).json({ success: false, message: "Cần mã chuyến và lý do tài xế nhận nhầm." });
  }

  try {
    // Lock in the same order as driver cancellation and acceptance: profile, trip.
    const snapshot = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { driverId: true },
    });
    if (!snapshot?.driverId) {
      return res.status(409).json({ success: false, message: "Chuyến không còn tài xế đang giữ. Vui lòng tải lại." });
    }

    const result = await prisma.$transaction(async (tx) => {
      await lockDriverProfile(tx, snapshot.driverId);
      await lockTrip(tx, tripId);
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        include: {
          driver: { include: { phones: { orderBy: { createdAt: "asc" }, take: 1 }, driverProfile: true } },
        },
      });
      if (!trip || trip.driverId !== snapshot.driverId ||
          !["ACCEPTED", "CONTACTED"].includes(trip.status) || trip.cancelledAt) {
        const error = new Error("Chỉ được đưa chuyến chưa đón khách về Chờ duyệt để tìm tài xế khác. Vui lòng tải lại.");
        error.statusCode = 409;
        throw error;
      }

      const profile = trip.driver?.driverProfile;
      if (!profile) {
        const error = new Error("Không tìm thấy ví tài xế; chuyến chưa được thay đổi.");
        error.statusCode = 409;
        throw error;
      }
      const heldAmount = Number(trip.requiredWalletAmountSnapshot || 0) ||
        Number(trip.commissionAmountSnapshot || 0) +
        Number(trip.driverVatAmountSnapshot || 0) +
        Number(trip.driverPitAmountSnapshot || 0);
      const actor = req.admin;
      const penaltyLog = await recordAdminCancellationPenalty(tx, trip, actor?.id ?? null);

      const changed = await tx.trip.updateMany({
        where: { id: tripId, driverId: trip.driverId, status: trip.status, cancelledAt: null },
        data: {
          version: { increment: 1 }, status: "PENDING", driverId: null,
          acceptedAt: null, isVerified: false, verifiedAt: null,
          verifiedById: null, verifiedNote: `Tài xế huỷ, admin đưa về chờ duyệt: ${reason.slice(0, 300)}`,
          driverAcceptOpenAt: null, cancelledAt: null,
          cancelReason: `Tài xế huỷ chuyến do admin xử lý: ${reason.slice(0, 300)}`,
          commissionPercentSnapshot: null, commissionAmountSnapshot: null,
          driverVatPercentSnapshot: null, driverPitPercentSnapshot: null,
          driverVatBaseModeSnapshot: null, driverPitBaseModeSnapshot: null,
          driverVatAmountSnapshot: null, driverPitAmountSnapshot: null,
          driverTaxTotalSnapshot: null, requiredWalletAmountSnapshot: null,
          driverReceiveSnapshot: null,
        },
      });
      if (changed.count !== 1) {
        const error = new Error("Chuyến vừa thay đổi. Vui lòng tải lại.");
        error.statusCode = 409;
        throw error;
      }
      const updated = await tx.trip.findUnique({ where: { id: tripId } });
      const actionLog = await tx.adminTripActionLog.create({
        data: {
          tripId, fromStatus: trip.status, toStatus: "PENDING",
          actorRole: actor?.role || "ADMIN", actorId: actor?.id ?? null,
          actorUsername: actor?.username || "admin",
          note: `Tài xế huỷ, admin đưa chuyến về Chờ duyệt. Lý do: ${reason.slice(0, 400)}. Ghi nhận phạt huỷ ${penaltyLog?.penaltyAmount || 0}đ từ khoản đã khấu trừ; không trừ ví thêm.`,
        },
      });
      const driverNotification = await tx.systemNotification.create({
        data: {
          audience: "DRIVER", targetType: "USER", targetUserId: trip.driverId,
          title: "Chuyến đã được chuyển về chờ duyệt",
          message: `Admin đã chuyển chuyến #${tripId.slice(-8).toUpperCase()} về chờ duyệt vì bạn huỷ chuyến. Khoản đã khấu trừ khi nhận chuyến được ghi nhận là phạt và không tự hoàn. Lý do: ${reason.slice(0, 200)}. [tripId:${tripId}]`,
          isActive: true, createdByAdminId: actor?.id ?? null,
        },
      });
      const riderNotification = trip.riderId ? await tx.systemNotification.create({
        data: {
          audience: "RIDER", targetType: "USER", targetUserId: trip.riderId,
          title: "Chuyến đang được tìm tài xế khác",
          message: `Tài xế trước không thể tiếp tục chuyến #${tripId.slice(-8).toUpperCase()}. Admin đang kiểm tra để tìm tài xế khác. [tripId:${tripId}]`,
          isActive: true, createdByAdminId: actor?.id ?? null,
        },
      }) : null;
      return { trip: updated, previousDriverId: trip.driverId, previousStatus: trip.status,
        heldAmount, actionLog, driverNotification, riderNotification };
    });

    const event = {
      tripId, fromStatus: result.previousStatus, toStatus: "PENDING",
      status: "PENDING", driverId: null, previousDriverId: result.previousDriverId,
      isVerified: false, updatedAt: result.trip.updatedAt,
      reason: "admin_driver_cancel_to_review",
    };
    const io = req.app?.get?.("io");
    if (io) {
      io.to("admins").emit("admin:trip_status_changed", event);
      io.to("admins").emit("admin:dashboard_changed", { ...event, source: event.reason });
      io.to("drivers").emit("trip:changed", event);
      io.to(`driver:${result.previousDriverId}`).emit("trip:changed", event);
      if (result.trip.riderId) {
        io.to(`rider:${result.trip.riderId}`).emit("rider:trip_changed", event);
        io.to(`rider:${result.trip.riderId}`).emit("rider:notification_changed", {
          source: event.reason, notificationId: result.riderNotification?.id,
        });
      }
      io.to(`driver:${result.previousDriverId}`).emit("driver:notification_changed", {
        source: event.reason, notificationId: result.driverNotification.id,
      });
    }
    await Promise.allSettled([
      sendSystemNotificationToDriver(result.previousDriverId, result.driverNotification),
      result.trip.riderId ? sendTripStatusChangedToRider(result.trip, { reason: event.reason }) : Promise.resolve(),
    ]);
    return res.json({ success: true, message: "Đã gỡ tài xế và chuyển chuyến về Chờ duyệt.",
      trip: result.trip, heldAmount: result.heldAmount,
      actionLog: result.actionLog });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false, message: error?.message || "Không thể chuyển chuyến về Chờ duyệt.",
    });
  }
}

// POST /api/admin/trips/:id/return-to-review
export async function adminChuyenVeChoDuyet(req, res) {
  try {
    const tripId = String(req.params.id || "").trim();
    if (!tripId) {
      return res.status(400).json({ success: false, message: "Thiếu mã chuyến" });
    }

    const actor = req.admin;
    const result = await prisma.$transaction(async (tx) => {
      await lockTrip(tx, tripId);
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        select: {
          id: true,
          status: true,
          isVerified: true,
          driverId: true,
          acceptedAt: true,
          cancelledAt: true,
        },
      });

      if (!trip) {
        const error = new Error("Không tìm thấy chuyến");
        error.statusCode = 404;
        throw error;
      }

      if (
        trip.status !== "PENDING" ||
        !trip.isVerified ||
        trip.driverId ||
        trip.acceptedAt ||
        trip.cancelledAt
      ) {
        const error = new Error(
          "Chỉ có thể chuyển chuyến đã duyệt và chưa có tài xế về Chờ duyệt.",
        );
        error.statusCode = 409;
        throw error;
      }

      // updateMany giúp chặn trường hợp tài xế nhận chuyến đúng lúc Admin thao tác.
      const changed = await tx.trip.updateMany({
        where: {
          id: tripId,
          status: "PENDING",
          isVerified: true,
          driverId: null,
          acceptedAt: null,
          cancelledAt: null,
        },
        data: {
          isVerified: false,
          verifiedAt: null,
          verifiedById: null,
          verifiedNote: null,
          driverAcceptOpenAt: null,
        },
      });

      if (changed.count !== 1) {
        const error = new Error(
          "Chuyến vừa được tài xế nhận hoặc trạng thái đã thay đổi. Vui lòng tải lại danh sách.",
        );
        error.statusCode = 409;
        throw error;
      }

      const updated = await tx.trip.findUnique({
        where: { id: tripId },
        select: {
          id: true,
          status: true,
          isVerified: true,
          driverId: true,
          updatedAt: true,
        },
      });

      const log = await tx.adminTripActionLog.create({
        data: {
          tripId,
          fromStatus: "PENDING",
          toStatus: "PENDING",
          actorRole: actor?.role || "ADMIN",
          actorId: actor?.id ?? null,
          actorUsername: actor?.username || "admin",
          note: "Admin chuyển chuyến chưa có tài xế về Chờ duyệt để thương lượng và điều chỉnh giá.",
        },
      });

      return { updated, log };
    });

    const event = {
      tripId: result.updated.id,
      status: result.updated.status,
      fromStatus: "PENDING",
      toStatus: "PENDING",
      isVerified: false,
      driverId: null,
      updatedAt: result.updated.updatedAt,
      reason: "admin_return_trip_to_review",
    };
    const io = req.app?.get?.("io");
    if (io) {
      io.to("drivers").emit("trip:changed", event);
      io.to("admins").emit("admin:trip_status_changed", event);
      io.to("admins").emit("admin:dashboard_changed", event);
    }

    return res.json({
      success: true,
      message:
        "Đã chuyển chuyến về Chờ duyệt và ngừng hiển thị chuyến cho tài xế.",
      trip: result.updated,
      actionLog: result.log,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error?.message || "Không thể chuyển chuyến về Chờ duyệt",
    });
  }
}

// PATCH /api/admin/trips/:id/schedule
export async function adminCapNhatThoiGianChuyen(req, res) {
  try {
    const tripId = String(req.params.id || "").trim();
    const pickupTime = req.body?.pickupTime ? new Date(req.body.pickupTime) : null;
    const returnTime = req.body?.returnTime ? new Date(req.body.returnTime) : null;

    if (!tripId) {
      return res.status(400).json({ success: false, message: "Thiếu mã chuyến" });
    }
    if (!pickupTime || Number.isNaN(pickupTime.getTime())) {
      return res.status(400).json({ success: false, message: "Giờ đón không hợp lệ" });
    }
    if (req.body?.returnTime && Number.isNaN(returnTime?.getTime())) {
      return res.status(400).json({ success: false, message: "Giờ về không hợp lệ" });
    }
    if (returnTime && returnTime <= pickupTime) {
      return res.status(400).json({ success: false, message: "Giờ về phải sau giờ đón" });
    }

    const actor = req.admin;
    const result = await prisma.$transaction(async (tx) => {
      await lockTrip(tx, tripId);
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        select: {
          id: true,
          status: true,
          direction: true,
          pickupTime: true,
          returnTime: true,
          riderId: true,
          driverId: true,
        },
      });

      if (!trip) {
        const err = new Error("Không tìm thấy chuyến");
        err.statusCode = 404;
        throw err;
      }
      if (!["ACCEPTED", "CONTACTED"].includes(trip.status)) {
        const err = new Error(
          'Chỉ được cập nhật giờ khi chuyến đang ở trạng thái "Chưa liên hệ khách" hoặc "Chưa đón khách"',
        );
        err.statusCode = 400;
        throw err;
      }

      const nextReturnTime = trip.direction === "ROUND_TRIP" ? returnTime : null;
      if (trip.direction === "ROUND_TRIP" && !nextReturnTime) {
        const err = new Error("Vui lòng nhập giờ về cho chuyến khứ hồi");
        err.statusCode = 400;
        throw err;
      }

      const updated = await tx.trip.update({
        where: { id: tripId },
        data: { pickupTime, returnTime: nextReturnTime, updatedAt: new Date() },
        select: {
          id: true,
          status: true,
          direction: true,
          pickupTime: true,
          returnTime: true,
          riderId: true,
          driverId: true,
          updatedAt: true,
        },
      });

      const log = await tx.adminTripActionLog.create({
        data: {
          tripId,
          fromStatus: trip.status,
          toStatus: trip.status,
          actorRole: actor?.role || "ADMIN",
          actorId: actor?.id ?? null,
          actorUsername: actor?.username || "admin",
          note: [
            "Admin cập nhật lịch đón/trả khách.",
            `Giờ đón: ${trip.pickupTime?.toISOString?.() || "-"} -> ${pickupTime.toISOString()}`,
            `Giờ về: ${trip.returnTime?.toISOString?.() || "-"} -> ${nextReturnTime?.toISOString?.() || "-"}`,
          ].join("\n"),
        },
      });
      return { updated, log };
    });

    const io = req.app?.get?.("io");
    if (io) {
      const event = {
        tripId: result.updated.id,
        status: result.updated.status,
        pickupTime: result.updated.pickupTime,
        returnTime: result.updated.returnTime,
        updatedAt: result.updated.updatedAt,
        reason: "trip_schedule_updated",
      };
      io.to("admins").emit("admin:trip_schedule_updated", event);
      io.to("admins").emit("admin:dashboard_changed", event);
      if (result.updated.driverId) {
        io.to(`driver:${result.updated.driverId}`).emit("trip:changed", event);
      }
      if (result.updated.riderId) {
        io.to(`rider:${result.updated.riderId}`).emit("rider:trip_changed", event);
      }
    }

    return res.json({
      success: true,
      message: "Cập nhật giờ đón, giờ về thành công.",
      trip: result.updated,
      actionLog: result.log,
    });
  } catch (e) {
    return res.status(e.statusCode || 500).json({
      success: false,
      message: e?.message || "Cập nhật giờ đón, giờ về thất bại",
    });
  }
}

// POST /api/admin/trips/:id/cancel
// Body: { cancel_reason: "...", cancel_origin?: "CUSTOMER" | "DRIVER" }
export async function adminHuyChuyen(req, res) {
  try {
    const tripId = String(req.params.id || "");
    const cancelReason = String(req.body?.cancel_reason || "").trim();
    const cancelOrigin = String(req.body?.cancel_origin || "").trim().toUpperCase();

    if (!tripId) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu mã chuyến" });
    }
    if (!cancelReason) {
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng nhập lý do hủy" });
    }
    if (cancelOrigin && !["CUSTOMER", "DRIVER"].includes(cancelOrigin)) {
      return res.status(400).json({ success: false, message: "Bên huỷ chuyến không hợp lệ." });
    }

    const actor = req.admin; // requireAdmin set
    const actorRole = actor?.role || "ADMIN";
    const actorId = actor?.id ?? null;
    const actorUsername = actor?.username || "admin";

    const snapshot = await prisma.trip.findUnique({
      where: { id: tripId }, select: { driverId: true, status: true },
    });

    if (cancelOrigin === "DRIVER") {
      if (!["ACCEPTED", "CONTACTED"].includes(snapshot?.status)) {
        return res.status(409).json({
          success: false,
          message: "Chỉ chuyến chưa đón khách mới có thể đưa về Chờ duyệt khi tài xế huỷ. Chuyến đã bắt đầu cần xử lý riêng.",
        });
      }
      return adminDriverCancelToReview(
        { ...req, body: { ...req.body, reason: cancelReason } }, res,
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      if (snapshot?.driverId) await lockDriverProfile(tx, snapshot.driverId);
      await lockTrip(tx, tripId);
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        include: {
          driver: { include: { phones: { orderBy: { createdAt: "asc" }, take: 1 }, driverProfile: true } },
        },
      });

      if (!trip) {
        const err = new Error("Không tìm thấy chuyến");
        err.statusCode = 404;
        throw err;
      }

      if (trip.status === "COMPLETED") {
        const err = new Error("Không thể huỷ chuyến đã ở trạng thái COMPLETED");
        err.statusCode = 400;
        throw err;
      }

      if (trip.cancelledAt) {
        const err = new Error("Chuyến đã bị hủy trước đó");
        err.statusCode = 400;
        throw err;
      }

      if (trip.driverId && trip.driverId !== snapshot?.driverId) {
        const err = new Error("Tài xế của chuyến vừa thay đổi. Vui lòng tải lại.");
        err.statusCode = 409;
        throw err;
      }

      if (trip.driverId && ["ACCEPTED", "CONTACTED", "IN_PROGRESS"].includes(trip.status) && !trip.driver?.driverProfile) {
        const err = new Error("Không tìm thấy ví tài xế; chuyến chưa được thay đổi.");
        err.statusCode = 409;
        throw err;
      }
      if (cancelOrigin === "CUSTOMER" && trip.status === "IN_PROGRESS") {
        const err = new Error("Chuyến đã bắt đầu hành trình; cần đối soát phần dịch vụ đã thực hiện trước khi quyết định khoản hoàn ví.");
        err.statusCode = 409;
        throw err;
      }

      const refund = cancelOrigin === "CUSTOMER" && ["ACCEPTED", "CONTACTED"].includes(trip.status)
        ? await refundCustomerCancellationHold(tx, trip)
        : { amount: 0, transactions: [] };

      const updated = await tx.trip.update({
        where: { id: tripId },
        data: {
          status: "CANCELLED",
          cancelReason,
          cancelledAt: new Date(),
        },
        select: {
          id: true,
          status: true,
          cancelReason: true,
          cancelledAt: true,
          driverId: true,
          riderId: true,
          updatedAt: true,
        },
      });

      // ✅ Ghi log (tận dụng AdminTripActionLog)
      const log = await tx.adminTripActionLog.create({
        data: {
          tripId,
          fromStatus: trip.status,
          toStatus: "CANCELLED",
          actorRole,
          actorId,
          actorUsername,
          note: `[${cancelOrigin || "UNSPECIFIED"}] ${cancelReason.slice(0, 325)}${refund.amount ? `. Hoàn khoản giữ ${refund.amount}đ vào ví tài xế; TripID: ${tripId}.` : ""}`,
        },
      });

      const driverNotification = refund.amount && trip.driverId ? await tx.systemNotification.create({
        data: {
          audience: "DRIVER", targetType: "USER", targetUserId: trip.driverId,
          title: "Đã hoàn khoản giữ chuyến khách huỷ",
          message: `Chuyến #${tripId.slice(-8).toUpperCase()} đã được khách huỷ. ${refund.amount.toLocaleString("vi-VN")}đ đã được hoàn vào ví của bạn. [tripId:${tripId}]`,
          isActive: true, createdByAdminId: actorId,
        },
      }) : null;

      return {
        updated,
        log,
        fromStatus: trip.status,
        refund,
        driverNotification,
      };
    });

    const io = req.app?.get?.("io");
    if (io) {
      io.to("admins").emit("admin:trip_cancelled", {
        tripId: result.updated.id,
        fromStatus: result.fromStatus,
        toStatus: "CANCELLED",
        driverId: result.updated.driverId || null,
        cancelReason: result.updated.cancelReason || "",
        cancelledAt: result.updated.cancelledAt,
        updatedAt: result.updated.updatedAt,
      });

      console.log(
        `[Socket] Emit admin:trip_cancelled -> admins (${result.updated.id})`,
      );
      if (result.updated.riderId) {
        io.to(`rider:${result.updated.riderId}`).emit("rider:trip_changed", {
          tripId: result.updated.id,
          riderId: result.updated.riderId,
          fromStatus: result.fromStatus,
          toStatus: "CANCELLED",
          updatedAt: result.updated.updatedAt,
          reason: "admin_cancel_trip",
        });

        console.log(
          `[Socket] Emit rider:trip_changed -> rider:${result.updated.riderId} (${result.updated.id})`,
        );
      }
    }
    sendAdminPushNotification({
      title: "Chuyến đã bị huỷ",
      body: `Chuyến ${result.updated.id} vừa bị huỷ bởi ${actorUsername}.`,
      data: {
        type: "ADMIN_TRIP_CANCELLED",
        tripId: result.updated.id,
        fromStatus: result.fromStatus,
        toStatus: "CANCELLED",
      },
    }).catch((pushError) => {
      console.error("[AdminPush] trip cancelled push error:", pushError);
    });
    if (result.driverNotification && result.updated.driverId) {
      sendSystemNotificationToDriver(result.updated.driverId, result.driverNotification)
        .catch((notifyError) => console.error("[AdminPush] wallet refund notification error:", notifyError));
    }
    return res.json({
      success: true,
      trip: result.updated,
      actionLog: result.log,
      refundAmount: result.refund.amount,
      message: result.refund.amount
        ? `Đã huỷ chuyến và hoàn ${result.refund.amount.toLocaleString("vi-VN")}đ khoản giữ vào ví tài xế.`
        : cancelOrigin ? "Đã hủy chuyến" : "Đã hủy chuyến; chưa ghi nhận phạt hay hoàn ví vì chưa xác định bên hủy.",
    });
  } catch (e) {
    const status = e.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: e?.message || "Hủy chuyến thất bại",
    });
  }
}

// PATCH /api/admin/trips/:id/manual-adjust
// Body: {
//   pickupAddress,
//   dropoffAddress,
//   stops: [{ id?, seq?, address }],
//   distanceKm, fareEstimate, totalPrice,
//   estimatedDurationMinutes, outboundDriveMinutes, returnDriveMinutes, totalDriveMinutes,
//   verifiedNote
// }
export async function adminDieuChinhThongTinChuyen(req, res) {
  try {
    const tripId = String(req.params.id || "").trim();

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã chuyến",
      });
    }

    const pickupAddress = String(req.body?.pickupAddress || "").trim();
    const dropoffAddress = String(req.body?.dropoffAddress || "").trim();

    // Ghi chú khách hàng
    const note = String(req.body?.note || "")
      .trim()
      .slice(0, 2000);

    // Ghi chú xác nhận nội bộ của admin
    const verifiedNote = String(req.body?.verifiedNote || "")
      .trim()
      .slice(0, 500);
    const carType = String(req.body?.carType || "").trim();
    const direction = String(req.body?.direction || "").trim();

    const pickupTime = req.body?.pickupTime
      ? new Date(req.body.pickupTime)
      : null;
    const returnTime = req.body?.returnTime
      ? new Date(req.body.returnTime)
      : null;

    const rawStops = Array.isArray(req.body?.stops) ? req.body.stops : [];

    const distanceKm = Number(req.body?.distanceKm);
    const fareEstimate = Number(req.body?.fareEstimate);
    const totalPrice = Number(req.body?.totalPrice);
    const estimatedDurationMinutes = Number(req.body?.estimatedDurationMinutes);
    const outboundDriveMinutes = Number(req.body?.outboundDriveMinutes);
    const returnDriveMinutes = Number(req.body?.returnDriveMinutes);
    const totalDriveMinutes = Number(req.body?.totalDriveMinutes);

    if (!pickupAddress) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập điểm đón",
      });
    }

    const validCarTypes = ["CAR_5", "CAR_7", "CAR_16"];
    const validDirections = ["ONE_WAY", "ROUND_TRIP"];

    if (!validCarTypes.includes(carType)) {
      return res.status(400).json({
        success: false,
        message: "Loại xe không hợp lệ",
      });
    }

    if (!validDirections.includes(direction)) {
      return res.status(400).json({
        success: false,
        message: "Loại chuyến không hợp lệ",
      });
    }

    if (!pickupTime || Number.isNaN(pickupTime.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Giờ đón không hợp lệ",
      });
    }

    if (direction === "ROUND_TRIP") {
      if (!returnTime || Number.isNaN(returnTime.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng nhập giờ về cho chuyến khứ hồi",
        });
      }

      if (returnTime <= pickupTime) {
        return res.status(400).json({
          success: false,
          message: "Giờ về phải sau giờ đón",
        });
      }
    }

    const normalizedStops = rawStops
      .map((stop, index) => ({
        id: stop?.id ? String(stop.id) : "",
        seq: Number.isFinite(Number(stop?.seq)) ? Number(stop.seq) : index + 1,
        address: String(stop?.address || "").trim(),
      }))
      .filter((stop) => stop.address);

    if (!dropoffAddress && normalizedStops.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập ít nhất một điểm đến",
      });
    }

    const finalStops =
      normalizedStops.length > 0
        ? normalizedStops
        : [{ id: "", seq: 1, address: dropoffAddress }];

    const finalDropoffAddress =
      finalStops[finalStops.length - 1]?.address || dropoffAddress;

    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
      return res.status(400).json({
        success: false,
        message: "Số km không hợp lệ",
      });
    }

    if (!Number.isFinite(fareEstimate) || fareEstimate < 0) {
      return res.status(400).json({
        success: false,
        message: "Giá ước tính không hợp lệ",
      });
    }

    if (!Number.isFinite(totalPrice) || totalPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Giá cuối không hợp lệ",
      });
    }

    if (
      !Number.isFinite(estimatedDurationMinutes) ||
      estimatedDurationMinutes < 0 ||
      !Number.isFinite(outboundDriveMinutes) ||
      outboundDriveMinutes < 0 ||
      !Number.isFinite(returnDriveMinutes) ||
      returnDriveMinutes < 0 ||
      !Number.isFinite(totalDriveMinutes) ||
      totalDriveMinutes < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Thời gian dự kiến không hợp lệ",
      });
    }

    if (!verifiedNote) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập ghi chú xác nhận",
      });
    }

    const actor = req.admin;
    const actorRole = actor?.role || "ADMIN";
    const actorId = actor?.id ?? null;
    const actorUsername = actor?.username || "admin";

    const result = await prisma.$transaction(async (tx) => {
      await lockTrip(tx, tripId);
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        select: {
          id: true,
          status: true,
          driverId: true,
          acceptedAt: true,
          cancelledAt: true,
          pickupAddress: true,
          dropoffAddress: true,
          note: true,
          carType: true,
          direction: true,
          pickupTime: true,
          returnTime: true,
          distanceKm: true,
          fareEstimate: true,
          totalPrice: true,
          estimatedDurationMinutes: true,
          outboundDriveMinutes: true,
          returnDriveMinutes: true,
          totalDriveMinutes: true,
          stops: {
            orderBy: { seq: "asc" },
            select: {
              id: true,
              seq: true,
              address: true,
            },
          },
        },
      });

      if (!trip) {
        const err = new Error("Không tìm thấy chuyến");
        err.statusCode = 404;
        throw err;
      }

      if (trip.status !== "PENDING") {
        const err = new Error("Chỉ được điều chỉnh chuyến đang chờ duyệt");
        err.statusCode = 400;
        throw err;
      }

      if (trip.driverId || trip.acceptedAt) {
        const err = new Error("Không thể điều chỉnh chuyến đã có tài xế nhận");
        err.statusCode = 400;
        throw err;
      }

      if (trip.cancelledAt) {
        const err = new Error("Không thể điều chỉnh chuyến đã bị huỷ");
        err.statusCode = 400;
        throw err;
      }

      await tx.tripStop.deleteMany({
        where: { tripId },
      });

      await tx.tripStop.createMany({
        data: finalStops.map((stop, index) => ({
          tripId,
          seq: index + 1,
          address: stop.address,
          lat: null,
          lng: null,
        })),
      });

      const updated = await tx.trip.update({
        where: { id: tripId },
        data: {
          pickupAddress,
          dropoffAddress: finalDropoffAddress,
          note: note || null,
          carType,
          direction,
          pickupTime,
          returnTime: direction === "ROUND_TRIP" ? returnTime : null,
          distanceKm,
          fareEstimate,
          totalPrice: Math.round(totalPrice),
          estimatedDurationMinutes: Math.round(estimatedDurationMinutes),
          outboundDriveMinutes: Math.round(outboundDriveMinutes),
          returnDriveMinutes: Math.round(returnDriveMinutes),
          totalDriveMinutes: Math.round(totalDriveMinutes),
          verifiedNote,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          status: true,
          pickupAddress: true,
          dropoffAddress: true,
          note: true,
          carType: true,
          direction: true,
          pickupTime: true,
          returnTime: true,
          distanceKm: true,
          fareEstimate: true,
          totalPrice: true,
          estimatedDurationMinutes: true,
          outboundDriveMinutes: true,
          returnDriveMinutes: true,
          totalDriveMinutes: true,
          verifiedNote: true,
          riderId: true,
          driverId: true,
          updatedAt: true,
          stops: {
            orderBy: { seq: "asc" },
            select: {
              id: true,
              seq: true,
              address: true,
              lat: true,
              lng: true,
            },
          },
        },
      });

      const oldStopsText = Array.isArray(trip.stops)
        ? trip.stops.map((s) => `${s.seq}. ${s.address}`).join(" | ")
        : "";

      const newStopsText = finalStops
        .map((s, index) => `${index + 1}. ${s.address}`)
        .join(" | ");

      const logNote = [
        "Admin điều chỉnh thông tin chuyến.",
        `Điểm đón: ${trip.pickupAddress} -> ${pickupAddress}`,
        `Điểm đến: ${oldStopsText || trip.dropoffAddress} -> ${newStopsText}`,
        `Ghi chú khách: ${trip.note || "-"} -> ${note || "-"}`,
        `Loại xe: ${trip.carType} -> ${carType}`,
        `Loại chuyến: ${trip.direction} -> ${direction}`,
        `Giờ đón: ${trip.pickupTime?.toISOString?.() || "-"} -> ${pickupTime.toISOString()}`,
        `Giờ về: ${trip.returnTime?.toISOString?.() || "-"} -> ${
          direction === "ROUND_TRIP" && returnTime
            ? returnTime.toISOString()
            : "-"
        }`,
        `KM: ${trip.distanceKm} -> ${distanceKm}`,
        `Giá cuối: ${trip.totalPrice} -> ${Math.round(totalPrice)}`,
        `Ghi chú xác nhận nội bộ: ${verifiedNote}`,
      ]
        .join("\n")
        .slice(0, 500);

      const log = await tx.adminTripActionLog.create({
        data: {
          tripId,
          fromStatus: trip.status,
          toStatus: trip.status,
          actorRole,
          actorId,
          actorUsername,
          note: logNote,
        },
      });

      return { updated, log };
    });

    const io = req.app?.get?.("io");

    if (io) {
      io.to("admins").emit("admin:dashboard_changed", {
        reason: "trip_manual_adjusted",
        tripId: result.updated.id,
        updatedAt: result.updated.updatedAt,
      });

      io.to("admins").emit("admin:trip_manual_adjusted", {
        tripId: result.updated.id,
        status: result.updated.status,
        updatedAt: result.updated.updatedAt,
      });

      if (result.updated.riderId) {
        io.to(`rider:${result.updated.riderId}`).emit("rider:trip_changed", {
          tripId: result.updated.id,
          riderId: result.updated.riderId,
          status: result.updated.status,
          updatedAt: result.updated.updatedAt,
          reason: "trip_manual_adjusted",
        });
      }
    }

    return res.json({
      success: true,
      message: "Cập nhật thông tin chuyến thành công.",
      trip: result.updated,
      actionLog: result.log,
    });
  } catch (e) {
    const status = e.statusCode || 500;

    return res.status(status).json({
      success: false,
      message: e?.message || "Cập nhật thông tin chuyến thất bại",
    });
  }
}
