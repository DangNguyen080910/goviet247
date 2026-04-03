import multer from "multer";
import { z } from "zod";
import { prisma } from "../utils/db.js";
import { uploadToS3 } from "../services/s3Service.js";

const ALLOWED_TYPES = [
  "CCCD_FRONT",
  "CCCD_BACK",
  "PORTRAIT",
  "DRIVER_LICENSE",
  "VEHICLE_REGISTRATION",
];

const storage = multer.memoryStorage();

function imageFileFilter(req, file, cb) {
  const mimetype = String(file.mimetype || "").toLowerCase();

  if (!mimetype.startsWith("image/")) {
    return cb(new Error("FILE_KHONG_PHAI_ANH"));
  }

  cb(null, true);
}

export const uploadDriverDocumentMiddleware = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
}).single("file");

function isDriverRole(user) {
  const roleList = Array.isArray(user?.roles)
    ? user.roles.map((item) =>
        String(item?.role || "")
          .trim()
          .toUpperCase(),
      )
    : [];

  if (roleList.includes("DRIVER")) return true;

  const primaryRole = String(user?.primaryRole || "")
    .trim()
    .toUpperCase();

  return primaryRole === "DRIVER";
}

function sanitizeDocumentType(type) {
  return String(type || "UNKNOWN")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_");
}

export async function uploadDriverDocument(req, res) {
  try {
    const { uid } = req.user || {};

    if (!uid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const body = z
      .object({
        type: z.enum([
          "CCCD_FRONT",
          "CCCD_BACK",
          "PORTRAIT",
          "DRIVER_LICENSE",
          "VEHICLE_REGISTRATION",
        ]),
      })
      .parse(req.body || {});

    const user = await prisma.user.findUnique({
      where: { id: uid },
      include: {
        roles: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User không tồn tại.",
      });
    }

    if (!isDriverRole(user)) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản này không phải tài xế.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng gửi file ảnh.",
      });
    }

    if (!ALLOWED_TYPES.includes(body.type)) {
      return res.status(400).json({
        success: false,
        message: "Loại giấy tờ không hợp lệ.",
      });
    }

    const safeType = sanitizeDocumentType(body.type);
    const s3Folder = `driver-documents/${uid}/${safeType}`;

    const uploadResult = await uploadToS3({
      file: req.file,
      folder: s3Folder,
    });

    return res.json({
      success: true,
      message: "Upload ảnh giấy tờ thành công.",
      document: {
        type: body.type,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        fileName: uploadResult.key.split("/").pop(),
        fileKey: uploadResult.key,
        fileUrl: uploadResult.url,
      },
    });
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({
        success: false,
        message: error.issues?.[0]?.message || "Dữ liệu không hợp lệ.",
      });
    }

    if (error?.message === "FILE_KHONG_PHAI_ANH") {
      return res.status(400).json({
        success: false,
        message: "File upload phải là ảnh.",
      });
    }

    if (error?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Ảnh vượt quá dung lượng tối đa 10MB.",
      });
    }

    console.error("POST /api/driver/documents/upload error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal error",
    });
  }
}