// Path: goviet247/apps/api/src/routes/feedback.js
import { Router } from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { createFeedback } from "../controllers/feedbackController.js";

const router = Router();

// User đăng nhập gửi góp ý
router.post("/", verifyToken, createFeedback);

export default router;