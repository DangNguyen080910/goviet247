// Path: goviet247/apps/api/src/routes/maps.js
import { Router } from "express";
import {
  autocomplete,
  getPlaceDetail,
  getRoute,
} from "../services/mapService.js";

const router = Router();

// GET /api/maps/autocomplete?q=
router.get("/autocomplete", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (!q) {
      return res.json({
        success: true,
        items: [],
      });
    }

    const items = await autocomplete(q, {
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
    });

    return res.json({
      success: true,
      items,
    });
  } catch (err) {
    console.error("maps autocomplete error:", err);

    if (err?.response?.status === 429) {
      return res.status(429).json({
        success: false,
        message:
          "Dịch vụ gợi ý địa chỉ đang tạm quá tải hoặc đã chạm giới hạn. Vui lòng thử lại sau.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Lỗi server khi autocomplete địa chỉ.",
    });
  }
});

// GET /api/maps/place-detail?placeId=
router.get("/place-detail", async (req, res) => {
  try {
    const placeId = String(req.query.placeId || "").trim();

    if (!placeId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu placeId.",
      });
    }

    const item = await getPlaceDetail(placeId);

    return res.json({
      success: true,
      item,
    });
  } catch (err) {
    console.error("maps place-detail error:", err);

    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy chi tiết địa chỉ.",
    });
  }
});

// POST /api/maps/route
router.post("/route", async (req, res) => {
  try {
    const points = Array.isArray(req.body?.points) ? req.body.points : [];

    if (points.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Cần ít nhất 2 điểm để tính lộ trình.",
      });
    }

    const item = await getRoute(points);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy lộ trình phù hợp.",
      });
    }

    return res.json({
      success: true,
      item,
    });
  } catch (err) {
    console.error("maps route error:", err);

    if (
      err?.message === "ROUTE_POINTS_INVALID" ||
      err?.message === "ROUTE_POINT_COORDINATES_INVALID"
    ) {
      return res.status(400).json({
        success: false,
        message: "Danh sách tọa độ không hợp lệ.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Lỗi server khi tính lộ trình.",
    });
  }
});

export default router;
