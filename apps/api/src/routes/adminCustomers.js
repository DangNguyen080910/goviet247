// Path: goviet247/apps/api/src/routes/adminCustomers.js
import express from "express";
import { requireAdmin, requireAdminOrStaff } from "../middleware/authMiddleware.js";
import {
  getCustomers,
  getCustomerDetail,
  getCustomerLogs,
  suspendCustomer,
  unsuspendCustomer,
} from "../controllers/adminCustomerController.js";

const router = express.Router();

// ✅ ADMIN hoặc STAFF được xem
router.get("/", requireAdminOrStaff, getCustomers);
router.get("/:id", requireAdminOrStaff, getCustomerDetail);
router.get("/:id/logs", requireAdminOrStaff, getCustomerLogs);

// ✅ CHỈ ADMIN được khoá/mở
router.patch("/:id/suspend", requireAdmin, suspendCustomer);
router.patch("/:id/unsuspend", requireAdmin, unsuspendCustomer);

export default router;