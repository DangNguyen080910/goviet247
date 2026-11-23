// Path: goviet247/apps/api/src/controllers/uploadController.js
import { uploadToS3 } from "../services/s3Service.js";

function resolveFolderFromScope(scope, req) {
  const safeScope = String(scope || "").trim();

  switch (safeScope) {
    case "public_avatar":
      return "public/avatars";

    case "driver_document": {
      const driverUserId = req.user?.uid || req.user?.id;
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

    const scope = req.uploadScope;
    if ((scope === "accounting_document" && !req.admin) || (scope === "driver_document" && !req.user)) return res.status(403).json({success:false,message:"Không có quyền upload tài liệu."});
    const allowed = scope === "accounting_document"
      ? /^(image\/(jpeg|jpg|png|webp|gif|heic|heif)|application\/(pdf|zip|x-zip-compressed|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)|text\/(csv|plain))$/i
      : /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i;
    if (!allowed.test(file.mimetype || "")) return res.status(400).json({success:false,message:"Định dạng tệp không được hỗ trợ."});
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