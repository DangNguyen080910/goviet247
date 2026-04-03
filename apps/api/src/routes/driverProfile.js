// Path: goviet247/apps/api/src/routes/driverProfile.js
import { Router } from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  createDriverProfile,
  createMyDriverBankAccount,
  createMyDriverWithdrawRequest,
  deleteMyDriverBankAccount,
  getMyDriverProfile,
  getMyDriverWalletSummary,
  setMyDriverDefaultBankAccount,
} from "../controllers/driverProfileController.js";
import {
  getMyDriverNotifications,
  markAllDriverNotificationsAsRead,
} from "../controllers/driverNotificationController.js";

const router = Router();

// Lấy hồ sơ tài xế hiện tại
router.get("/me", verifyToken, getMyDriverProfile);

// Lấy tổng quan ví tài xế hiện tại
router.get("/wallet-summary", verifyToken, getMyDriverWalletSummary);

// Lấy danh sách thông báo của tài xế hiện tại
router.get("/notifications", verifyToken, getMyDriverNotifications);

// Đánh dấu tất cả thông báo của tài xế hiện tại là đã đọc
router.post(
  "/notifications/mark-all-read",
  verifyToken,
  markAllDriverNotificationsAsRead
);

// Thêm tài khoản ngân hàng cho tài xế
router.post("/bank-accounts", verifyToken, createMyDriverBankAccount);

// Xoá tài khoản ngân hàng của tài xế
router.delete(
  "/bank-accounts/:bankAccountId",
  verifyToken,
  deleteMyDriverBankAccount
);

// Đặt tài khoản ngân hàng mặc định cho tài xế
router.patch(
  "/bank-accounts/:bankAccountId/default",
  verifyToken,
  setMyDriverDefaultBankAccount
);

// Tạo yêu cầu rút tiền cho tài xế
router.post("/withdraw-requests", verifyToken, createMyDriverWithdrawRequest);

// Tạo hồ sơ tài xế + 5 giấy tờ bắt buộc
router.post("/", verifyToken, createDriverProfile);

export default router;