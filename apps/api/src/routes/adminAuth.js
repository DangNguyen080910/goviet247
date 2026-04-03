// Path: goviet247/apps/api/src/routes/adminAuth.js
import express from "express";
import bcrypt from "bcrypt";
import { prisma } from "../utils/db.js";
import { signAdminToken } from "../utils/jwt.js";

const router = express.Router();

// POST /api/admin/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // NOTE: giữ nguyên theo schema hiện tại của Đ
    // Nếu trong schema.prisma model tên khác (vd AdminUser),
    // thì đổi prisma.admin_users -> prisma.adminUser tương ứng.
    const user = await prisma.admin_users.findUnique({
      where: { username },
    });

    console.log("[admin login] username:", username);
    console.log("[admin login] user found:", !!user, user?.is_active, user?.role);

    if (!user || user.is_active !== true) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);

    console.log("[admin login] bcrypt ok:", ok);

    if (!ok) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const token = signAdminToken({
      id: user.id,
      role: user.role,
      username: user.username,
    });

    return res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (e) {
    console.error("[admin login] error:", e);
    return res.status(500).json({
      success: false,
      message: e?.message || "Login failed",
    });
  }
});

export default router;