// Path: goviet247/apps/api/src/controllers/adminTripController.js
import { prisma } from "../utils/db.js";
import { sendAdminPushNotification } from "../services/notificationService.js";

// POST /api/admin/trips/:id/cancel
// Body: { cancel_reason: "..." }
export async function adminHuyChuyen(req, res) {
  try {
    const tripId = String(req.params.id || "");
    const cancelReason = String(req.body?.cancel_reason || "").trim();

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

    const actor = req.admin; // requireAdmin set
    const actorRole = actor?.role || "ADMIN";
    const actorId = actor?.id ?? null;
    const actorUsername = actor?.username || "admin";

    const result = await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
        select: { id: true, status: true, cancelledAt: true },
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
          note: cancelReason.slice(0, 500),
        },
      });

      return {
        updated,
        log,
        fromStatus: trip.status,
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
    return res.json({
      success: true,
      trip: result.updated,
      actionLog: result.log,
      message: "Đã hủy chuyến",
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
    const verifiedNote = String(req.body?.verifiedNote || "").trim();

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
        `KM: ${trip.distanceKm} -> ${distanceKm}`,
        `Giá cuối: ${trip.totalPrice} -> ${Math.round(totalPrice)}`,
        `Ghi chú: ${verifiedNote}`,
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
