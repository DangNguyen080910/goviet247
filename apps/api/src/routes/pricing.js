// Path: goviet247/apps/api/src/routes/pricing.js
import { Router } from "express";
import { quote } from "../controllers/pricingController.js";

const router = Router();

// Public: khách cần tính giá trước khi đặt
router.post("/quote", quote);

export default router;