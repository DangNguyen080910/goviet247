// Path: goviet247/apps/api/src/middleware/uploadMiddleware.js
import multer from "multer";

const storage = multer.memoryStorage();

export const uploadAccountingDocument = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
});