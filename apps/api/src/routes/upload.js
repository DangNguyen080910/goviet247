// Path: goviet247/apps/api/src/routes/upload.js
import { Router } from "express";
import { uploadFile } from "../controllers/uploadController.js";
import { verifyToken, requireAdminOrStaff } from "../middleware/authMiddleware.js";
import { uploadAccountingDocument } from "../middleware/uploadMiddleware.js";

const router = Router();

/**
 * scope:
 * - public_avatar
 * - driver_document
 * - accounting_document
 */
router.post("/", (req, res, next) => {
  const scope = String(req.body?.scope || req.query?.scope || "").trim();

  if (scope === "accounting_document") {
    return requireAdminOrStaff(req, res, () => {
      uploadAccountingDocument.single("file")(req, res, next);
    });
  }

  if (scope === "driver_document") {
    return verifyToken(req, res, () => {
      uploadAccountingDocument.single("file")(req, res, next);
    });
  }

  return uploadAccountingDocument.single("file")(req, res, next);
}, uploadFile);

export default router;