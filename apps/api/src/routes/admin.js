// Path: goviet247/apps/api/src/routes/admin.js
import { Router } from "express";
import { prisma } from "../utils/db.js";
import { makeAdminController } from "../controllers/adminController.js";
import { adminHuyChuyen } from "../controllers/adminTripController.js";
import {
  requireAdmin,
  requireAdminOrStaff,
} from "../middleware/authMiddleware.js";

import {
  listPricingConfigs,
  updatePricingConfig,
} from "../controllers/pricingController.js";

import {
  getTripConfig,
  updateTripConfig,
} from "../controllers/tripConfigController.js";

import {
  getDriverConfig,
  updateDriverConfig,
} from "../controllers/driverConfigController.js";

import {
  getAlertConfig,
  updateAlertConfig,
} from "../controllers/alertConfigController.js";

import {
  getSystemConfig,
  updateSystemConfig,
} from "../controllers/systemConfigController.js";

import {
  getFeedbackDetail,
  listFeedbacks,
  updateFeedback,
} from "../controllers/feedbackController.js";

import { uploadAccountingDocument } from "../middleware/uploadMiddleware.js";

const router = Router();
const ctrl = makeAdminController(prisma);

// ================= DASHBOARD =================

router.get("/dashboard", requireAdminOrStaff, ctrl.getDashboard);

// ================= ALERT =================

router.get("/alerts", requireAdminOrStaff, ctrl.listAlerts);
router.get("/alerts/:tripId", requireAdminOrStaff, ctrl.listAlertsByTrip);

// ================= SYSTEM NOTIFICATIONS =================

router.get(
  "/system-notifications",
  requireAdminOrStaff,
  ctrl.listSystemNotifications,
);

router.post(
  "/system-notifications",
  requireAdmin,
  ctrl.createSystemNotification,
);

router.patch(
  "/system-notifications/:id",
  requireAdmin,
  ctrl.updateSystemNotification,
);

// ================= PENDING TRIPS =================

router.get("/pending-trips", requireAdminOrStaff, ctrl.listPendingTrips);

router.get(
  "/trips/unverified-cancelled",
  requireAdminOrStaff,
  ctrl.listUnverifiedCancelledTrips,
);

router.get(
  "/pending-trips/cancelled",
  requireAdminOrStaff,
  ctrl.listPendingCancelledTrips,
);

router.get("/trips/:id", requireAdminOrStaff, ctrl.getTripDetail);

router.post("/trips/:id/cancel", requireAdmin, adminHuyChuyen);

// ================= DRIVERS =================

router.get("/drivers", requireAdminOrStaff, ctrl.getDrivers);
router.get("/drivers/:id", requireAdminOrStaff, ctrl.getDriverDetail);
router.get("/drivers/:id/logs", requireAdminOrStaff, ctrl.getDriverLogs);
router.get(
  "/drivers/:id/wallet-transactions",
  requireAdminOrStaff,
  ctrl.getDriverWalletTransactions,
);

router.post("/drivers/:id/wallet/topup", requireAdmin, ctrl.topupDriverWallet);

router.post(
  "/drivers/:id/wallet/adjust-add",
  requireAdmin,
  ctrl.adjustAddDriverWallet,
);

router.post(
  "/drivers/:id/wallet/adjust-subtract",
  requireAdmin,
  ctrl.subtractDriverWallet,
);

router.patch("/drivers/:id/kyc", requireAdmin, ctrl.updateDriverKyc);
router.patch("/drivers/:id/account", requireAdmin, ctrl.updateDriverAccount);

// ================= DRIVER WITHDRAW / SETTLEMENT =================

router.get(
  "/driver-trip-penalties",
  requireAdminOrStaff,
  ctrl.listDriverTripPenaltyLogs,
);

router.post(
  "/driver-trip-penalties/:id/approve",
  requireAdmin,
  ctrl.approveDriverTripPenaltyLog,
);

router.get(
  "/withdraw-requests",
  requireAdminOrStaff,
  ctrl.listDriverWithdrawRequests,
);

router.post(
  "/withdraw-requests/:id/approve",
  requireAdmin,
  ctrl.approveDriverWithdrawRequest,
);

router.post(
  "/withdraw-requests/:id/reject",
  requireAdmin,
  ctrl.rejectDriverWithdrawRequest,
);

router.post(
  "/withdraw-requests/:id/paid",
  requireAdmin,
  ctrl.markDriverWithdrawRequestPaid,
);

router.get(
  "/settlement/weekly",
  requireAdminOrStaff,
  ctrl.getWeeklySettlementSummary,
);

router.post(
  "/settlement/weekly/transfer",
  requireAdmin,
  ctrl.markWeeklyCommissionSettlementTransferred,
);

// ================= COMMISSION PAYOUT =================

router.get(
  "/commission/summary",
  requireAdminOrStaff,
  ctrl.getCommissionPayoutSummary,
);

router.get(
  "/commission/payouts",
  requireAdminOrStaff,
  ctrl.listCommissionPayouts,
);

router.post("/commission/payouts", requireAdmin, ctrl.createCommissionPayout);

// ================= COMPANY CASH TRANSACTIONS =================

router.get(
  "/cash-transactions",
  requireAdminOrStaff,
  ctrl.listCompanyCashTransactions,
);

router.get(
  "/cash-transactions/summary",
  requireAdminOrStaff,
  ctrl.getCompanyCashSummary,
);

router.get(
  "/cash-transactions/export",
  requireAdminOrStaff,
  ctrl.exportCompanyCashTransactions,
);

router.post(
  "/cash-transactions",
  requireAdmin,
  ctrl.createCompanyCashTransaction,
);

router.delete(
  "/cash-transactions/:id",
  requireAdmin,
  ctrl.deleteCompanyCashTransaction,
);

// ================= FEEDBACK =================

router.get("/feedbacks", requireAdminOrStaff, listFeedbacks);
router.get("/feedbacks/:id", requireAdminOrStaff, getFeedbackDetail);
router.patch("/feedbacks/:id", requireAdminOrStaff, updateFeedback);

// =====================================================
// PRICING CONFIG
// =====================================================

router.get("/pricing-configs", requireAdminOrStaff, listPricingConfigs);
router.patch("/pricing-configs/:carType", requireAdmin, updatePricingConfig);

// =====================================================
// TRIP CONFIG
// =====================================================

router.get("/trip-config", requireAdminOrStaff, getTripConfig);
router.patch("/trip-config", requireAdmin, updateTripConfig);

// =====================================================
// DRIVER CONFIG
// =====================================================

router.get("/driver-config", requireAdminOrStaff, getDriverConfig);
router.patch("/driver-config", requireAdmin, updateDriverConfig);

// =====================================================
// ALERT CONFIG
// =====================================================

router.get("/alert-config", requireAdminOrStaff, getAlertConfig);
router.patch("/alert-config", requireAdmin, updateAlertConfig);

// =====================================================
// SYSTEM CONFIG
// =====================================================

router.get("/system-config", requireAdminOrStaff, getSystemConfig);
router.patch("/system-config", requireAdmin, updateSystemConfig);

// =====================================================
// LEDGER / ACCOUNTING
// =====================================================

router.get(
  "/ledger/transactions",
  requireAdminOrStaff,
  ctrl.listLedgerTransactions,
);

router.get("/ledger/summary", requireAdminOrStaff, ctrl.getLedgerSummary);

export default router;

router.get(
  "/accounting-documents",
  requireAdminOrStaff,
  ctrl.listAccountingDocuments,
);

router.post(
  "/accounting-documents",
  requireAdmin,
  uploadAccountingDocument.single("file"),
  ctrl.createAccountingDocument,
);

router.delete(
  "/accounting-documents/:id",
  requireAdmin,
  ctrl.deleteAccountingDocument,
);

router.get(
  "/accounting-summary",
  requireAdminOrStaff,
  ctrl.getAccountingSummary,
);

router.get(
  "/accounting-export/preview",
  requireAdminOrStaff,
  ctrl.getAccountingExportPreview,
);

router.get(
  "/accounting-export/package",
  requireAdminOrStaff,
  ctrl.getAccountingExportPackage,
);

router.get(
  "/accounting-export/zip",
  requireAdminOrStaff,
  ctrl.exportAccountingZip,
);

router.get(
  "/accounting-notes/export",
  requireAdminOrStaff,
  ctrl.exportAccountingNotesCsv,
);

router.get(
  "/revenue-report",
  requireAdminOrStaff,
  ctrl.getRevenueReport,
);

router.get("/accounting-notes", requireAdminOrStaff, ctrl.listAccountingNotes);

router.post("/accounting-notes", requireAdmin, ctrl.createAccountingNote);

router.delete("/accounting-notes/:id", requireAdmin, ctrl.deleteAccountingNote);

router.get("/ledger/trip-accounting", ctrl.listTripAccountingRows);
