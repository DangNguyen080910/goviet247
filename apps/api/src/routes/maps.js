// Path: goviet247/apps/api/src/routes/maps.js
import { Router } from "express";
import {
  autocomplete,
  getPlaceDetail,
} from "../services/mapService.js";

const router = Router();

// GET /api/maps/autocomplete?q=
router.get("/autocomplete", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    if (!q) {
      return res.json({
        success: true,
        items: [],
      });
    }

    const items = await autocomplete(q);

    return res.json({
      success: true,
      items,
    });
  } catch (err) {
    console.error("maps autocomplete error:", err);

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

export default router;