// Path: goviet247/apps/api/src/controllers/adminTripController.js
import { prisma } from "../utils/db.js";

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
