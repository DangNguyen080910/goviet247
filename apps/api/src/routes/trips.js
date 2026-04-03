// Path: goviet247/apps/api/src/routes/trips.js
// ======================================================
// Routes cho Trip (bao gồm cả Rider và Driver)
// ======================================================

import { Router } from "express";
import {
  estimateTrip,
  getTripById,
  listAvailableTrips,
  acceptTrip,
  listMyTrips,
  listMyCustomerTrips,
  changeTripStatus,
  getAssignedTrips,
  adminChangeTripStatus,
  adminListUnverifiedTrips,
  adminVerifyTrip,
  getDriverWallet,
  getMyDriverWalletTransactions,
  createWithdrawRequest,
  cancelDriverTrip,
} from "../controllers/tripController.js";

import { sendNewTripToDrivers } from "../services/notificationService.js";
import { calculateTripPrice } from "../services/pricingService.js";
import {
  requireAdminOrStaff,
  verifyToken,
} from "../middleware/authMiddleware.js";

import pkg from "@prisma/client";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();
const router = Router();

// ======================================================
// Optional auth cho customer public route
// - Không có Authorization header -> đi tiếp như guest
// - Có Authorization header -> verifyToken
// ======================================================
function optionalVerifyToken(req, res, next) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return next();
  }

  return verifyToken(req, res, next);
}

// ======================================================
// 🧭 RIDER ROUTES
// ======================================================

/**
 * 1️⃣ Ước tính giá chuyến đi
 * POST /api/trips/estimate
 */
router.post("/estimate", estimateTrip);

/**
 * 2️⃣ Tạo chuyến đi mới (Rider tạo cuốc)
 * POST /api/trips
 */
router.post("/", optionalVerifyToken, async (req, res) => {
  try {
    const riderId = req.user?.uid || req.user?.id || null;

    const {
      pickupAddress,
      pickupLat,
      pickupLng,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      distanceKm: distanceKmRaw,
      fareEstimate,
      note,
      pickupTime: pickupTimeRaw,
      returnTime: returnTimeRaw,
      direction: directionRaw,
      carType: carTypeRaw,
      riderName,
      riderPhone,
      stops: stopsRaw,
      driveMinutes: driveMinutesRaw,
    } = req.body;

    const stops = Array.isArray(stopsRaw)
      ? stopsRaw.map((s) => String(s || "").trim()).filter(Boolean)
      : [];

    if (!pickupAddress || !dropoffAddress) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "pickupAddress và dropoffAddress là bắt buộc.",
      });
    }

    if (stops.length === 0) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Cần ít nhất 1 điểm đến.",
      });
    }

    const pickupTime = pickupTimeRaw ? new Date(pickupTimeRaw) : null;
    const returnTime = returnTimeRaw ? new Date(returnTimeRaw) : null;

    if (!pickupTime || Number.isNaN(pickupTime.getTime())) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "pickupTime (ISO 8601) là bắt buộc.",
      });
    }

    if (returnTimeRaw && Number.isNaN(returnTime?.getTime?.())) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "returnTime không hợp lệ.",
      });
    }

    const direction = directionRaw || "ONE_WAY";
    const carType = carTypeRaw || "CAR_5";

    function haversineKm(aLat, aLng, bLat, bLng) {
      const R = 6371;
      const dLat = (Math.PI / 180) * (bLat - aLat);
      const dLng = (Math.PI / 180) * (bLng - aLng);
      const s1 = Math.sin(dLat / 2) ** 2;
      const s2 =
        Math.cos((Math.PI / 180) * aLat) *
        Math.cos((Math.PI / 180) * bLat) *
        Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(s1 + s2));
    }

    let distanceKm = distanceKmRaw != null ? Number(distanceKmRaw) : null;

    if (distanceKm == null) {
      if (
        typeof pickupLat === "number" &&
        typeof pickupLng === "number" &&
        typeof dropoffLat === "number" &&
        typeof dropoffLng === "number"
      ) {
        distanceKm = Math.max(
          0.1,
          Number(
            haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng).toFixed(
              1,
            ),
          ),
        );
      } else {
        return res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Thiếu distanceKm hoặc toạ độ để tính distanceKm.",
        });
      }
    }

    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "distanceKm không hợp lệ.",
      });
    }

    let driveMinutes =
      driveMinutesRaw != null && driveMinutesRaw !== ""
        ? Number(driveMinutesRaw)
        : null;

    if (
      driveMinutes != null &&
      (!Number.isFinite(driveMinutes) || driveMinutes < 0)
    ) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "driveMinutes không hợp lệ.",
      });
    }

    if (direction === "ROUND_TRIP" && driveMinutes == null) {
      driveMinutes = 0;
    }

    const pricing = await calculateTripPrice({
      carType,
      direction,
      distanceKm,
      pickupTime,
      returnTime: returnTimeRaw ? returnTime : undefined,
      driveMinutes,
    });

    const totalPrice = Number(pricing.totalPrice);
    const basePricePerKm = Number(pricing.basePricePerKm);
    const holidayFactor = Number(pricing.holidayFactor || 1);
    const directionFactor = Number(pricing.directionFactor || 1);

    const trip = await prisma.trip.create({
      data: {
        riderId,
        pickupAddress,
        pickupLat: pickupLat != null ? Number(pickupLat) : null,
        pickupLng: pickupLng != null ? Number(pickupLng) : null,
        dropoffAddress,
        dropoffLat: dropoffLat != null ? Number(dropoffLat) : null,
        dropoffLng: dropoffLng != null ? Number(dropoffLng) : null,
        distanceKm,
        fareEstimate:
          fareEstimate != null && fareEstimate !== ""
            ? Number(fareEstimate)
            : totalPrice,
        note: note || null,
        status: "PENDING",
        pickupTime,
        returnTime: returnTimeRaw ? returnTime : null,
        direction,
        carType,
        basePricePerKm,
        holidayFactor,
        directionFactor,
        totalPrice,
        riderName: riderName || "",
        riderPhone: riderPhone || "",
        isVerified: false,
      },
    });

    await prisma.tripStop.createMany({
      data: stops.map((addr, idx) => ({
        tripId: trip.id,
        seq: idx + 1,
        address: addr,
      })),
    });

    const io = req.app?.get?.("io");

    if (io) {
      io.to("admins").emit("admin:new_trip", {
        tripId: trip.id,
        status: trip.status,
        createdAt: trip.createdAt,
      });

      console.log("[Socket] emitted admin:new_trip (routes):", trip.id);
    } else {
      console.log("[Socket] io not found on app (skip admin emit)");
    }

    return res.status(201).json({
      success: true,
      trip,
      message:
        "Đã ghi nhận chuyến. Nhân viên sẽ xác nhận trước khi gửi tới tài xế.",
    });
  } catch (err) {
    console.error("[Trip] create error:", err);

    return res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: err.message || "Không thể tạo chuyến đi.",
    });
  }
});

// Lịch sử chuyến của customer đang đăng nhập
router.get("/my", verifyToken, listMyCustomerTrips);

// Rider tự huỷ chuyến, chỉ khi còn PENDING
router.post("/:id/cancel-by-rider", verifyToken, async (req, res) => {
  try {
    const tripId = String(req.params?.id || "").trim();
    const riderId = req.user?.uid || req.user?.id || null;
    const cancelReason = String(req.body?.cancelReason || "").trim();

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã chuyến.",
      });
    }

    if (!riderId) {
      return res.status(401).json({
        success: false,
        message: "Bạn cần đăng nhập để huỷ chuyến.",
      });
    }

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        riderId: true,
        status: true,
        cancelledAt: true,
      },
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy chuyến.",
      });
    }

    if (trip.riderId !== riderId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền huỷ chuyến này.",
      });
    }

    if (trip.cancelledAt || trip.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Chuyến này đã được huỷ trước đó.",
      });
    }

    if (trip.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message:
          "Bạn chỉ có thể tự huỷ chuyến khi chuyến đang ở trạng thái Chờ duyệt.",
      });
    }

    const updated = await prisma.trip.update({
      where: { id: tripId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: cancelReason || "Rider tự huỷ khi còn chờ duyệt",
      },
    });

    return res.json({
      success: true,
      trip: updated,
      message: "Đã huỷ chuyến thành công.",
    });
  } catch (error) {
    console.error("[Trip] cancel-by-rider error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể huỷ chuyến lúc này.",
    });
  }
});

// ======================================================
// ADMIN VERIFY
// ======================================================

router.patch(
  "/admin/trips/:id/verify",
  requireAdminOrStaff,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { note } = req.body || {};

      const trip = await prisma.trip.findUnique({
        where: { id },
      });

      if (!trip) {
        return res
          .status(404)
          .json({ success: false, message: "Không tìm thấy chuyến." });
      }

      if (trip.status === "CANCELLED" || trip.cancelledAt) {
        return res
          .status(400)
          .json({ success: false, message: "Chuyến đã huỷ." });
      }

      if (trip.status !== "PENDING") {
        return res.status(400).json({
          success: false,
          message: "Chỉ có thể duyệt chuyến PENDING.",
        });
      }

      if (trip.isVerified) {
        return res.status(400).json({
          success: false,
          message: "Chuyến đã được duyệt trước đó.",
        });
      }

      const updated = await prisma.trip.update({
        where: { id },
        data: {
          isVerified: true,
          verifiedAt: new Date(),
          verifiedById: req.admin?.id || null,
          verifiedNote: note || null,
        },
      });

      const io = req.app.get("io");

      if (io) {
        io.to("drivers").emit("trip:new", {
          id: updated.id,
          pickupAddress: updated.pickupAddress,
          dropoffAddress: updated.dropoffAddress,
          distanceKm: updated.distanceKm,
          totalPrice: updated.totalPrice,
          carType: updated.carType,
          direction: updated.direction,
          pickupTime: updated.pickupTime,
          status: updated.status,
          createdAt: updated.createdAt,
        });

        if (updated.riderId) {
          io.to(`rider:${updated.riderId}`).emit("rider:trip_changed", {
            tripId: updated.id,
            riderId: updated.riderId,
            fromStatus: "PENDING",
            toStatus: "PENDING",
            updatedAt: updated.updatedAt,
            reason: "admin_verified_trip",
          });

          console.log(
            `[Socket] Emit rider:trip_changed -> rider:${updated.riderId} (${updated.id})`,
          );
        }

        console.log(
          `[Socket] Emit trip:new -> drivers (${updated.id}) (verified)`,
        );
      }

      try {
        await sendNewTripToDrivers(updated);
      } catch (err) {
        console.error("[Push] Lỗi khi gửi thông báo:", err);
      }

      return res.json({
        success: true,
        trip: updated,
        message: "Đã duyệt chuyến và gửi tới tài xế.",
      });
    } catch (err) {
      console.error("[Trip] verify error:", err);

      return res.status(500).json({
        success: false,
        message: "Không thể duyệt chuyến.",
      });
    }
  },
);

// ======================================================
// DRIVER ROUTES
// ======================================================

router.get("/driver/wallet", verifyToken, getDriverWallet);

router.get(
  "/driver/wallet-transactions",
  verifyToken,
  getMyDriverWalletTransactions,
);

router.post("/driver/withdraw", verifyToken, createWithdrawRequest);

router.get("/driver/available", verifyToken, listAvailableTrips);
router.post("/driver/accept", verifyToken, acceptTrip);
router.post("/driver/cancel", verifyToken, cancelDriverTrip);
router.get("/driver/my", verifyToken, listMyTrips);
router.post("/driver/change-status", verifyToken, changeTripStatus);

router.get("/admin/trips/assigned", requireAdminOrStaff, getAssignedTrips);

router.post(
  "/admin/trips/:id/change-status",
  requireAdminOrStaff,
  adminChangeTripStatus,
);

router.get(
  "/admin/trips/unverified",
  requireAdminOrStaff,
  adminListUnverifiedTrips,
);

router.post("/admin/trips/:id/verify", requireAdminOrStaff, adminVerifyTrip);

router.get("/:id", getTripById);

export default router;
