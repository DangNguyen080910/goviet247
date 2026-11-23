import { createRequestRateLimit } from "../middleware/requestRateLimit.js";
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
router.post("/quote", createRequestRateLimit({max:60,windowMs:60000}), quoteTrip);
router.post("/request-otp", otpIpRateLimit, requestTripOtp);
router.post("/confirm", confirmTrip);

export default router;