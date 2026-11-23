import { createRequestRateLimit } from "../middleware/requestRateLimit.js";
// Path: goviet247/apps/api/src/routes/pricing.js
import { Router } from "express";
import { quote } from "../controllers/pricingController.js";

const router = Router();

// Public: khách cần tính giá trước khi đặt
router.post("/quote", createRequestRateLimit({max:60,windowMs:60000}), quote);

export default router;