// Path: goviet247/apps/api/src/routes/driverDocuments.js
import { Router } from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  uploadDriverDocument,
  uploadDriverDocumentMiddleware,
} from "../controllers/driverDocumentController.js";

const router = Router();

// Upload ảnh giấy tờ tài xế (S3 upload)
router.post(
  "/upload",
  verifyToken,
  uploadDriverDocumentMiddleware,
  uploadDriverDocument,
);

export default router;