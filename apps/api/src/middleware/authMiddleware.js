// Path: goviet247/apps/api/src/middleware/authMiddleware.js
import { verifyAdminJwtToken, verifyJwtToken } from "../utils/jwt.js";

// Xác thực token (user / admin đều dùng)
export function verifyToken(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const [, token] = auth.split(" ");
    if (!token) {
      return res.status(401).json({ success: false, message: "Thiếu token" });
    }

    req.user = verifyJwtToken(token);
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Token không hợp lệ hoặc đã hết hạn",
    });
  }
}

// ✅ Middleware chỉ cho ADMIN
export function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const queryToken = String(req.query?.token || "").trim();

    let token = "";

    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    } else if (queryToken) {
      token = queryToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Thiếu token admin",
      });
    }

    const payload = verifyAdminJwtToken(token);

    if (!payload || payload.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Không có quyền admin",
      });
    }

    req.admin = payload;
    next();
  } catch (e) {
    return res.status(401).json({
      success: false,
      message: "Token admin không hợp lệ hoặc đã hết hạn",
    });
  }
}

// ✅ Middleware cho ADMIN hoặc STAFF
export function requireAdminOrStaff(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const queryToken = String(req.query?.token || "").trim();

    let token = "";

    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    } else if (queryToken) {
      token = queryToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Thiếu token admin",
      });
    }

    const payload = verifyAdminJwtToken(token);

    if (!payload || !["ADMIN", "STAFF"].includes(payload.role)) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền truy cập",
      });
    }

    req.admin = payload;
    next();
  } catch (e) {
    return res.status(401).json({
      success: false,
      message: "Token admin không hợp lệ hoặc đã hết hạn",
    });
  }
}