// Path: goviet247/apps/api/src/controllers/uploadController.js
import { uploadToS3 } from "../services/s3Service.js";

function resolveFolderFromScope(scope, req) {
  const safeScope = String(scope || "").trim();

  switch (safeScope) {
    case "public_avatar":
      return "public/avatars";

    case "driver_document": {
      const driverUserId = req.user?.uid || req.user?.id || "unknown-driver";
      return `driver-documents/${driverUserId}`;
    }

    case "accounting_document": {
      const year = String(req.body?.year || new Date().getFullYear()).trim();
      const quarter = String(req.body?.quarter || "").trim();

      if (quarter && /^[1-4]$/.test(quarter)) {
        return `accounting-documents/${year}/Q${quarter}`;
      }

      return `accounting-documents/${year}`;
    }

    default:
      return null;
  }
}

export async function uploadFile(req, res) {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Thiếu file upload.",
      });
    }

    const scope = String(req.body?.scope || "").trim();
    const folder = resolveFolderFromScope(scope, req);

    if (!folder) {
      return res.status(400).json({
        success: false,
        message:
          "scope không hợp lệ. Hỗ trợ: public_avatar, driver_document, accounting_document.",
      });
    }

    const result = await uploadToS3({
      file,
      folder,
    });

    return res.json({
      success: true,
      scope,
      folder,
      ...result,
    });
  } catch (err) {
    console.error("[Upload] error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Upload failed",
    });
  }
}