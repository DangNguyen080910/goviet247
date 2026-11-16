// Path: goviet247/apps/api/src/routes/tripPublicRoutes.js
import express from "express";
import { otpIpRateLimit } from "../middleware/otpIpRateLimit.js";
import {
  getPublicTripConfig,
  quoteTrip,
  requestTripOtp,
  confirmTrip,
} from "../controllers/tripPublicController.js";

const router = express.Router();

router.get("/config", getPublicTripConfig);
router.post("/quote", quoteTrip);
router.post("/request-otp", otpIpRateLimit, requestTripOtp);
router.post("/confirm", confirmTrip);

export default router;