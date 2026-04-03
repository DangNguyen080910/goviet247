// Path: goviet247/apps/web/src/pages/admin/AdminLedger.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  CircularProgress,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Tabs,
  Tab,
} from "@mui/material";
import MenuBookIcon from "@mui/icons-material/MenuBook";

import { getAdminUser } from "../../utils/adminAuth";
import {
  fetchLedgerTransactions,
  fetchTripAccountingRows,
  fetchWithdrawRequests,
} from "../../api/adminLedger";
import { initializeAdminSocketBridge } from "../../services/adminSocket";
import {
  fetchCompanyCashTransactions,
  fetchCompanyCashSummary,
  createCompanyCashTransaction,
  deleteCompanyCashTransaction,
} from "../../api/adminCashTransactions";
import {
  fetchAccountingDocuments,
  createAccountingDocument,
  deleteAccountingDocument,
  fetchAccountingSummary,
  fetchAccountingNotes,
  createAccountingNote,
  deleteAccountingNote,
  exportAccountingNotesCsv,
  fetchAccountingExportPreview,
  exportAccountingZip,
  fetchRevenueReport,
} from "../../api/adminAccountingDocuments";

const TYPE_OPTIONS = [
  { value: "IN", label: "Thu" },
  { value: "OUT", label: "Chi" },
];

const CATEGORY_OPTIONS = [
  { value: "OWNER_CAPITAL", label: "Vốn chủ sở hữu" },
  { value: "DRIVER_TOPUP", label: "Tài xế nạp ví" },
  { value: "COMMISSION_IN", label: "Hoa hồng" },
  { value: "OTHER_IN", label: "Thu khác" },
  { value: "MARKETING", label: "Marketing" },
  { value: "AWS", label: "AWS" },
  { value: "SERVER", label: "Server" },
  { value: "SALARY", label: "Lương" },
  { value: "OPERATIONS", label: "Vận hành" },
  { value: "DRIVER_WITHDRAW", label: "Tài xế rút ví" },
  { value: "OWNER_WITHDRAW", label: "Chủ sở hữu rút tiền" },
  { value: "REFUND", label: "Hoàn tiền" },
  { value: "OTHER_OUT", label: "Chi khác" },
];

const CASH_FORM_CATEGORY_OPTIONS_BY_TYPE = {
  IN: [
    { value: "OWNER_CAPITAL", label: "Vốn chủ sở hữu" },
    { value: "DRIVER_TOPUP", label: "Tài xế nạp ví" },
    { value: "COMMISSION_IN", label: "Hoa hồng" },
    { value: "OTHER_IN", label: "Thu khác" },
  ],
  OUT: [
    { value: "MARKETING", label: "Marketing" },
    { value: "AWS", label: "AWS" },
    { value: "SERVER", label: "Server" },
    { value: "SALARY", label: "Lương" },
    { value: "OPERATIONS", label: "Vận hành" },
    { value: "DRIVER_WITHDRAW", label: "Tài xế rút ví" },
    { value: "OWNER_WITHDRAW", label: "Chủ sở hữu rút tiền" },
    { value: "REFUND", label: "Hoàn tiền" },
    { value: "OTHER_OUT", label: "Chi khác" },
  ],
};

const DEFAULT_CASH_CATEGORY_BY_TYPE = {
  IN: "OWNER_CAPITAL",
  OUT: "MARKETING",
};

const TAB_LIST = [
  { label: "Sao kê ngân hàng" },
  { label: "HĐ đầu vào" },
  { label: "HĐ đầu ra" },
  { label: "Thu chi" },
  { label: "Ví tài xế" },
  { label: "Chuyến đi" },
  { label: "Tài xế rút ví" },
  { label: "Lương" },
  { label: "Hợp đồng" },
  { label: "DT / LN" },
  { label: "Ghi chú" },
  { label: "Export" },
];

const DOCUMENT_TYPE_BY_TAB = {
  0: "BANK_STATEMENT",
  1: "INPUT_INVOICE",
  2: "OUTPUT_INVOICE",
  3: null,
  4: null,
  5: null,
  6: null,
  7: "PAYROLL_HR",
  8: "LEGAL_CONTRACT",
  9: null,
  10: "ACCOUNTING_NOTE",
};

const DOCUMENT_TAB_META = {
  0: {
    title: "Sao Kê Ngân Hàng",
    createTitle: "Thêm tài liệu sao kê ngân hàng",
    emptyText: "Chưa có tài liệu sao kê ngân hàng nào.",
    loadingText: "Đang tải danh sách sao kê ngân hàng...",
    createHint: (quarter, year) =>
      `Tài liệu mới sẽ được lưu vào Q${quarter}/${year}.`,
  },
  1: {
    title: "Hóa Đơn Đầu Vào",
    createTitle: "Thêm tài liệu hóa đơn đầu vào",
    emptyText: "Chưa có hóa đơn đầu vào nào.",
    loadingText: "Đang tải danh sách hóa đơn đầu vào...",
    createHint: (quarter, year) =>
      `Hóa đơn đầu vào mới sẽ được lưu vào Q${quarter}/${year}.`,
  },
  2: {
    title: "Hóa Đơn Đầu Ra",
    createTitle: "Thêm tài liệu hóa đơn đầu ra",
    emptyText: "Chưa có hóa đơn đầu ra nào.",
    loadingText: "Đang tải danh sách hóa đơn đầu ra...",
    createHint: (quarter, year) =>
      `Hóa đơn đầu ra mới sẽ được lưu vào Q${quarter}/${year}.`,
  },
  7: {
    title: "Lương",
    createTitle: "Thêm tài liệu lương & nhân sự",
    emptyText: "Chưa có tài liệu lương & nhân sự nào.",
    loadingText: "Đang tải danh sách tài liệu lương & nhân sự...",
    createHint: (quarter, year) =>
      `Tài liệu lương & nhân sự mới sẽ được lưu vào Q${quarter}/${year}.`,
  },
  8: {
    title: "Hợp Đồng",
    createTitle: "Thêm tài liệu hợp đồng pháp lý",
    emptyText: "Chưa có tài liệu hợp đồng pháp lý nào.",
    loadingText: "Đang tải danh sách tài liệu hợp đồng pháp lý...",
    createHint: (quarter, year) =>
      `Tài liệu hợp đồng pháp lý mới sẽ được lưu vào Q${quarter}/${year}.`,
  },
  10: {
    title: "Ghi Chú",
    createTitle: "Thêm ghi chú kế toán",
    emptyText: "Chưa có ghi chú kế toán nào.",
    loadingText: "Đang tải danh sách ghi chú kế toán...",
    createHint: (quarter, year) =>
      `Ghi chú kế toán mới sẽ được lưu vào Q${quarter}/${year}.`,
  },
};

const QUARTER_OPTIONS = [
  { value: 1, label: "Q1" },
  { value: 2, label: "Q2" },
  { value: 3, label: "Q3" },
  { value: 4, label: "Q4" },
];

const MONTH_OPTIONS = [
  { value: 1, label: "Tháng 1" },
  { value: 2, label: "Tháng 2" },
  { value: 3, label: "Tháng 3" },
  { value: 4, label: "Tháng 4" },
  { value: 5, label: "Tháng 5" },
  { value: 6, label: "Tháng 6" },
  { value: 7, label: "Tháng 7" },
  { value: 8, label: "Tháng 8" },
  { value: 9, label: "Tháng 9" },
  { value: 10, label: "Tháng 10" },
  { value: 11, label: "Tháng 11" },
  { value: 12, label: "Tháng 12" },
];

const DRIVER_WALLET_TYPE_LABELS = {
  TOPUP: "Tài xế nạp ví",
  COMMISSION_HOLD: "Phí môi giới",
  COMMISSION_REFUND: "Hoàn phí môi giới",
  TRIP_CANCEL_PENALTY: "Phạt huỷ chuyến",
  DRIVER_VAT_HOLD: "VAT tài xế",
  DRIVER_VAT_REFUND: "Hoàn VAT tài xế",
  DRIVER_PIT_HOLD: "PIT tài xế",
  DRIVER_PIT_REFUND: "Hoàn PIT tài xế",
  WITHDRAW_REQUEST: "Yêu cầu rút ví",
  WITHDRAW_REJECT_REFUND: "Hoàn tiền từ chối rút",
  WITHDRAW_PAID: "Tài xế rút ví",
  ADJUST_ADD: "Điều chỉnh cộng",
  ADJUST_SUBTRACT: "Điều chỉnh trừ",
};

function formatVND(value) {
  if (!value) return "";
  return Number(value).toLocaleString("vi-VN");
}

function getQuarterDateRange(year, quarter) {
  const safeYear = Number(year) || new Date().getFullYear();
  const safeQuarter = Number(quarter) || 1;
  const startMonth = (safeQuarter - 1) * 3;

  const from = new Date(safeYear, startMonth, 1, 0, 0, 0, 0);
  const to = new Date(safeYear, startMonth + 3, 0, 23, 59, 59, 999);

  const formatDate = (value) => {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  return {
    fromDate: formatDate(from),
    toDate: formatDate(to),
  };
}

function buildCashExportFilename(filters = {}) {
  const fromDate = String(filters?.fromDate || "").trim();
  const toDate = String(filters?.toDate || "").trim();

  if (fromDate && toDate) {
    return `thu_chi_cong_ty_${fromDate}_den_${toDate}.csv`;
  }

  if (fromDate) {
    return `thu_chi_cong_ty_tu_${fromDate}.csv`;
  }

  if (toDate) {
    return `thu_chi_cong_ty_den_${toDate}.csv`;
  }

  return "thu_chi_cong_ty_tat_ca.csv";
}

function buildRevenueReportExportFilename(filters = {}) {
  const quarter = Number(filters?.quarter || 1);
  const year = Number(filters?.year || new Date().getFullYear());

  return `bao_cao_doanh_thu_loi_nhuan_Q${quarter}_${year}.csv`;
}

function downloadCsv(filename, rows) {
  const escapeCell = (value) => {
    const text = String(value ?? "");
    if (text.includes('"') || text.includes(",") || text.includes("\n")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const csv = rows.map((row) => row.map(escapeCell).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  a.click();

  window.URL.revokeObjectURL(url);
}

function normalizeWalletRow(row) {
  const balanceBefore = Number(row?.balanceBefore || 0);
  const balanceAfter = Number(row?.balanceAfter || 0);
  const rawAmount = Number(row?.amount || 0);
  const hasBalanceImpact = balanceBefore !== balanceAfter;

  const driverName =
    row?.driverProfile?.fullName ||
    row?.driverProfile?.user?.displayName ||
    row?.driverProfile?.user?.phones?.[0]?.e164 ||
    "-";

  const phone = row?.driverProfile?.user?.phones?.[0]?.e164 || "-";
  const type = String(row?.type || "");
  const typeLabel = DRIVER_WALLET_TYPE_LABELS[type] || type || "-";

  const relatedRef = row?.tripId
    ? `Chuyến: ${row.tripId}`
    : row?.withdrawRequestId
      ? `Rút tiền: ${row.withdrawRequestId}`
      : "-";

  let note = row?.note || "-";

  if (type === "TRIP_CANCEL_PENALTY") {
    const noteText = String(note || "").trim();
    note = noteText || "Phạt huỷ chuyến";
  }

  const displayAmount =
    type === "WITHDRAW_PAID" ||
    type === "TRIP_CANCEL_PENALTY" ||
    hasBalanceImpact
      ? rawAmount
      : 0;

  return {
    id: row?.id,
    createdAt: row?.createdAt,
    driverName,
    phone,
    type,
    typeLabel,
    hasBalanceImpact,
    balanceImpactLabel: hasBalanceImpact ? "Có" : "Không",
    rawAmount,
    displayAmount,
    balanceBefore,
    balanceAfter,
    tripId: row?.tripId || "",
    withdrawRequestId: row?.withdrawRequestId || "",
    relatedRef,
    note,
  };
}

function transformWalletItemsForAccounting(items = []) {
  const list = Array.isArray(items) ? items : [];

  const cancelledTripIds = new Set(
    list
      .filter((item) => item?.type === "TRIP_CANCEL_PENALTY" && item?.tripId)
      .map((item) => String(item.tripId)),
  );

  const withdrawRequestMap = new Map(
    list
      .filter(
        (item) => item?.type === "WITHDRAW_REQUEST" && item?.withdrawRequestId,
      )
      .map((item) => [String(item.withdrawRequestId), item]),
  );

  return list
    .filter((item) => {
      const type = String(item?.type || "");
      const tripId = item?.tripId ? String(item.tripId) : "";

      if (type === "WITHDRAW_REQUEST") {
        return false;
      }

      if (
        tripId &&
        cancelledTripIds.has(tripId) &&
        ["COMMISSION_HOLD", "DRIVER_VAT_HOLD", "DRIVER_PIT_HOLD"].includes(type)
      ) {
        return false;
      }

      return true;
    })
    .map((item) => {
      const type = String(item?.type || "");

      if (type !== "WITHDRAW_PAID" || !item?.withdrawRequestId) {
        return item;
      }

      const requestRow = withdrawRequestMap.get(String(item.withdrawRequestId));

      if (!requestRow) {
        return {
          ...item,
          amount: -Math.abs(Number(item.amount || 0)),
        };
      }

      return {
        ...item,
        amount: -Math.abs(Number(requestRow.amount || 0)),
        balanceBefore: requestRow.balanceBefore,
        balanceAfter: requestRow.balanceAfter,
      };
    });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

export default function AdminLedger() {
  const user = getAdminUser();
  const role = String(user?.role || "").toUpperCase();
  const isSuperAdmin = role === "ADMIN";

  const currentYear = new Date().getFullYear();

  const [docItems, setDocItems] = useState([]);
  const [docLoading, setDocLoading] = useState(false);
  const [docFilters, setDocFilters] = useState({
    quarter: 1,
    year: currentYear,
  });
  const [docForm, setDocForm] = useState({
    title: "",
    description: "",
    month: "",
    file: null,
  });

  const [accountingSummary, setAccountingSummary] = useState({
    quarter: 1,
    year: currentYear,
    items: [],
  });
  const [accountingSummaryLoading, setAccountingSummaryLoading] =
    useState(false);

  const [accountingNotes, setAccountingNotes] = useState([]);
  const [accountingNotesLoading, setAccountingNotesLoading] = useState(false);
  const [noteForm, setNoteForm] = useState({
    title: "",
    content: "",
  });

  const docFileInputRef = useRef(null);

  const [cashItems, setCashItems] = useState([]);
  const [cashSummary, setCashSummary] = useState({
    totalIn: 0,
    totalOut: 0,
    balance: 0,
  });

  const [cashForm, setCashForm] = useState({
    txnDate: "",
    type: "IN",
    category: DEFAULT_CASH_CATEGORY_BY_TYPE.IN,
    amount: "",
    note: "",
    source: "",
  });

  const [cashFilters, setCashFilters] = useState({
    fromDate: "",
    toDate: "",
  });

  const [tripItems, setTripItems] = useState([]);
  const [tripLoading, setTripLoading] = useState(false);
  const [tripFilters, setTripFilters] = useState({
    quarter: 1,
    year: currentYear,
  });

  const [withdrawItems, setWithdrawItems] = useState([]);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawFilters, setWithdrawFilters] = useState({
    quarter: 1,
    year: currentYear,
  });

  const [revenueFilters, setRevenueFilters] = useState({
    quarter: 1,
    year: currentYear,
  });

  const [revenueReport, setRevenueReport] = useState({
    revenue: {
      commission: 0,
      penalty: 0,
      total: 0,
    },
    expense: {
      total: 0,
      byCategory: {},
    },
    profit: {
      amount: 0,
    },
    meta: {
      totalCompletedTrips: 0,
      totalTripValue: 0,
      totalPenalties: 0,
    },
  });

  const [revenueLoading, setRevenueLoading] = useState(false);

  const [cashLoading, setCashLoading] = useState(false);
  const [walletItems, setWalletItems] = useState([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletFilters, setWalletFilters] = useState({
    quarter: 1,
    year: currentYear,
  });
  const [tab, setTab] = useState(0);

  const [snackbar, setSnackbar] = useState({
    open: false,
    severity: "success",
    message: "",
  });

  const [exportQuarter, setExportQuarter] = useState(1);
  const [exportYear, setExportYear] = useState(currentYear);
  const [exportPreview, setExportPreview] = useState(null);
  const [exportPreviewLoading, setExportPreviewLoading] = useState(false);
  const [exportPreviewError, setExportPreviewError] = useState("");

  const [exportZipLoading, setExportZipLoading] = useState(false);

  const walletItemsForAccounting = useMemo(() => {
    return transformWalletItemsForAccounting(walletItems).map(
      normalizeWalletRow,
    );
  }, [walletItems]);

  const showSnackbar = useCallback((severity, message) => {
    setSnackbar({
      open: true,
      severity,
      message,
    });
  }, []);

  const closeSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const loadCashData = useCallback(async () => {
    try {
      setCashLoading(true);

      const [listRes, summaryRes] = await Promise.all([
        fetchCompanyCashTransactions(cashFilters),
        fetchCompanyCashSummary(cashFilters),
      ]);

      setCashItems(listRes.items || []);
      setCashSummary(summaryRes || { totalIn: 0, totalOut: 0, balance: 0 });
    } catch (error) {
      console.error("cash load error:", error);
      showSnackbar(
        "error",
        error.message || "Không thể tải dữ liệu thu chi công ty.",
      );
    } finally {
      setCashLoading(false);
    }
  }, [cashFilters, showSnackbar]);

  const loadAccountingDocuments = useCallback(async () => {
    const documentType = DOCUMENT_TYPE_BY_TAB[tab];

    if (!documentType) {
      setDocItems([]);
      return;
    }

    try {
      setDocLoading(true);

      const res = await fetchAccountingDocuments({
        documentType,
        quarter: docFilters.quarter,
        year: docFilters.year,
      });

      setDocItems(res.items || []);
    } catch (error) {
      console.error("loadAccountingDocuments error:", error);
      showSnackbar(
        "error",
        error.message || "Không thể tải danh sách tài liệu kế toán.",
      );
      setDocItems([]);
    } finally {
      setDocLoading(false);
    }
  }, [tab, docFilters, showSnackbar]);

  const loadAccountingSummary = useCallback(async () => {
    try {
      setAccountingSummaryLoading(true);

      const res = await fetchAccountingSummary({
        quarter: docFilters.quarter,
        year: docFilters.year,
      });

      setAccountingSummary(
        res.summary || {
          quarter: docFilters.quarter,
          year: docFilters.year,
          items: [],
        },
      );
    } catch (error) {
      console.error("loadAccountingSummary error:", error);
      showSnackbar(
        "error",
        error.message || "Không thể tải summary ghi chú kế toán.",
      );
      setAccountingSummary({
        quarter: docFilters.quarter,
        year: docFilters.year,
        items: [],
      });
    } finally {
      setAccountingSummaryLoading(false);
    }
  }, [docFilters, showSnackbar]);

  const loadAccountingNotes = useCallback(async () => {
    try {
      setAccountingNotesLoading(true);

      const res = await fetchAccountingNotes({
        quarter: docFilters.quarter,
        year: docFilters.year,
      });

      setAccountingNotes(Array.isArray(res.items) ? res.items : []);
    } catch (error) {
      console.error("loadAccountingNotes error:", error);
      showSnackbar("error", error.message || "Không thể tải ghi chú kế toán.");
      setAccountingNotes([]);
    } finally {
      setAccountingNotesLoading(false);
    }
  }, [docFilters, showSnackbar]);

  const handleCreateAccountingNote = async () => {
    try {
      if (!noteForm.title.trim()) {
        showSnackbar("error", "Vui lòng nhập tiêu đề ghi chú.");
        return;
      }

      if (!noteForm.content.trim()) {
        showSnackbar("error", "Vui lòng nhập nội dung ghi chú.");
        return;
      }

      await createAccountingNote({
        title: noteForm.title.trim(),
        content: noteForm.content.trim(),
        quarter: docFilters.quarter,
        year: docFilters.year,
      });

      setNoteForm({
        title: "",
        content: "",
      });

      showSnackbar("success", "Đã thêm ghi chú kế toán.");
      loadAccountingNotes();
    } catch (error) {
      console.error("handleCreateAccountingNote error:", error);
      showSnackbar("error", error.message || "Không thể thêm ghi chú kế toán.");
    }
  };

  const handleDeleteAccountingNote = async (id) => {
    try {
      await deleteAccountingNote(id);
      showSnackbar("success", "Đã xoá ghi chú kế toán.");
      loadAccountingNotes();
    } catch (error) {
      console.error("handleDeleteAccountingNote error:", error);
      showSnackbar("error", error.message || "Không thể xoá ghi chú kế toán.");
    }
  };

  const handleExportAccountingNotesCsv = async () => {
    try {
      await exportAccountingNotesCsv({
        quarter: docFilters.quarter,
        year: docFilters.year,
      });

      showSnackbar("success", "Đã export CSV ghi chú kế toán.");
    } catch (error) {
      console.error("handleExportAccountingNotesCsv error:", error);
      showSnackbar(
        "error",
        error.message || "Không thể export CSV ghi chú kế toán.",
      );
    }
  };

  const loadWalletData = useCallback(async () => {
    try {
      setWalletLoading(true);

      const { fromDate, toDate } = getQuarterDateRange(
        walletFilters.year,
        walletFilters.quarter,
      );

      const res = await fetchLedgerTransactions({
        dateFrom: fromDate,
        dateTo: toDate,
        page: 1,
        pageSize: 5000,
        type: "ALL",
      });

      setWalletItems(res.items || []);
    } catch (error) {
      console.error("loadWalletData error:", error);
      showSnackbar(
        "error",
        error.message || "Không thể tải dữ liệu ví tài xế.",
      );
      setWalletItems([]);
    } finally {
      setWalletLoading(false);
    }
  }, [walletFilters, showSnackbar]);

  const loadTripData = useCallback(async () => {
    if (!isSuperAdmin) return;

    try {
      setTripLoading(true);

      const data = await fetchTripAccountingRows(tripFilters);

      setTripItems(data.items || []);
    } catch (e) {
      console.error("loadTripData error:", e);
    } finally {
      setTripLoading(false);
    }
  }, [isSuperAdmin, tripFilters]);

  const loadWithdrawData = useCallback(async () => {
    if (!isSuperAdmin) return;

    try {
      setWithdrawLoading(true);

      const { fromDate, toDate } = getQuarterDateRange(
        withdrawFilters.year,
        withdrawFilters.quarter,
      );

      const data = await fetchWithdrawRequests({
        fromDate,
        toDate,
        page: 1,
        pageSize: 5000,
        status: "ALL",
      });

      setWithdrawItems(data.items || []);
    } catch (error) {
      console.error("loadWithdrawData error:", error);
      showSnackbar(
        "error",
        error.message || "Không thể tải dữ liệu tài xế rút ví.",
      );
      setWithdrawItems([]);
    } finally {
      setWithdrawLoading(false);
    }
  }, [isSuperAdmin, withdrawFilters, showSnackbar]);

  const loadRevenueReport = useCallback(async () => {
    try {
      setRevenueLoading(true);

      const res = await fetchRevenueReport({
        quarter: revenueFilters.quarter,
        year: revenueFilters.year,
      });

      setRevenueReport(
        res?.data || {
          revenue: {
            commission: 0,
            penalty: 0,
            total: 0,
          },
          expense: {
            total: 0,
            byCategory: {},
          },
          profit: {
            amount: 0,
          },
          meta: {
            totalCompletedTrips: 0,
            totalTripValue: 0,
            totalPenalties: 0,
          },
        },
      );
    } catch (error) {
      console.error("loadRevenueReport error:", error);
      showSnackbar(
        "error",
        error.message || "Không thể tải báo cáo doanh thu / lợi nhuận.",
      );

      setRevenueReport({
        revenue: {
          commission: 0,
          penalty: 0,
          total: 0,
        },
        expense: {
          total: 0,
          byCategory: {},
        },
        profit: {
          amount: 0,
        },
        meta: {
          totalCompletedTrips: 0,
          totalTripValue: 0,
          totalPenalties: 0,
        },
      });
    } finally {
      setRevenueLoading(false);
    }
  }, [revenueFilters, showSnackbar]);

  const handleExportWalletCsv = () => {
    const rows = [
      [
        "Ngày giờ",
        "Mã giao dịch",
        "Tài xế",
        "SĐT",
        "Loại giao dịch",
        "Số tiền",
        "Số dư trước",
        "Số dư sau",
        "Mã chuyến",
        "Liên quan",
        "Ghi chú",
      ],
      ...walletItemsForAccounting.map((row) => [
        new Date(row.createdAt).toLocaleString("vi-VN"),
        row.id,
        row.driverName,
        row.phone,
        row.typeLabel,
        row.displayAmount,
        row.balanceBefore,
        row.balanceAfter,
        row.tripId,
        row.relatedRef,
        row.note,
      ]),
    ];

    downloadCsv(
      `vi_tai_xe_q${walletFilters.quarter}_${walletFilters.year}.csv`,
      rows,
    );
  };

  const handleCreateDocument = async () => {
    const documentType = DOCUMENT_TYPE_BY_TAB[tab];

    if (!documentType) {
      showSnackbar("error", "Tab hiện tại chưa hỗ trợ tạo tài liệu.");
      return;
    }

    if (!docForm.title.trim()) {
      showSnackbar("error", "Vui lòng nhập tiêu đề tài liệu.");
      return;
    }

    if (!docForm.file) {
      showSnackbar("error", "Vui lòng chọn file upload.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("documentType", documentType);
      formData.append("title", docForm.title.trim());
      formData.append("description", docForm.description.trim());
      formData.append("quarter", String(docFilters.quarter));
      formData.append("year", String(docFilters.year));

      if (docForm.month) {
        formData.append("month", String(docForm.month));
      }

      formData.append("file", docForm.file);

      await createAccountingDocument(formData);

      showSnackbar("success", "Đã upload tài liệu kế toán.");

      setDocForm({
        title: "",
        description: "",
        month: "",
        file: null,
      });

      if (docFileInputRef.current) {
        docFileInputRef.current.value = "";
      }

      await loadAccountingDocuments();
    } catch (error) {
      console.error("handleCreateDocument error:", error);
      showSnackbar("error", error.message || "Lỗi upload tài liệu kế toán.");

      if (docFileInputRef.current) {
        docFileInputRef.current.value = "";
      }

      setDocForm((prev) => ({
        ...prev,
        file: null,
      }));
    }
  };

  const handleDeleteDocument = async (id) => {
    if (!window.confirm("Xoá tài liệu này?")) return;

    try {
      await deleteAccountingDocument(id);
      showSnackbar("success", "Đã xoá tài liệu.");
      await loadAccountingDocuments();
    } catch (error) {
      console.error("handleDeleteDocument error:", error);
      showSnackbar("error", error.message || "Không thể xoá tài liệu.");
    }
  };

  const handlePreviewAccountingExport = useCallback(async () => {
    try {
      setExportPreviewLoading(true);
      setExportPreviewError("");

      const data = await fetchAccountingExportPreview({
        quarter: exportQuarter,
        year: exportYear,
      });

      setExportPreview(data?.data || null);
    } catch (err) {
      setExportPreview(null);
      setExportPreviewError(
        err?.message || "Không thể tải dữ liệu xem trước export.",
      );
    } finally {
      setExportPreviewLoading(false);
    }
  }, [exportQuarter, exportYear]);

  const handleExportAccountingZip = useCallback(async () => {
    try {
      setExportZipLoading(true);
      setExportPreviewError("");

      await exportAccountingZip({
        quarter: exportQuarter,
        year: exportYear,
      });

      setSnackbar({
        open: true,
        severity: "success",
        message: "Đang tải file ZIP kế toán...",
      });
    } catch (err) {
      setExportPreviewError(err?.message || "Không thể export file ZIP.");
      setSnackbar({
        open: true,
        severity: "error",
        message: err?.message || "Không thể export file ZIP.",
      });
    } finally {
      setExportZipLoading(false);
    }
  }, [exportQuarter, exportYear, setSnackbar]);

  useEffect(() => {
    loadCashData();
  }, [loadCashData]);

  useEffect(() => {
    if (tab === 10) {
      loadAccountingSummary();
      loadAccountingNotes();
      return;
    }

    const documentType = DOCUMENT_TYPE_BY_TAB[tab];
    if (!documentType) return;

    loadAccountingDocuments();
  }, [
    tab,
    loadAccountingDocuments,
    loadAccountingSummary,
    loadAccountingNotes,
  ]);

  useEffect(() => {
    if (tab !== 4) return;
    loadWalletData();
  }, [tab, loadWalletData]);

  useEffect(() => {
    if (tab === 5) {
      loadTripData();
    }
  }, [tab, loadTripData]);

  useEffect(() => {
    if (tab === 6) {
      loadWithdrawData();
    }
  }, [tab, loadWithdrawData]);

  useEffect(() => {
    if (tab === 9) {
      loadRevenueReport();
    }
  }, [tab, loadRevenueReport]);

  useEffect(() => {
    initializeAdminSocketBridge();

    let timeoutId = null;

    const handleRealtimeLedgerChanged = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        if (tab === 3) {
          loadCashData();
        }

        if (tab === 4) {
          loadWalletData();
        }

        if (tab === 5) {
          loadTripData();
        }

        if (tab === 6) {
          loadWithdrawData();
        }

        if (tab === 9) {
          loadRevenueReport();
        }

        if (tab === 10) {
          loadAccountingSummary();
          loadAccountingNotes();
        }
      }, 150);
    };

    window.addEventListener(
      "admin:dashboard_changed",
      handleRealtimeLedgerChanged,
    );

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      window.removeEventListener(
        "admin:dashboard_changed",
        handleRealtimeLedgerChanged,
      );
    };
  }, [
    tab,
    loadCashData,
    loadWalletData,
    loadTripData,
    loadWithdrawData,
    loadRevenueReport,
    loadAccountingSummary,
    loadAccountingNotes,
  ]);

  const handleCreateCash = async () => {
    try {
      if (!cashForm.txnDate || !cashForm.amount) {
        showSnackbar("error", "Thiếu dữ liệu.");
        return;
      }

      await createCompanyCashTransaction({
        ...cashForm,
        amount: Number(cashForm.amount),
      });

      showSnackbar("success", "Đã thêm thu/chi.");

      setCashForm({
        txnDate: "",
        type: "IN",
        category: DEFAULT_CASH_CATEGORY_BY_TYPE.IN,
        amount: "",
        note: "",
        source: "",
      });

      await loadCashData();
    } catch (error) {
      console.error("create cash error:", error);
      showSnackbar("error", error.message || "Không thể thêm thu chi.");
    }
  };

  const handleDeleteCash = async (id) => {
    if (!window.confirm("Xoá dòng này?")) return;

    try {
      await deleteCompanyCashTransaction(id);
      showSnackbar("success", "Đã xoá.");
      await loadCashData();
    } catch (error) {
      console.error("delete cash error:", error);
      showSnackbar("error", error.message || "Không thể xoá dòng thu chi.");
    }
  };

  const handleExportCash = () => {
    const rows = [
      [
        "Ngày",
        "Loại",
        "Nhóm",
        "Số tiền",
        "Nguồn",
        "Ghi chú",
        "Mã nguồn",
        "Người tạo",
      ],
      ...cashItems.map((row) => [
        new Date(row.txnDate).toLocaleString("vi-VN"),
        row.type === "IN" ? "Thu" : "Chi",
        CATEGORY_OPTIONS.find((item) => item.value === row.category)?.label ||
          row.category ||
          "-",
        row.amount,
        row.source || "-",
        row.note || "-",
        row.referenceCode || "-",
        row.createdByUsername || "-",
      ]),
    ];

    downloadCsv(buildCashExportFilename(cashFilters), rows);
  };

  function handleExportTripCsv() {
    if (!tripItems || tripItems.length === 0) {
      alert("Không có dữ liệu để export.");
      return;
    }

    const headers = [
      "Loại dòng",
      "Mã chuyến",
      "Ngày giờ",
      "Tài xế",
      "SĐT",
      "Loại xe",
      "Chiều",
      "Giá chuyến",
      "Phí môi giới",
      "VAT",
      "PIT",
      "Tổng khấu trừ",
      "Tài xế nhận",
      "Phạt huỷ",
      "Ghi chú",
    ];

    const rows = tripItems.map((row) => [
      row.rowTypeLabel || "",
      row.tripId || "",
      row.eventAt ? new Date(row.eventAt).toLocaleString("vi-VN") : "",
      row.driverName || "",
      row.driverPhone || "",
      row.carTypeLabel || "",
      row.directionLabel || "",

      row.totalPrice != null ? row.totalPrice : "",
      row.commissionAmount != null ? row.commissionAmount : "",
      row.driverVatAmount != null ? row.driverVatAmount : "",
      row.driverPitAmount != null ? row.driverPitAmount : "",
      row.totalDeduction != null ? row.totalDeduction : "",
      row.driverReceive != null ? row.driverReceive : "",

      row.penaltyAmount != null ? row.penaltyAmount : "",
      row.note || "",
    ]);

    const csvContent =
      "\uFEFF" +
      [headers, ...rows]
        .map((r) =>
          r
            .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
            .join(","),
        )
        .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const fileName = `chuyen_di_Q${tripFilters.quarter}_${tripFilters.year}.csv`;

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleExportWithdrawCsv() {
    if (!withdrawItems || withdrawItems.length === 0) {
      alert("Không có dữ liệu để export.");
      return;
    }

    const headers = [
      "Mã yêu cầu",
      "Ngày tạo",
      "Tài xế",
      "SĐT",
      "Ngân hàng",
      "Số tài khoản",
      "Chủ tài khoản",
      "Số tiền",
      "Trạng thái",
      "Ngày duyệt",
      "Ngày chuyển",
      "Lý do từ chối",
    ];

    const rows = withdrawItems.map((row) => [
      row.id || "",
      row.createdAt ? new Date(row.createdAt).toLocaleString("vi-VN") : "",
      row.driverProfile?.fullName ||
        row.driverProfile?.user?.displayName ||
        row.driverProfile?.user?.phones?.[0]?.e164 ||
        "-",
      row.driverProfile?.user?.phones?.[0]?.e164 || "",
      row.bankAccount?.bankName || "",
      row.bankAccount?.accountNumber || "",
      row.bankAccount?.accountHolderName || "",
      row.amount != null ? row.amount : "",
      row.status || "",
      row.approvedAt ? new Date(row.approvedAt).toLocaleString("vi-VN") : "",
      row.paidAt ? new Date(row.paidAt).toLocaleString("vi-VN") : "",
      row.rejectReason || "",
    ]);

    const csvContent =
      "\uFEFF" +
      [headers, ...rows]
        .map((r) =>
          r
            .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
            .join(","),
        )
        .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const fileName = `tai_xe_rut_vi_Q${withdrawFilters.quarter}_${withdrawFilters.year}.csv`;

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleExportRevenueReportCsv() {
    const expenseEntries = Object.entries(
      revenueReport?.expense?.byCategory || {},
    );

    const rows = [
      ["Nhóm", "Hạng mục", "Giá trị"],

      [
        "DOANH_THU",
        "Doanh thu phí môi giới",
        revenueReport?.revenue?.commission || 0,
      ],
      [
        "DOANH_THU",
        "Doanh thu phạt huỷ chuyến",
        revenueReport?.revenue?.penalty || 0,
      ],
      ["DOANH_THU", "Tổng doanh thu", revenueReport?.revenue?.total || 0],

      ["", "", ""],

      ...(expenseEntries.length > 0
        ? expenseEntries.map(([key, value]) => [
            "CHI_PHI",
            CATEGORY_OPTIONS.find((item) => item.value === key)?.label || key,
            value || 0,
          ])
        : [["CHI_PHI", "Chưa có chi phí nào trong kỳ này", 0]]),

      ["CHI_PHI", "Tổng chi phí", revenueReport?.expense?.total || 0],

      ["", "", ""],

      ["LOI_NHUAN", "Lợi nhuận tạm tính", revenueReport?.profit?.amount || 0],

      ["", "", ""],

      [
        "THAM_CHIEU",
        "Tổng giá trị chuyến hoàn thành",
        revenueReport?.meta?.totalTripValue || 0,
      ],
      [
        "THAM_CHIEU",
        "Số chuyến hoàn thành",
        revenueReport?.meta?.totalCompletedTrips || 0,
      ],
      [
        "THAM_CHIEU",
        "Số lượt phạt huỷ chuyến",
        revenueReport?.meta?.totalPenalties || 0,
      ],
    ];

    downloadCsv(buildRevenueReportExportFilename(revenueFilters), rows);
  }

  if (!isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <Box>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
        >
          <Box>
            <Stack
              direction="row"
              spacing={1.2}
              alignItems="center"
              sx={{ mb: 0.5 }}
            >
              <MenuBookIcon color="primary" />
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                Sổ Sách
              </Typography>
            </Stack>

            <Typography variant="body1" color="text.secondary">
              Xem tổng quan số liệu và quản lý thu chi công ty ngay trên một màn
              hình.
            </Typography>
          </Box>

          <Chip
            label="Quyền: ADMIN"
            color="success"
            variant="outlined"
            sx={{ fontWeight: 700 }}
          />
        </Stack>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack spacing={2.5}>
            <Tabs
              value={tab}
              onChange={(e, v) => setTab(v)}
              variant="scrollable"
              allowScrollButtonsMobile
            >
              {TAB_LIST.map((t, idx) => (
                <Tab key={idx} label={t.label} />
              ))}
            </Tabs>

            {tab === 10 ? (
              <>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  Ghi Chú
                </Typography>

                <Card>
                  <CardContent>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2}
                      alignItems={{ xs: "stretch", md: "center" }}
                      flexWrap="wrap"
                    >
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={2}
                        alignItems={{ xs: "stretch", md: "center" }}
                        flexWrap="wrap"
                      >
                        <TextField
                          select
                          label="Quý"
                          value={docFilters.quarter}
                          onChange={(e) =>
                            setDocFilters((prev) => ({
                              ...prev,
                              quarter: Number(e.target.value),
                            }))
                          }
                          sx={{ minWidth: 140 }}
                        >
                          {QUARTER_OPTIONS.map((o) => (
                            <MenuItem key={o.value} value={o.value}>
                              {o.label}
                            </MenuItem>
                          ))}
                        </TextField>

                        <TextField
                          label="Năm"
                          type="number"
                          value={docFilters.year}
                          onChange={(e) =>
                            setDocFilters((prev) => ({
                              ...prev,
                              year: Number(e.target.value || currentYear),
                            }))
                          }
                          sx={{ minWidth: 140 }}
                        />

                        <Button
                          variant="contained"
                          onClick={() => {
                            loadAccountingSummary();
                            loadAccountingNotes();
                          }}
                        >
                          Lọc
                        </Button>

                        <Button
                          variant="outlined"
                          onClick={handleExportAccountingNotesCsv}
                        >
                          Export CSV
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Stack spacing={1}>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Tóm tắt kế toán Q{accountingSummary.quarter}/
                        {accountingSummary.year}
                      </Typography>

                      <Typography variant="body2" color="text.secondary">
                        Các dòng dưới đây được tổng hợp tự động từ dữ liệu thật
                        trong hệ thống để gửi kế toán.
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>

                <Paper sx={{ overflowX: "auto" }}>
                  {accountingSummaryLoading ? (
                    <Stack
                      spacing={1.5}
                      alignItems="center"
                      justifyContent="center"
                      sx={{ py: 4 }}
                    >
                      <CircularProgress />
                      <Typography color="text.secondary">
                        Đang tải summary ghi chú kế toán...
                      </Typography>
                    </Stack>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Hạng mục</TableCell>
                          <TableCell align="right">Giá trị</TableCell>
                        </TableRow>
                      </TableHead>

                      <TableBody>
                        {(accountingSummary.items || []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} align="center">
                              Chưa có dữ liệu summary cho kỳ này.
                            </TableCell>
                          </TableRow>
                        ) : (
                          accountingSummary.items.map((row) => (
                            <TableRow key={row.key}>
                              <TableCell>{row.label}</TableCell>
                              <TableCell align="right">
                                {formatNumber(row.value)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}
                </Paper>

                <Card>
                  <CardContent>
                    <Stack spacing={2}>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Thêm ghi chú kế toán
                      </Typography>

                      <Typography variant="body2" color="text.secondary">
                        Ghi chú này sẽ được lưu cho Q{docFilters.quarter}/
                        {docFilters.year}.
                      </Typography>

                      <TextField
                        label="Tiêu đề"
                        value={noteForm.title}
                        onChange={(e) =>
                          setNoteForm((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                        fullWidth
                      />

                      <TextField
                        label="Nội dung ghi chú"
                        value={noteForm.content}
                        onChange={(e) =>
                          setNoteForm((prev) => ({
                            ...prev,
                            content: e.target.value,
                          }))
                        }
                        fullWidth
                        multiline
                        minRows={4}
                      />

                      <Stack direction="row" justifyContent="flex-start">
                        <Button
                          variant="contained"
                          onClick={handleCreateAccountingNote}
                        >
                          Thêm ghi chú
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>

                <Paper sx={{ overflowX: "auto" }}>
                  {accountingNotesLoading ? (
                    <Stack
                      spacing={1.5}
                      alignItems="center"
                      justifyContent="center"
                      sx={{ py: 4 }}
                    >
                      <CircularProgress />
                      <Typography color="text.secondary">
                        Đang tải ghi chú kế toán...
                      </Typography>
                    </Stack>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Tiêu đề</TableCell>
                          <TableCell>Nội dung</TableCell>
                          <TableCell>Người tạo</TableCell>
                          <TableCell>Ngày tạo</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableHead>

                      <TableBody>
                        {accountingNotes.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center">
                              Chưa có ghi chú kế toán nào cho kỳ này.
                            </TableCell>
                          </TableRow>
                        ) : (
                          accountingNotes.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell sx={{ minWidth: 220 }}>
                                {row.title}
                              </TableCell>
                              <TableCell
                                sx={{ minWidth: 360, whiteSpace: "pre-wrap" }}
                              >
                                {row.content}
                              </TableCell>
                              <TableCell>
                                {row.createdByUsername || "-"}
                              </TableCell>
                              <TableCell>
                                {new Date(row.createdAt).toLocaleString(
                                  "vi-VN",
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  color="error"
                                  onClick={() =>
                                    handleDeleteAccountingNote(row.id)
                                  }
                                >
                                  Xoá
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}
                </Paper>

                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  Tab Ghi chú hiện đã có summary tự động và ghi chú tay theo
                  quý. Bước tiếp theo mình sẽ làm export CSV riêng cho kế toán.
                </Alert>
              </>
            ) : tab === 9 ? (
              <>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  Doanh Thu / Lợi Nhuận
                </Typography>

                <Card>
                  <CardContent>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2}
                      alignItems={{ xs: "stretch", md: "center" }}
                      flexWrap="wrap"
                    >
                      <TextField
                        select
                        label="Quý"
                        value={revenueFilters.quarter}
                        onChange={(e) =>
                          setRevenueFilters((prev) => ({
                            ...prev,
                            quarter: Number(e.target.value),
                          }))
                        }
                        sx={{ minWidth: 140 }}
                      >
                        {QUARTER_OPTIONS.map((o) => (
                          <MenuItem key={o.value} value={o.value}>
                            {o.label}
                          </MenuItem>
                        ))}
                      </TextField>

                      <TextField
                        label="Năm"
                        type="number"
                        value={revenueFilters.year}
                        onChange={(e) =>
                          setRevenueFilters((prev) => ({
                            ...prev,
                            year: Number(e.target.value || currentYear),
                          }))
                        }
                        sx={{ minWidth: 140 }}
                      />

                      <Stack direction="row" spacing={1}>
                        <Button variant="contained" onClick={loadRevenueReport}>
                          Lọc
                        </Button>

                        <Button
                          variant="outlined"
                          onClick={handleExportRevenueReportCsv}
                        >
                          Export CSV
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>

                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <Card sx={{ flex: 1 }}>
                    <CardContent>
                      <Typography color="text.secondary">
                        Tổng doanh thu công ty
                      </Typography>
                      <Typography sx={{ fontWeight: 800, fontSize: 28, mt: 1 }}>
                        {formatNumber(revenueReport.revenue.total)}
                      </Typography>
                    </CardContent>
                  </Card>

                  <Card sx={{ flex: 1 }}>
                    <CardContent>
                      <Typography color="text.secondary">
                        Tổng chi phí công ty
                      </Typography>
                      <Typography
                        sx={{
                          fontWeight: 800,
                          fontSize: 28,
                          mt: 1,
                          color: "error.main",
                        }}
                      >
                        {formatNumber(revenueReport.expense.total)}
                      </Typography>
                    </CardContent>
                  </Card>

                  <Card sx={{ flex: 1 }}>
                    <CardContent>
                      <Typography color="text.secondary">
                        Lợi nhuận tạm tính
                      </Typography>
                      <Typography
                        sx={{
                          fontWeight: 800,
                          fontSize: 28,
                          mt: 1,
                          color:
                            Number(revenueReport.profit.amount || 0) >= 0
                              ? "success.main"
                              : "warning.main",
                        }}
                      >
                        {formatNumber(revenueReport.profit.amount)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Stack>

                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  Báo cáo này chỉ phản ánh doanh thu từ phí môi giới và phạt huỷ
                  chuyến. Khách hàng thanh toán trực tiếp cho tài xế, không đi
                  qua hệ thống.
                </Alert>

                {revenueLoading ? (
                  <Stack
                    spacing={1.5}
                    alignItems="center"
                    justifyContent="center"
                    sx={{ py: 4 }}
                  >
                    <CircularProgress />
                    <Typography color="text.secondary">
                      Đang tải báo cáo doanh thu / lợi nhuận...
                    </Typography>
                  </Stack>
                ) : (
                  <>
                    <Paper sx={{ overflowX: "auto" }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Hạng mục doanh thu</TableCell>
                            <TableCell align="right">Giá trị</TableCell>
                          </TableRow>
                        </TableHead>

                        <TableBody>
                          <TableRow>
                            <TableCell>Doanh thu phí môi giới</TableCell>
                            <TableCell align="right">
                              {formatNumber(revenueReport.revenue.commission)}
                            </TableCell>
                          </TableRow>

                          <TableRow>
                            <TableCell>Doanh thu phạt huỷ chuyến</TableCell>
                            <TableCell align="right">
                              {formatNumber(revenueReport.revenue.penalty)}
                            </TableCell>
                          </TableRow>

                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>
                              Tổng doanh thu
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              {formatNumber(revenueReport.revenue.total)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </Paper>

                    <Paper sx={{ overflowX: "auto" }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Hạng mục chi phí</TableCell>
                            <TableCell align="right">Giá trị</TableCell>
                          </TableRow>
                        </TableHead>

                        <TableBody>
                          {Object.keys(revenueReport.expense.byCategory || {})
                            .length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={2} align="center">
                                Chưa có chi phí nào trong kỳ này.
                              </TableCell>
                            </TableRow>
                          ) : (
                            <>
                              {Object.entries(
                                revenueReport.expense.byCategory || {},
                              ).map(([key, value]) => (
                                <TableRow key={key}>
                                  <TableCell>
                                    {CATEGORY_OPTIONS.find(
                                      (item) => item.value === key,
                                    )?.label || key}
                                  </TableCell>
                                  <TableCell align="right">
                                    {formatNumber(value)}
                                  </TableCell>
                                </TableRow>
                              ))}

                              <TableRow>
                                <TableCell sx={{ fontWeight: 700 }}>
                                  Tổng chi phí
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{ fontWeight: 700 }}
                                >
                                  {formatNumber(revenueReport.expense.total)}
                                </TableCell>
                              </TableRow>
                            </>
                          )}
                        </TableBody>
                      </Table>
                    </Paper>

                    <Paper sx={{ overflowX: "auto" }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Chỉ số tham chiếu</TableCell>
                            <TableCell align="right">Giá trị</TableCell>
                          </TableRow>
                        </TableHead>

                        <TableBody>
                          <TableRow>
                            <TableCell>
                              Tổng giá trị chuyến hoàn thành
                            </TableCell>
                            <TableCell align="right">
                              {formatNumber(revenueReport.meta.totalTripValue)}
                            </TableCell>
                          </TableRow>

                          <TableRow>
                            <TableCell>Số chuyến hoàn thành</TableCell>
                            <TableCell align="right">
                              {formatNumber(
                                revenueReport.meta.totalCompletedTrips,
                              )}
                            </TableCell>
                          </TableRow>

                          <TableRow>
                            <TableCell>Số lượt phạt huỷ chuyến</TableCell>
                            <TableCell align="right">
                              {formatNumber(revenueReport.meta.totalPenalties)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </Paper>
                  </>
                )}
              </>
            ) : DOCUMENT_TYPE_BY_TAB[tab] ? (
              <>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {DOCUMENT_TAB_META[tab]?.title || "Tài Liệu Kế Toán"}
                </Typography>

                <Card>
                  <CardContent>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2}
                      alignItems={{ xs: "stretch", md: "center" }}
                      flexWrap="wrap"
                    >
                      <TextField
                        select
                        label="Quý"
                        value={docFilters.quarter}
                        onChange={(e) =>
                          setDocFilters((prev) => ({
                            ...prev,
                            quarter: Number(e.target.value),
                          }))
                        }
                        sx={{ minWidth: 140 }}
                      >
                        {QUARTER_OPTIONS.map((o) => (
                          <MenuItem key={o.value} value={o.value}>
                            {o.label}
                          </MenuItem>
                        ))}
                      </TextField>

                      <TextField
                        label="Năm"
                        type="number"
                        value={docFilters.year}
                        onChange={(e) =>
                          setDocFilters((prev) => ({
                            ...prev,
                            year: Number(e.target.value || currentYear),
                          }))
                        }
                        sx={{ minWidth: 140 }}
                      />

                      <Button
                        variant="contained"
                        onClick={loadAccountingDocuments}
                      >
                        Lọc
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Stack spacing={2}>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {DOCUMENT_TAB_META[tab]?.createTitle ||
                          "Thêm tài liệu kế toán"}
                      </Typography>

                      <Typography variant="body2" color="text.secondary">
                        {DOCUMENT_TAB_META[tab]?.createHint
                          ? DOCUMENT_TAB_META[tab].createHint(
                              docFilters.quarter,
                              docFilters.year,
                            )
                          : `Tài liệu mới sẽ được lưu vào Q${docFilters.quarter}/${docFilters.year}.`}
                      </Typography>

                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={2}
                        flexWrap="wrap"
                      >
                        <TextField
                          label="Tiêu đề"
                          value={docForm.title}
                          onChange={(e) =>
                            setDocForm((prev) => ({
                              ...prev,
                              title: e.target.value,
                            }))
                          }
                          sx={{ minWidth: 220 }}
                        />

                        <TextField
                          select
                          label="Tháng"
                          value={docForm.month}
                          onChange={(e) =>
                            setDocForm((prev) => ({
                              ...prev,
                              month: e.target.value,
                            }))
                          }
                          sx={{ minWidth: 160 }}
                        >
                          <MenuItem value="">Không chọn</MenuItem>
                          {MONTH_OPTIONS.map((o) => (
                            <MenuItem key={o.value} value={o.value}>
                              {o.label}
                            </MenuItem>
                          ))}
                        </TextField>

                        <TextField
                          label="Mô tả"
                          value={docForm.description}
                          onChange={(e) =>
                            setDocForm((prev) => ({
                              ...prev,
                              description: e.target.value,
                            }))
                          }
                          sx={{ minWidth: 280 }}
                        />
                      </Stack>

                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={2}
                        alignItems={{ xs: "stretch", md: "center" }}
                        flexWrap="wrap"
                      >
                        <Button variant="outlined" component="label">
                          Chọn file
                          <input
                            ref={docFileInputRef}
                            type="file"
                            hidden
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setDocForm((prev) => ({
                                ...prev,
                                file,
                              }));
                            }}
                          />
                        </Button>

                        {docForm.file ? (
                          <Typography variant="body2">
                            Đã chọn: {docForm.file.name}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Chưa chọn file nào.
                          </Typography>
                        )}

                        <Button
                          variant="contained"
                          onClick={handleCreateDocument}
                        >
                          Thêm tài liệu
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>

                <Paper sx={{ overflowX: "auto" }}>
                  {docLoading ? (
                    <Stack
                      spacing={1.5}
                      alignItems="center"
                      justifyContent="center"
                      sx={{ py: 4 }}
                    >
                      <CircularProgress />
                      <Typography color="text.secondary">
                        {DOCUMENT_TAB_META[tab]?.loadingText ||
                          "Đang tải danh sách tài liệu kế toán..."}
                      </Typography>
                    </Stack>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Tiêu đề</TableCell>
                          <TableCell>Quý/Năm</TableCell>
                          <TableCell>Tháng</TableCell>
                          <TableCell>Tên file</TableCell>
                          <TableCell>Mô tả</TableCell>
                          <TableCell>Người upload</TableCell>
                          <TableCell>Ngày tạo</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableHead>

                      <TableBody>
                        {docItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} align="center">
                              {DOCUMENT_TAB_META[tab]?.emptyText ||
                                "Chưa có tài liệu kế toán nào."}
                            </TableCell>
                          </TableRow>
                        ) : (
                          docItems.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>{row.title}</TableCell>
                              <TableCell>
                                Q{row.quarter}/{row.year}
                              </TableCell>
                              <TableCell>{row.month || "-"}</TableCell>
                              <TableCell>{row.fileName || "-"}</TableCell>
                              <TableCell>{row.description || "-"}</TableCell>
                              <TableCell>
                                {row.uploadedByUsername || "-"}
                              </TableCell>
                              <TableCell>
                                {new Date(row.createdAt).toLocaleString(
                                  "vi-VN",
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  color="error"
                                  onClick={() => handleDeleteDocument(row.id)}
                                >
                                  Xoá
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}
                </Paper>
              </>
            ) : tab === 3 ? (
              <>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  Thu Chi Công Ty
                </Typography>

                <Card>
                  <CardContent>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2}
                      alignItems={{ xs: "stretch", md: "center" }}
                    >
                      <TextField
                        type="date"
                        label="Từ ngày"
                        InputLabelProps={{ shrink: true }}
                        value={cashFilters.fromDate}
                        onChange={(e) =>
                          setCashFilters((prev) => ({
                            ...prev,
                            fromDate: e.target.value,
                          }))
                        }
                      />

                      <TextField
                        type="date"
                        label="Đến ngày"
                        InputLabelProps={{ shrink: true }}
                        value={cashFilters.toDate}
                        onChange={(e) =>
                          setCashFilters((prev) => ({
                            ...prev,
                            toDate: e.target.value,
                          }))
                        }
                      />

                      <Button variant="contained" onClick={loadCashData}>
                        Lọc
                      </Button>

                      <Button variant="outlined" onClick={handleExportCash}>
                        Export CSV
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>

                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <Card sx={{ flex: 1 }}>
                    <CardContent>
                      <Typography>Tổng thu</Typography>
                      <Typography color="green" sx={{ fontWeight: 700 }}>
                        {formatNumber(cashSummary.totalIn)}
                      </Typography>
                    </CardContent>
                  </Card>

                  <Card sx={{ flex: 1 }}>
                    <CardContent>
                      <Typography>Tổng chi</Typography>
                      <Typography color="red" sx={{ fontWeight: 700 }}>
                        {formatNumber(cashSummary.totalOut)}
                      </Typography>
                    </CardContent>
                  </Card>

                  <Card sx={{ flex: 1 }}>
                    <CardContent>
                      <Typography>Chênh lệch</Typography>
                      <Typography sx={{ fontWeight: 700 }}>
                        {formatNumber(cashSummary.balance)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Stack>

                <Card>
                  <CardContent>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2}
                      flexWrap="wrap"
                    >
                      <TextField
                        type="date"
                        label="Ngày"
                        InputLabelProps={{ shrink: true }}
                        value={cashForm.txnDate}
                        onChange={(e) =>
                          setCashForm((prev) => ({
                            ...prev,
                            txnDate: e.target.value,
                          }))
                        }
                      />

                      <TextField
                        select
                        label="Loại"
                        value={cashForm.type}
                        onChange={(e) => {
                          const nextType = e.target.value;
                          setCashForm((prev) => ({
                            ...prev,
                            type: nextType,
                            category:
                              DEFAULT_CASH_CATEGORY_BY_TYPE[nextType] ||
                              DEFAULT_CASH_CATEGORY_BY_TYPE.IN,
                          }));
                        }}
                        sx={{ minWidth: 120 }}
                      >
                        {TYPE_OPTIONS.map((o) => (
                          <MenuItem key={o.value} value={o.value}>
                            {o.label}
                          </MenuItem>
                        ))}
                      </TextField>

                      <TextField
                        select
                        label="Nhóm"
                        value={cashForm.category}
                        onChange={(e) =>
                          setCashForm((prev) => ({
                            ...prev,
                            category: e.target.value,
                          }))
                        }
                        sx={{ minWidth: 220 }}
                      >
                        {(
                          CASH_FORM_CATEGORY_OPTIONS_BY_TYPE[cashForm.type] ||
                          []
                        ).map((o) => (
                          <MenuItem key={o.value} value={o.value}>
                            {o.label}
                          </MenuItem>
                        ))}
                      </TextField>

                      <TextField
                        label="Số tiền"
                        value={formatVND(cashForm.amount)}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\./g, "");
                          if (!isNaN(raw)) {
                            setCashForm((prev) => ({
                              ...prev,
                              amount: raw,
                            }));
                          }
                        }}
                        InputProps={{
                          endAdornment: (
                            <span style={{ marginLeft: 8 }}>VNĐ</span>
                          ),
                        }}
                      />

                      <TextField
                        label="Nguồn"
                        value={cashForm.source}
                        onChange={(e) =>
                          setCashForm((prev) => ({
                            ...prev,
                            source: e.target.value,
                          }))
                        }
                      />

                      <TextField
                        label="Ghi chú"
                        value={cashForm.note}
                        onChange={(e) =>
                          setCashForm((prev) => ({
                            ...prev,
                            note: e.target.value,
                          }))
                        }
                      />

                      <Button variant="contained" onClick={handleCreateCash}>
                        Thêm
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>

                <Paper sx={{ overflowX: "auto" }}>
                  {cashLoading ? (
                    <Stack
                      spacing={1.5}
                      alignItems="center"
                      justifyContent="center"
                      sx={{ py: 4 }}
                    >
                      <CircularProgress />
                      <Typography color="text.secondary">
                        Đang tải dữ liệu thu chi công ty...
                      </Typography>
                    </Stack>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Ngày</TableCell>
                          <TableCell>Loại</TableCell>
                          <TableCell>Nhóm</TableCell>
                          <TableCell>Số tiền</TableCell>
                          <TableCell>Nguồn</TableCell>
                          <TableCell>Ghi chú</TableCell>
                          <TableCell>Người tạo</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableHead>

                      <TableBody>
                        {cashItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} align="center">
                              Chưa có dòng thu chi nào.
                            </TableCell>
                          </TableRow>
                        ) : (
                          cashItems.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>
                                {new Date(row.txnDate).toLocaleDateString(
                                  "vi-VN",
                                )}
                              </TableCell>
                              <TableCell>{row.type}</TableCell>
                              <TableCell>{row.category}</TableCell>
                              <TableCell>{formatNumber(row.amount)}</TableCell>
                              <TableCell>{row.source || "-"}</TableCell>
                              <TableCell>{row.note || "-"}</TableCell>
                              <TableCell>
                                {row.createdByUsername || "-"}
                              </TableCell>
                              <TableCell>
                                <Button
                                  color="error"
                                  onClick={() => handleDeleteCash(row.id)}
                                >
                                  Xoá
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}
                </Paper>
              </>
            ) : tab === 4 ? (
              <>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  Ví Tài Xế
                </Typography>

                <Card>
                  <CardContent>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2}
                      alignItems={{ xs: "stretch", md: "center" }}
                      flexWrap="wrap"
                    >
                      <TextField
                        select
                        label="Quý"
                        value={walletFilters.quarter}
                        onChange={(e) =>
                          setWalletFilters((prev) => ({
                            ...prev,
                            quarter: Number(e.target.value),
                          }))
                        }
                        sx={{ minWidth: 140 }}
                      >
                        {QUARTER_OPTIONS.map((o) => (
                          <MenuItem key={o.value} value={o.value}>
                            {o.label}
                          </MenuItem>
                        ))}
                      </TextField>

                      <TextField
                        label="Năm"
                        type="number"
                        value={walletFilters.year}
                        onChange={(e) =>
                          setWalletFilters((prev) => ({
                            ...prev,
                            year: Number(e.target.value || currentYear),
                          }))
                        }
                        sx={{ minWidth: 140 }}
                      />

                      <Button variant="contained" onClick={loadWalletData}>
                        Lọc
                      </Button>

                      <Button
                        variant="outlined"
                        onClick={handleExportWalletCsv}
                      >
                        Export CSV
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>

                <Paper sx={{ overflowX: "auto" }}>
                  {walletLoading ? (
                    <Stack
                      spacing={1.5}
                      alignItems="center"
                      justifyContent="center"
                      sx={{ py: 4 }}
                    >
                      <CircularProgress />
                      <Typography color="text.secondary">
                        Đang tải dữ liệu ví tài xế...
                      </Typography>
                    </Stack>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Ngày giờ</TableCell>
                          <TableCell>Tài xế</TableCell>
                          <TableCell>SĐT</TableCell>
                          <TableCell>Loại</TableCell>
                          <TableCell>Số tiền</TableCell>
                          <TableCell>Số dư trước</TableCell>
                          <TableCell>Số dư sau</TableCell>
                          <TableCell>Liên quan</TableCell>
                          <TableCell>Ghi chú</TableCell>
                        </TableRow>
                      </TableHead>

                      <TableBody>
                        {walletItemsForAccounting.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} align="center">
                              Chưa có giao dịch ví tài xế nào trong kỳ này.
                            </TableCell>
                          </TableRow>
                        ) : (
                          walletItemsForAccounting.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                {new Date(item.createdAt).toLocaleString(
                                  "vi-VN",
                                )}
                              </TableCell>
                              <TableCell>{item.driverName}</TableCell>
                              <TableCell>{item.phone}</TableCell>
                              <TableCell>{item.typeLabel}</TableCell>
                              <TableCell>
                                {formatNumber(item.displayAmount)}
                              </TableCell>
                              <TableCell>
                                {formatNumber(item.balanceBefore)}
                              </TableCell>
                              <TableCell>
                                {formatNumber(item.balanceAfter)}
                              </TableCell>
                              <TableCell>{item.relatedRef}</TableCell>
                              <TableCell>{item.note}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}
                </Paper>
              </>
            ) : tab === 5 ? (
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Stack spacing={2}>
                  <Typography variant="h5" fontWeight={700}>
                    Chuyến đi
                  </Typography>

                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField
                      select
                      label="Quý"
                      value={tripFilters.quarter}
                      onChange={(e) =>
                        setTripFilters((prev) => ({
                          ...prev,
                          quarter: Number(e.target.value),
                        }))
                      }
                      sx={{ minWidth: 140 }}
                    >
                      {[1, 2, 3, 4].map((q) => (
                        <MenuItem key={q} value={q}>
                          Q{q}
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      label="Năm"
                      type="number"
                      value={tripFilters.year}
                      onChange={(e) =>
                        setTripFilters((prev) => ({
                          ...prev,
                          year: Number(e.target.value),
                        }))
                      }
                      sx={{ minWidth: 160 }}
                    />

                    <Stack direction="row" spacing={1}>
                      <Button variant="contained" onClick={loadTripData}>
                        LỌC
                      </Button>

                      <Button variant="outlined" onClick={handleExportTripCsv}>
                        EXPORT CSV
                      </Button>
                    </Stack>
                  </Stack>

                  {tripLoading ? (
                    <Stack alignItems="center" sx={{ py: 4 }}>
                      <CircularProgress />
                    </Stack>
                  ) : (
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Loại dòng</TableCell>
                          <TableCell>Mã chuyến</TableCell>
                          <TableCell>Ngày giờ</TableCell>
                          <TableCell>Tài xế</TableCell>
                          <TableCell>SĐT</TableCell>
                          <TableCell>Loại xe</TableCell>
                          <TableCell>Chiều</TableCell>
                          <TableCell align="right">Giá chuyến</TableCell>
                          <TableCell align="right">Phí môi giới</TableCell>
                          <TableCell align="right">VAT</TableCell>
                          <TableCell align="right">PIT</TableCell>
                          <TableCell align="right">Tổng khấu trừ</TableCell>
                          <TableCell align="right">Tài xế nhận</TableCell>
                          <TableCell align="right">Phạt huỷ</TableCell>
                          <TableCell>Ghi chú</TableCell>
                        </TableRow>
                      </TableHead>

                      <TableBody>
                        {tripItems.map((row, idx) => (
                          <TableRow key={`${row.rowType}-${row.tripId}-${idx}`}>
                            <TableCell>{row.rowTypeLabel}</TableCell>
                            <TableCell>{row.tripId}</TableCell>
                            <TableCell>
                              {row.eventAt
                                ? new Date(row.eventAt).toLocaleString("vi-VN")
                                : ""}
                            </TableCell>
                            <TableCell>{row.driverName}</TableCell>
                            <TableCell>{row.driverPhone}</TableCell>
                            <TableCell>{row.carTypeLabel}</TableCell>
                            <TableCell>{row.directionLabel}</TableCell>
                            <TableCell align="right">
                              {row.totalPrice != null
                                ? formatNumber(row.totalPrice)
                                : ""}
                            </TableCell>
                            <TableCell align="right">
                              {row.commissionAmount != null
                                ? formatNumber(row.commissionAmount)
                                : ""}
                            </TableCell>
                            <TableCell align="right">
                              {row.driverVatAmount != null
                                ? formatNumber(row.driverVatAmount)
                                : ""}
                            </TableCell>
                            <TableCell align="right">
                              {row.driverPitAmount != null
                                ? formatNumber(row.driverPitAmount)
                                : ""}
                            </TableCell>
                            <TableCell align="right">
                              {row.totalDeduction != null
                                ? formatNumber(row.totalDeduction)
                                : ""}
                            </TableCell>
                            <TableCell align="right">
                              {row.driverReceive != null
                                ? formatNumber(row.driverReceive)
                                : ""}
                            </TableCell>
                            <TableCell align="right">
                              {row.penaltyAmount != null
                                ? formatNumber(row.penaltyAmount)
                                : ""}
                            </TableCell>
                            <TableCell>{row.note}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Stack>
              </Paper>
            ) : tab === 6 ? (
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Stack spacing={2}>
                  <Typography variant="h5" fontWeight={700}>
                    Tài Xế Rút Ví
                  </Typography>

                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField
                      select
                      label="Quý"
                      value={withdrawFilters.quarter}
                      onChange={(e) =>
                        setWithdrawFilters((prev) => ({
                          ...prev,
                          quarter: Number(e.target.value),
                        }))
                      }
                      sx={{ minWidth: 140 }}
                    >
                      {[1, 2, 3, 4].map((q) => (
                        <MenuItem key={q} value={q}>
                          Q{q}
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      label="Năm"
                      type="number"
                      value={withdrawFilters.year}
                      onChange={(e) =>
                        setWithdrawFilters((prev) => ({
                          ...prev,
                          year: Number(e.target.value || currentYear),
                        }))
                      }
                      sx={{ minWidth: 160 }}
                    />

                    <Stack direction="row" spacing={1}>
                      <Button variant="contained" onClick={loadWithdrawData}>
                        LỌC
                      </Button>

                      <Button
                        variant="outlined"
                        onClick={handleExportWithdrawCsv}
                      >
                        EXPORT CSV
                      </Button>
                    </Stack>
                  </Stack>

                  {withdrawLoading ? (
                    <Stack alignItems="center" sx={{ py: 4 }}>
                      <CircularProgress />
                    </Stack>
                  ) : (
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Mã yêu cầu</TableCell>
                          <TableCell>Ngày tạo</TableCell>
                          <TableCell>Tài xế</TableCell>
                          <TableCell>SĐT</TableCell>
                          <TableCell>Ngân hàng</TableCell>
                          <TableCell>Số tài khoản</TableCell>
                          <TableCell>Chủ tài khoản</TableCell>
                          <TableCell align="right">Số tiền</TableCell>
                          <TableCell>Trạng thái</TableCell>
                          <TableCell>Ngày duyệt</TableCell>
                          <TableCell>Ngày chuyển</TableCell>
                          <TableCell>Lý do từ chối</TableCell>
                        </TableRow>
                      </TableHead>

                      <TableBody>
                        {withdrawItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={12} align="center">
                              Chưa có dữ liệu rút tiền trong kỳ này.
                            </TableCell>
                          </TableRow>
                        ) : (
                          withdrawItems.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell>{row.id}</TableCell>
                              <TableCell>
                                {row.createdAt
                                  ? new Date(row.createdAt).toLocaleString(
                                      "vi-VN",
                                    )
                                  : ""}
                              </TableCell>
                              <TableCell>
                                {row.driverProfile?.fullName ||
                                  row.driverProfile?.user?.displayName ||
                                  row.driverProfile?.user?.phones?.[0]?.e164 ||
                                  "-"}
                              </TableCell>
                              <TableCell>
                                {row.driverProfile?.user?.phones?.[0]?.e164 ||
                                  "-"}
                              </TableCell>
                              <TableCell>
                                {row.bankAccount?.bankName || "-"}
                              </TableCell>
                              <TableCell>
                                {row.bankAccount?.accountNumber || "-"}
                              </TableCell>
                              <TableCell>
                                {row.bankAccount?.accountHolderName || "-"}
                              </TableCell>
                              <TableCell align="right">
                                {formatNumber(row.amount)}
                              </TableCell>
                              <TableCell>{row.status || "-"}</TableCell>
                              <TableCell>
                                {row.approvedAt
                                  ? new Date(row.approvedAt).toLocaleString(
                                      "vi-VN",
                                    )
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                {row.paidAt
                                  ? new Date(row.paidAt).toLocaleString("vi-VN")
                                  : "-"}
                              </TableCell>
                              <TableCell>{row.rejectReason || "-"}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}
                </Stack>
              </Paper>
            ) : tab === 11 ? (
              <Paper sx={{ p: 2.5, borderRadius: 3 }}>
                <Stack spacing={2.5}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      Export
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5 }}
                    >
                      Chọn quý và năm để xem trước toàn bộ dữ liệu kế toán sẽ
                      được gom vào file ZIP gửi kế toán.
                    </Typography>
                  </Box>

                  <Card>
                    <CardContent>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={2}
                        alignItems={{ xs: "stretch", md: "center" }}
                        flexWrap="wrap"
                      >
                        <TextField
                          select
                          label="Quý"
                          value={exportQuarter}
                          onChange={(e) =>
                            setExportQuarter(Number(e.target.value))
                          }
                          sx={{ minWidth: 140 }}
                        >
                          {QUARTER_OPTIONS.map((o) => (
                            <MenuItem key={o.value} value={o.value}>
                              {o.label}
                            </MenuItem>
                          ))}
                        </TextField>

                        <TextField
                          label="Năm"
                          type="number"
                          value={exportYear}
                          onChange={(e) =>
                            setExportYear(Number(e.target.value || currentYear))
                          }
                          sx={{ minWidth: 140 }}
                        />

                        <Button
                          variant="contained"
                          onClick={handlePreviewAccountingExport}
                          disabled={exportPreviewLoading}
                        >
                          {exportPreviewLoading
                            ? "Đang xem trước..."
                            : "Xem trước"}
                        </Button>

                        <Button
                          variant="outlined"
                          onClick={handleExportAccountingZip}
                          disabled={exportZipLoading || !exportPreview}
                        >
                          {exportZipLoading
                            ? "Đang xuất ZIP..."
                            : "Xuất file ZIP"}
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>

                  {exportPreview ? (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                      Phạm vi export: từ{" "}
                      <strong>{exportPreview.fromDate}</strong> đến{" "}
                      <strong>{exportPreview.toDate}</strong>. Tổng cộng{" "}
                      <strong>
                        {formatNumber(exportPreview.totalItems || 0)}
                      </strong>{" "}
                      mục dữ liệu.
                    </Alert>
                  ) : null}

                  {exportPreviewError ? (
                    <Alert severity="error" sx={{ borderRadius: 2 }}>
                      {exportPreviewError}
                    </Alert>
                  ) : null}

                  <Grid container spacing={2}>
                    {(exportPreview?.groups || []).map((group) => (
                      <Grid item xs={12} md={6} lg={4} key={group.key}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 2,
                            borderRadius: 3,
                            height: "100%",
                          }}
                        >
                          <Stack spacing={1}>
                            <Typography variant="subtitle1" fontWeight={700}>
                              {group.label}
                            </Typography>

                            <Typography variant="h5" fontWeight={800}>
                              {formatNumber(group.count || 0)}
                            </Typography>

                            <Chip
                              label={
                                group.hasData
                                  ? `Có ${formatNumber(group.count || 0)} mục`
                                  : "Không có dữ liệu"
                              }
                              color={group.hasData ? "success" : "default"}
                              size="small"
                              sx={{ width: "fit-content" }}
                            />
                          </Stack>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>

                  <Alert severity="success" sx={{ borderRadius: 2 }}>
                    Bạn có thể xem trước dữ liệu theo quý, sau đó bấm{" "}
                    <strong>Xuất file ZIP</strong> để tải toàn bộ bộ chứng từ và
                    file CSV kế toán.
                  </Alert>
                </Stack>
              </Paper>
            ) : (
              <Box
                sx={{
                  p: 4,
                  borderRadius: 2,
                  bgcolor: "background.paper",
                  textAlign: "center",
                  color: "text.secondary",
                }}
              >
                🚧 Tab đang xây dựng...
              </Box>
            )}
          </Stack>
        </Paper>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={closeSnackbar}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            severity={snackbar.severity}
            onClose={closeSnackbar}
            sx={{ width: "100%", borderRadius: 2 }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Stack>
    </Box>
  );
}
