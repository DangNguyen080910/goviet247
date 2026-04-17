// Path: goviet247/apps/web/src/pages/admin/AdminDriverWallets.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Alert,
  Grid,
  TextField,
  MenuItem,
  Button,
  InputAdornment,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  CircularProgress,
  Tabs,
  Tab,
  Badge,
  FormControl,
  InputLabel,
  Select,
  TablePagination,
} from "@mui/material";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import SearchIcon from "@mui/icons-material/Search";
import AddCardIcon from "@mui/icons-material/AddCard";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import RefreshIcon from "@mui/icons-material/Refresh";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import HistoryIcon from "@mui/icons-material/History";
import PaidIcon from "@mui/icons-material/Paid";

import { getAdminUser } from "../../utils/adminAuth";
import {
  fetchDrivers,
  fetchDriverWalletTransactions,
  topupDriverWallet,
  adjustAddDriverWallet,
  subtractDriverWallet,
} from "../../api/adminDrivers";
import {
  fetchLedgerTransactions,
  fetchWithdrawRequests,
  approveWithdrawRequest,
  rejectWithdrawRequest,
  markWithdrawRequestPaid,
  fetchDriverTripPenalties,
  approveDriverTripPenalty,
} from "../../api/adminLedger";
import { emitAdminDashboardChanged } from "../../utils/adminEventBus";
import { initializeAdminSocketBridge } from "../../services/adminSocket";

function formatMoney(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("vi-VN").format(num);
}

function formatVndInput(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("vi-VN");
}

function parseVndInput(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatDateTimeVN(input) {
  if (!input) return "N/A";

  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "N/A";

  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function getDriverPhone(item) {
  return item?.user?.phones?.[0]?.e164 || "N/A";
}

function getDriverName(item) {
  return (
    item?.fullName ||
    item?.driverProfile?.fullName ||
    item?.user?.displayName ||
    item?.driverProfile?.user?.displayName ||
    item?.user?.phones?.[0]?.e164 ||
    item?.driverProfile?.user?.phones?.[0]?.e164 ||
    "Chưa có tên"
  );
}

function getKycColor(status) {
  const s = String(status || "").toUpperCase();

  if (s === "VERIFIED") return "success";
  if (s === "PENDING") return "warning";
  if (s === "REJECTED") return "error";
  if (s === "SUSPENDED") return "default";
  return "default";
}

function getTxnTypeLabel(type) {
  const key = String(type || "").toUpperCase();

  if (key === "TOPUP") return "Nạp tiền";
  if (key === "ADJUST_ADD") return "Điều chỉnh cộng";
  if (key === "ADJUST_SUBTRACT") return "Điều chỉnh trừ";
  if (key === "COMMISSION_HOLD") return "Giữ phí môi giới";
  if (key === "COMMISSION_REFUND") return "Hoàn phí môi giới";
  if (key === "TRIP_CANCEL_PENALTY") return "Phạt huỷ chuyến";
  if (key === "WITHDRAW_REQUEST") return "Yêu cầu rút";
  if (key === "WITHDRAW_REJECT_REFUND") return "Hoàn do từ chối rút";
  if (key === "WITHDRAW_PAID") return "Đã trả rút tiền";

  return key || "N/A";
}

function getTxnChipColor(type) {
  const key = String(type || "").toUpperCase();

  if (key === "TOPUP") return "success";
  if (key === "ADJUST_ADD") return "success";
  if (key === "COMMISSION_REFUND") return "success";
  if (key === "WITHDRAW_REJECT_REFUND") return "success";

  if (key === "COMMISSION_HOLD") return "warning";
  if (key === "TRIP_CANCEL_PENALTY") return "error";
  if (key === "ADJUST_SUBTRACT") return "error";

  return "default";
}

function WalletActionDialog({
  open,
  mode,
  driver,
  loading,
  form,
  onClose,
  onChange,
  onSubmit,
}) {
  const isTopup = mode === "TOPUP";
  const isAdjustAdd = mode === "ADJUST_ADD";
  const isSubtract = mode === "SUBTRACT";

  const title = isTopup
    ? "Nạp tiền ví tài xế"
    : isAdjustAdd
      ? "Điều chỉnh cộng ví tài xế"
      : "Điều chỉnh trừ ví tài xế";

  const alertSeverity = isSubtract ? "warning" : "success";

  const alertText = isTopup
    ? "Admin sẽ cộng tiền vào ví tài xế sau khi xác nhận đã nhận tiền thật từ ngân hàng."
    : isAdjustAdd
      ? "Admin sẽ cộng bù hoặc điều chỉnh cộng tiền nội bộ vào ví tài xế."
      : "Admin sẽ trừ tiền trực tiếp khỏi ví tài xế. Hệ thống không cho số dư âm.";

  const buttonColor = isSubtract ? "warning" : "success";

  const buttonText = loading
    ? "Đang xử lý..."
    : isTopup
      ? "Xác nhận nạp tiền"
      : isAdjustAdd
        ? "Xác nhận điều chỉnh cộng"
        : "Xác nhận trừ tiền";

  const placeholder = isTopup
    ? "Ví dụ: Đã nhận 500.000đ từ ngân hàng BIDV, admin cộng ví."
    : isAdjustAdd
      ? "Ví dụ: Cộng bù do sai lệch đối soát hoặc hỗ trợ nội bộ."
      : "Ví dụ: Điều chỉnh trừ do sai lệch đối soát.";

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity={alertSeverity} sx={{ borderRadius: 2 }}>
            {alertText}
          </Alert>

          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "grey.50",
            }}
          >
            <Stack spacing={0.75}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {getDriverName(driver)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                SĐT: {getDriverPhone(driver)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Số dư hiện tại: {formatMoney(driver?.balance)} đ
              </Typography>
            </Stack>
          </Paper>

          <TextField
            label="Số tiền"
            type="text"
            value={formatVndInput(form.amount)}
            onChange={(e) => {
              const rawValue = parseVndInput(e.target.value);

              onChange("amount")({
                target: {
                  value: rawValue,
                },
              });
            }}
            fullWidth
            placeholder="Ví dụ: 1.000.000"
            inputProps={{
              inputMode: "numeric",
            }}
          />

          <TextField
            label="Ghi chú"
            value={form.note}
            onChange={onChange("note")}
            fullWidth
            multiline
            minRows={3}
            placeholder={placeholder}
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Đóng
        </Button>
        <Button
          variant="contained"
          color={buttonColor}
          onClick={onSubmit}
          disabled={loading}
          startIcon={
            loading ? <CircularProgress size={16} color="inherit" /> : null
          }
        >
          {buttonText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function WalletHistoryDialog({ open, driver, loading, items, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ fontWeight: 700 }}>Lịch sử ví tài xế</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "grey.50",
            }}
          >
            <Stack spacing={0.75}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {getDriverName(driver)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                SĐT: {getDriverPhone(driver)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Số dư hiện tại: {formatMoney(driver?.balance)} đ
              </Typography>
            </Stack>
          </Paper>

          {loading ? (
            <Stack
              spacing={1.5}
              alignItems="center"
              justifyContent="center"
              sx={{ py: 4 }}
            >
              <CircularProgress />
              <Typography color="text.secondary">
                Đang tải lịch sử ví...
              </Typography>
            </Stack>
          ) : items.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Tài xế này chưa có giao dịch ví nào.
            </Alert>
          ) : (
            <TableContainer
              component={Paper}
              elevation={0}
              sx={{
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Thời gian</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Loại</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      Số tiền
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      Trước
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      Sau
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Ghi chú</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{formatDateTimeVN(row.createdAt)}</TableCell>
                      <TableCell>{getTxnTypeLabel(row.type)}</TableCell>
                      <TableCell align="right">
                        {formatMoney(row.amount)} đ
                      </TableCell>
                      <TableCell align="right">
                        {formatMoney(row.balanceBefore)} đ
                      </TableCell>
                      <TableCell align="right">
                        {formatMoney(row.balanceAfter)} đ
                      </TableCell>
                      <TableCell>{row.note || "N/A"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function AdminDriverWallets() {
  const user = getAdminUser();
  const role = String(user?.role || "").toUpperCase();
  const isSuperAdmin = role === "ADMIN";

  const [tab, setTab] = React.useState(0);
  const [withdrawTab, setWithdrawTab] = React.useState(0);
  const [penaltyTab, setPenaltyTab] = React.useState(0);

  const [filters, setFilters] = React.useState({
    q: "",
    status: "ALL",
  });

  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [items, setItems] = React.useState([]);

  const [actionState, setActionState] = React.useState({
    open: false,
    mode: "TOPUP",
    driver: null,
  });

  const [historyState, setHistoryState] = React.useState({
    open: false,
    driver: null,
    loading: false,
    items: [],
  });

  const [form, setForm] = React.useState({
    amount: "",
    note: "",
  });

  const [ledgerFilters, setLedgerFilters] = React.useState({
    q: "",
    type: "ALL",
  });

  const [ledgerLoading, setLedgerLoading] = React.useState(false);
  const [ledgerItems, setLedgerItems] = React.useState([]);
  const [ledgerMeta, setLedgerMeta] = React.useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });

  const [penaltyItems, setPenaltyItems] = React.useState([]);
  const [penaltyCounts, setPenaltyCounts] = React.useState({
    pending: 0,
    approved: 0,
  });
  const [penaltyLoading, setPenaltyLoading] = React.useState(false);
  const [penaltySubmittingId, setPenaltySubmittingId] = React.useState("");
  const [penaltyQuery, setPenaltyQuery] = React.useState("");

  const [pendingWithdraws, setPendingWithdraws] = React.useState([]);
  const [pendingWithdrawsLoading, setPendingWithdrawsLoading] =
    React.useState(false);
  const [pendingWithdrawsError, setPendingWithdrawsError] = React.useState("");
  const [pendingWithdrawSearch, setPendingWithdrawSearch] = React.useState("");

  const [approvedWithdraws, setApprovedWithdraws] = React.useState([]);
  const [approvedWithdrawsLoading, setApprovedWithdrawsLoading] =
    React.useState(false);
  const [approvedWithdrawsError, setApprovedWithdrawsError] =
    React.useState("");
  const [approvedWithdrawSearch, setApprovedWithdrawSearch] =
    React.useState("");

  const [paidWithdraws, setPaidWithdraws] = React.useState([]);
  const [paidWithdrawsLoading, setPaidWithdrawsLoading] = React.useState(false);
  const [paidWithdrawsError, setPaidWithdrawsError] = React.useState("");
  const [paidWithdrawSearch, setPaidWithdrawSearch] = React.useState("");

  const [approvingWithdrawId, setApprovingWithdrawId] = React.useState("");
  const [rejectingWithdrawId, setRejectingWithdrawId] = React.useState("");
  const [payingWithdrawId, setPayingWithdrawId] = React.useState("");

  const [snackbar, setSnackbar] = React.useState({
    open: false,
    severity: "success",
    message: "",
  });

  const showSnackbar = React.useCallback((severity, message) => {
    setSnackbar({
      open: true,
      severity,
      message,
    });
  }, []);

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const loadDrivers = React.useCallback(async () => {
    try {
      setLoading(true);

      const data = await fetchDrivers({
        q: filters.q,
        status: filters.status,
        page: 1,
        pageSize: 100,
        sort: "createdAt_desc",
      });

      setItems(data.items || []);
    } catch (err) {
      showSnackbar("error", err.message || "Không tải được danh sách tài xế.");
    } finally {
      setLoading(false);
    }
  }, [filters.q, filters.status, showSnackbar]);

  const loadLedgerTransactions = React.useCallback(async () => {
    try {
      setLedgerLoading(true);

      const data = await fetchLedgerTransactions({
        q: ledgerFilters.q,
        type: ledgerFilters.type,
        page: ledgerMeta.page,
        pageSize: ledgerMeta.pageSize,
      });

      setLedgerItems(data.items || []);
      setLedgerMeta((prev) => ({
        ...prev,
        ...(data.meta || {}),
      }));
    } catch (err) {
      showSnackbar("error", err.message || "Không tải được lịch sử ví tài xế.");
      setLedgerItems([]);
    } finally {
      setLedgerLoading(false);
    }
  }, [
    ledgerFilters.q,
    ledgerFilters.type,
    ledgerMeta.page,
    ledgerMeta.pageSize,
    showSnackbar,
  ]);

  const loadPendingWithdraws = React.useCallback(async () => {
    try {
      setPendingWithdrawsLoading(true);
      setPendingWithdrawsError("");

      const res = await fetchWithdrawRequests({
        status: "PENDING",
        q: pendingWithdrawSearch,
        page: 1,
        pageSize: 50,
      });

      setPendingWithdraws(res.items || []);
    } catch (error) {
      console.error("fetchWithdrawRequests(PENDING) error:", error);
      setPendingWithdrawsError(
        error.message || "Không thể tải danh sách chờ duyệt rút tiền.",
      );
      setPendingWithdraws([]);
    } finally {
      setPendingWithdrawsLoading(false);
    }
  }, [pendingWithdrawSearch]);

  const loadPenaltyItems = React.useCallback(async () => {
    try {
      setPenaltyLoading(true);

      const status = penaltyTab === 0 ? "PENDING" : "APPROVED";

      const res = await fetchDriverTripPenalties({
        q: penaltyQuery,
        status,
        page: 1,
        pageSize: 50,
      });

      setPenaltyItems(Array.isArray(res?.items) ? res.items : []);
    } catch (err) {
      showSnackbar(
        "error",
        err.message || "Không tải được danh sách phạt huỷ chuyến.",
      );
      setPenaltyItems([]);
    } finally {
      setPenaltyLoading(false);
    }
  }, [penaltyQuery, penaltyTab, showSnackbar]);

  const loadPenaltyCounts = React.useCallback(async () => {
    try {
      const [pendingRes, approvedRes] = await Promise.all([
        fetchDriverTripPenalties({
          q: "",
          status: "PENDING",
          page: 1,
          pageSize: 1,
        }),
        fetchDriverTripPenalties({
          q: "",
          status: "APPROVED",
          page: 1,
          pageSize: 1,
        }),
      ]);

      setPenaltyCounts({
        pending: Number(pendingRes?.meta?.total || 0),
        approved: Number(approvedRes?.meta?.total || 0),
      });
    } catch (err) {
      console.log(err);
      setPenaltyCounts({
        pending: 0,
        approved: 0,
      });
    }
  }, []);

  const loadApprovedWithdraws = React.useCallback(async () => {
    try {
      setApprovedWithdrawsLoading(true);
      setApprovedWithdrawsError("");

      const res = await fetchWithdrawRequests({
        status: "APPROVED",
        q: approvedWithdrawSearch,
        page: 1,
        pageSize: 50,
      });

      setApprovedWithdraws(res.items || []);
    } catch (error) {
      console.error("fetchWithdrawRequests(APPROVED) error:", error);
      setApprovedWithdrawsError(
        error.message || "Không thể tải danh sách chờ chuyển khoản cho tài xế.",
      );
      setApprovedWithdraws([]);
    } finally {
      setApprovedWithdrawsLoading(false);
    }
  }, [approvedWithdrawSearch]);

  const loadPaidWithdraws = React.useCallback(async () => {
    try {
      setPaidWithdrawsLoading(true);
      setPaidWithdrawsError("");

      const res = await fetchWithdrawRequests({
        status: "PAID",
        q: paidWithdrawSearch,
        page: 1,
        pageSize: 50,
      });

      setPaidWithdraws(res.items || []);
    } catch (error) {
      console.error("fetchWithdrawRequests(PAID) error:", error);
      setPaidWithdrawsError(
        error.message || "Không thể tải lịch sử đã chuyển khoản cho tài xế.",
      );
      setPaidWithdraws([]);
    } finally {
      setPaidWithdrawsLoading(false);
    }
  }, [paidWithdrawSearch]);

  React.useEffect(() => {
    if (!isSuperAdmin) return;
    loadDrivers();
  }, [isSuperAdmin, loadDrivers]);

  React.useEffect(() => {
    if (!isSuperAdmin) return;
    if (tab !== 3) return;
    loadLedgerTransactions();
  }, [isSuperAdmin, tab, loadLedgerTransactions]);

  React.useEffect(() => {
    if (!isSuperAdmin) return;
    if (tab !== 2) return;
    loadPenaltyItems();
  }, [isSuperAdmin, tab, loadPenaltyItems]);

  React.useEffect(() => {
    if (!isSuperAdmin) return;
    loadPenaltyCounts();
  }, [isSuperAdmin, loadPenaltyCounts]);

  React.useEffect(() => {
    if (!isSuperAdmin) return;
    loadPendingWithdraws();
    loadApprovedWithdraws();
  }, [isSuperAdmin, loadPendingWithdraws, loadApprovedWithdraws]);

  React.useEffect(() => {
    if (!isSuperAdmin) return;
    if (tab !== 1) return;
    if (withdrawTab !== 2) return;
    loadPaidWithdraws();
  }, [isSuperAdmin, tab, withdrawTab, loadPaidWithdraws]);

  React.useEffect(() => {
    initializeAdminSocketBridge();

    let timeoutId = null;

    const handleRealtimeWalletChanged = (event) => {
      const detail = event?.detail || {};
      const source = String(detail?.source || "")
        .trim()
        .toLowerCase();

      const walletSources = new Set([
        "driver_withdraw_request_created",
        "withdraw_request_created",
        "approve_withdraw_request",
        "reject_withdraw_request",
        "mark_withdraw_paid",
        "withdraw_request_approved",
        "withdraw_request_rejected",
        "withdraw_request_paid",
        "driver_wallet_topup",
        "driver_wallet_adjust_add",
        "driver_wallet_adjust_subtract",
        "driver_cancel_trip",
        "driver_trip_penalty_approved",
      ]);

      const shouldReload =
        !source ||
        walletSources.has(source) ||
        source.includes("withdraw") ||
        source.includes("wallet");

      if (!shouldReload) {
        return;
      }

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        loadDrivers();
        loadPendingWithdraws();
        loadApprovedWithdraws();

        if (tab === 1 && withdrawTab === 2) {
          loadPaidWithdraws();
        }

        if (tab === 2) {
          loadPenaltyItems();
          loadPenaltyCounts();
        }

        if (tab === 3) {
          loadLedgerTransactions();
        }
      }, 150);
    };

    window.addEventListener(
      "admin:dashboard_changed",
      handleRealtimeWalletChanged,
    );

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      window.removeEventListener(
        "admin:dashboard_changed",
        handleRealtimeWalletChanged,
      );
    };
  }, [
    loadDrivers,
    loadPendingWithdraws,
    loadApprovedWithdraws,
    loadPaidWithdraws,
    loadPenaltyItems,
    loadPenaltyCounts,
    loadLedgerTransactions,
    tab,
    withdrawTab,
  ]);

  if (!isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const totalBalance = items.reduce(
    (sum, item) => sum + Number(item.balance || 0),
    0,
  );

  const walletWithdrawBadgeCount =
    pendingWithdraws.length + approvedWithdraws.length;

  const handleFilterChange = (key) => (e) => {
    setFilters((prev) => ({
      ...prev,
      [key]: e.target.value,
    }));
  };

  const handleLedgerFilterChange = (key) => (e) => {
    const value = e.target.value;

    setLedgerFilters((prev) => ({
      ...prev,
      [key]: value,
    }));

    setLedgerMeta((prev) => ({
      ...prev,
      page: 1,
    }));
  };

  const openTopupDialog = (driver) => {
    setForm({ amount: "", note: "" });
    setActionState({
      open: true,
      mode: "TOPUP",
      driver,
    });
  };

  const openAdjustAddDialog = (driver) => {
    setForm({ amount: "", note: "" });
    setActionState({
      open: true,
      mode: "ADJUST_ADD",
      driver,
    });
  };

  const openSubtractDialog = (driver) => {
    setForm({ amount: "", note: "" });
    setActionState({
      open: true,
      mode: "SUBTRACT",
      driver,
    });
  };

  const closeActionDialog = () => {
    if (submitting) return;
    setActionState({
      open: false,
      mode: "TOPUP",
      driver: null,
    });
  };

  const handleFormChange = (key) => (e) => {
    setForm((prev) => ({
      ...prev,
      [key]: e.target.value,
    }));
  };

  const handleSubmitAction = async () => {
    const driver = actionState.driver;
    const amount = Number(form.amount);
    const note = String(form.note || "").trim();

    if (!driver?.id) {
      showSnackbar("error", "Không tìm thấy tài xế để thao tác.");
      return;
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      showSnackbar("error", "Số tiền phải là số nguyên lớn hơn 0.");
      return;
    }

    if (!note) {
      showSnackbar("error", "Vui lòng nhập ghi chú.");
      return;
    }

    try {
      setSubmitting(true);

      if (actionState.mode === "TOPUP") {
        await topupDriverWallet(driver.id, { amount, note });
        showSnackbar("success", "Đã nạp tiền vào ví tài xế.");
      } else if (actionState.mode === "ADJUST_ADD") {
        await adjustAddDriverWallet(driver.id, { amount, note });
        showSnackbar("success", "Đã điều chỉnh cộng ví tài xế.");
      } else {
        await subtractDriverWallet(driver.id, { amount, note });
        showSnackbar("success", "Đã điều chỉnh trừ ví tài xế.");
      }

      closeActionDialog();
      emitAdminDashboardChanged();

      await Promise.all([
        loadDrivers(),
        tab === 2 ? loadLedgerTransactions() : Promise.resolve(),
      ]);
    } catch (err) {
      showSnackbar(
        "error",
        err.message || "Thao tác ví tài xế không thành công.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  async function handleApproveWithdraw(item) {
    const ok = window.confirm(
      `Xác nhận duyệt yêu cầu rút tiền của tài xế ${getDriverName(
        item.driverProfile || item,
      )} số tiền ${formatMoney(item.amount)} đ?`,
    );

    if (!ok) return;

    try {
      setApprovingWithdrawId(item.id);
      await approveWithdrawRequest(item.id);

      emitAdminDashboardChanged();

      await Promise.all([
        loadDrivers(),
        loadPendingWithdraws(),
        loadApprovedWithdraws(),
      ]);

      showSnackbar("success", "Đã duyệt yêu cầu rút tiền.");
    } catch (error) {
      console.error("approveWithdrawRequest error:", error);
      showSnackbar(
        "error",
        error.message || "Không thể duyệt yêu cầu rút tiền.",
      );
    } finally {
      setApprovingWithdrawId("");
    }
  }

  async function handleApprovePenalty(id) {
    try {
      setPenaltySubmittingId(id);

      await approveDriverTripPenalty(id);

      showSnackbar("success", "Đã duyệt phạt huỷ chuyến thành công.");

      await Promise.all([loadPenaltyItems(), loadPenaltyCounts()]);
    } catch (err) {
      showSnackbar("error", err.message || "Không duyệt được phạt huỷ chuyến.");
    } finally {
      setPenaltySubmittingId("");
    }
  }

  async function handleRejectWithdraw(item) {
    const reason = window.prompt(
      `Nhập lý do từ chối yêu cầu rút tiền của tài xế ${getDriverName(
        item.driverProfile || item,
      )}:`,
    );

    if (reason === null) return;

    const trimmedReason = String(reason || "").trim();
    if (!trimmedReason) {
      showSnackbar("error", "Vui lòng nhập lý do từ chối.");
      return;
    }

    try {
      setRejectingWithdrawId(item.id);
      await rejectWithdrawRequest(item.id, { reason: trimmedReason });

      emitAdminDashboardChanged();

      await Promise.all([
        loadDrivers(),
        loadPendingWithdraws(),
        loadApprovedWithdraws(),
      ]);

      showSnackbar("success", "Đã từ chối yêu cầu rút tiền và hoàn lại ví.");
    } catch (error) {
      console.error("rejectWithdrawRequest error:", error);
      showSnackbar(
        "error",
        error.message || "Không thể từ chối yêu cầu rút tiền.",
      );
    } finally {
      setRejectingWithdrawId("");
    }
  }

  async function handleMarkWithdrawPaid(item) {
    const ok = window.confirm(
      `Xác nhận đã chuyển khoản cho tài xế ${getDriverName(
        item.driverProfile || item,
      )} số tiền ${formatMoney(item.amount)} đ?`,
    );

    if (!ok) return;

    try {
      setPayingWithdrawId(item.id);
      await markWithdrawRequestPaid(item.id);

      emitAdminDashboardChanged();

      await Promise.all([
        loadDrivers(),
        loadApprovedWithdraws(),
        loadPaidWithdraws(),
      ]);

      showSnackbar("success", "Đã ghi nhận chuyển khoản cho tài xế.");
    } catch (error) {
      console.error("markWithdrawRequestPaid error:", error);
      showSnackbar(
        "error",
        error.message || "Không thể đánh dấu đã chuyển khoản.",
      );
    } finally {
      setPayingWithdrawId("");
    }
  }

  const openHistoryDialog = async (driver) => {
    setHistoryState({
      open: true,
      driver,
      loading: true,
      items: [],
    });

    try {
      const data = await fetchDriverWalletTransactions(driver.id, {
        limit: 100,
      });

      setHistoryState({
        open: true,
        driver,
        loading: false,
        items: data.items || [],
      });
    } catch (err) {
      setHistoryState({
        open: true,
        driver,
        loading: false,
        items: [],
      });

      showSnackbar("error", err.message || "Không tải được lịch sử ví tài xế.");
    }
  };

  const closeHistoryDialog = () => {
    setHistoryState({
      open: false,
      driver: null,
      loading: false,
      items: [],
    });
  };

  const renderWithdrawTab = () => {
    return (
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          overflow: "hidden",
        }}
      >
        <Tabs
          value={withdrawTab}
          onChange={(_, value) => setWithdrawTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 2,
            pt: 1,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Tab label={`Chờ duyệt (${pendingWithdraws.length})`} />
          <Tab label={`Chờ chuyển (${approvedWithdraws.length})`} />
          <Tab label={`Đã chuyển (${paidWithdraws.length})`} />
        </Tabs>

        <Box sx={{ p: 2.5 }}>
          {withdrawTab === 0 ? (
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                alignItems={{ xs: "flex-start", md: "center" }}
                justifyContent="space-between"
              >
                <Box>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ mb: 0.5 }}
                  >
                    <PaidIcon color="warning" />
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      Chờ duyệt yêu cầu rút tiền
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Đây là các yêu cầu tài xế mới gửi, admin cần duyệt hoặc từ
                    chối.
                  </Typography>
                </Box>

                <Chip
                  label={`${pendingWithdraws.length} yêu cầu chờ duyệt`}
                  color="warning"
                  variant="outlined"
                />
              </Stack>

              <TextField
                label="Tìm theo tài xế / số điện thoại / ngân hàng / số tài khoản / chủ tài khoản / mã yêu cầu"
                value={pendingWithdrawSearch}
                onChange={(e) => setPendingWithdrawSearch(e.target.value)}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />

              {pendingWithdrawsError ? (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                  {pendingWithdrawsError}
                </Alert>
              ) : null}

              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Mã yêu cầu</TableCell>
                      <TableCell>Tài xế</TableCell>
                      <TableCell>SĐT</TableCell>
                      <TableCell>Ngân hàng</TableCell>
                      <TableCell>Số tài khoản</TableCell>
                      <TableCell>Chủ tài khoản</TableCell>
                      <TableCell>Số tiền</TableCell>
                      <TableCell>Ngày tạo</TableCell>
                      <TableCell>Thao tác</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {pendingWithdrawsLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center">
                          Đang tải dữ liệu...
                        </TableCell>
                      </TableRow>
                    ) : pendingWithdraws.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center">
                          Không tìm thấy yêu cầu rút tiền phù hợp.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingWithdraws.map((item) => (
                        <TableRow key={item.id} hover>
                          <TableCell>{item.id}</TableCell>
                          <TableCell>
                            {getDriverName(item.driverProfile || item)}
                          </TableCell>
                          <TableCell>
                            {item.driverProfile?.user?.phones?.[0]?.e164 || "-"}
                          </TableCell>
                          <TableCell>
                            {item.bankAccount?.bankName || "-"}
                          </TableCell>
                          <TableCell>
                            {item.bankAccount?.accountNumber || "-"}
                          </TableCell>
                          <TableCell>
                            {item.bankAccount?.accountHolderName || "-"}
                          </TableCell>
                          <TableCell>{formatMoney(item.amount)} đ</TableCell>
                          <TableCell>
                            {formatDateTimeVN(item.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1}>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => handleApproveWithdraw(item)}
                                disabled={approvingWithdrawId === item.id}
                              >
                                {approvingWithdrawId === item.id
                                  ? "Đang duyệt..."
                                  : "Duyệt"}
                              </Button>

                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                onClick={() => handleRejectWithdraw(item)}
                                disabled={rejectingWithdrawId === item.id}
                              >
                                {rejectingWithdrawId === item.id
                                  ? "Đang từ chối..."
                                  : "Từ chối"}
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Box>
            </Stack>
          ) : withdrawTab === 1 ? (
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                alignItems={{ xs: "flex-start", md: "center" }}
                justifyContent="space-between"
              >
                <Box>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ mb: 0.5 }}
                  >
                    <PaidIcon color="primary" />
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      Chờ chuyển khoản cho tài xế
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Đây là các yêu cầu đã duyệt, admin cần chuyển khoản ngoài
                    đời thật rồi bấm xác nhận.
                  </Typography>
                </Box>

                <Chip
                  label={`${approvedWithdraws.length} yêu cầu chờ chuyển`}
                  color="primary"
                  variant="outlined"
                />
              </Stack>

              <TextField
                label="Tìm theo tài xế / số điện thoại / ngân hàng / số tài khoản / chủ tài khoản / mã yêu cầu"
                value={approvedWithdrawSearch}
                onChange={(e) => setApprovedWithdrawSearch(e.target.value)}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />

              {approvedWithdrawsError ? (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                  {approvedWithdrawsError}
                </Alert>
              ) : null}

              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Mã yêu cầu</TableCell>
                      <TableCell>Tài xế</TableCell>
                      <TableCell>SĐT</TableCell>
                      <TableCell>Ngân hàng</TableCell>
                      <TableCell>Số tài khoản</TableCell>
                      <TableCell>Chủ tài khoản</TableCell>
                      <TableCell>Số tiền</TableCell>
                      <TableCell>Đã duyệt lúc</TableCell>
                      <TableCell>Thao tác</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {approvedWithdrawsLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center">
                          Đang tải dữ liệu...
                        </TableCell>
                      </TableRow>
                    ) : approvedWithdraws.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center">
                          Không tìm thấy yêu cầu chờ chuyển khoản phù hợp.
                        </TableCell>
                      </TableRow>
                    ) : (
                      approvedWithdraws.map((item) => (
                        <TableRow key={item.id} hover>
                          <TableCell>{item.id}</TableCell>
                          <TableCell>
                            {getDriverName(item.driverProfile || item)}
                          </TableCell>
                          <TableCell>
                            {item.driverProfile?.user?.phones?.[0]?.e164 || "-"}
                          </TableCell>
                          <TableCell>
                            {item.bankAccount?.bankName || "-"}
                          </TableCell>
                          <TableCell>
                            {item.bankAccount?.accountNumber || "-"}
                          </TableCell>
                          <TableCell>
                            {item.bankAccount?.accountHolderName || "-"}
                          </TableCell>
                          <TableCell>{formatMoney(item.amount)} đ</TableCell>
                          <TableCell>
                            {formatDateTimeVN(item.approvedAt)}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleMarkWithdrawPaid(item)}
                              disabled={payingWithdrawId === item.id}
                            >
                              {payingWithdrawId === item.id
                                ? "Đang xử lý..."
                                : "Đã chuyển"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Box>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                alignItems={{ xs: "flex-start", md: "center" }}
                justifyContent="space-between"
              >
                <Box>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ mb: 0.5 }}
                  >
                    <HistoryIcon color="success" />
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      Lịch sử đã chuyển khoản
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Đây là các yêu cầu đã được xác nhận chuyển khoản cho tài xế.
                  </Typography>
                </Box>

                <Chip
                  label={`${paidWithdraws.length} yêu cầu đã chuyển`}
                  color="success"
                  variant="outlined"
                />
              </Stack>

              <TextField
                label="Tìm theo tài xế / số điện thoại / ngân hàng / số tài khoản / chủ tài khoản / mã yêu cầu"
                value={paidWithdrawSearch}
                onChange={(e) => setPaidWithdrawSearch(e.target.value)}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />

              {paidWithdrawsError ? (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                  {paidWithdrawsError}
                </Alert>
              ) : null}

              <Box sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Mã yêu cầu</TableCell>
                      <TableCell>Tài xế</TableCell>
                      <TableCell>SĐT</TableCell>
                      <TableCell>Ngân hàng</TableCell>
                      <TableCell>Số tài khoản</TableCell>
                      <TableCell>Chủ tài khoản</TableCell>
                      <TableCell>Số tiền</TableCell>
                      <TableCell>Đã chuyển lúc</TableCell>
                      <TableCell>Admin xử lý</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {paidWithdrawsLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center">
                          Đang tải dữ liệu...
                        </TableCell>
                      </TableRow>
                    ) : paidWithdraws.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center">
                          Không tìm thấy lịch sử chuyển khoản phù hợp.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paidWithdraws.map((item) => (
                        <TableRow key={item.id} hover>
                          <TableCell>{item.id}</TableCell>
                          <TableCell>
                            {getDriverName(item.driverProfile || item)}
                          </TableCell>
                          <TableCell>
                            {item.driverProfile?.user?.phones?.[0]?.e164 || "-"}
                          </TableCell>
                          <TableCell>
                            {item.bankAccount?.bankName || "-"}
                          </TableCell>
                          <TableCell>
                            {item.bankAccount?.accountNumber || "-"}
                          </TableCell>
                          <TableCell>
                            {item.bankAccount?.accountHolderName || "-"}
                          </TableCell>
                          <TableCell>{formatMoney(item.amount)} đ</TableCell>
                          <TableCell>{formatDateTimeVN(item.paidAt)}</TableCell>
                          <TableCell>{item.paidByAdminId || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Box>
            </Stack>
          )}
        </Box>
      </Paper>
    );
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Box>
          <Stack
            direction="row"
            spacing={1.2}
            alignItems="center"
            sx={{ mb: 0.5 }}
          >
            <AccountBalanceWalletIcon color="primary" />
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Ví Tài Xế
            </Typography>
          </Stack>

          <Typography variant="body1" color="text.secondary">
            Admin nạp tiền, điều chỉnh cộng, điều chỉnh trừ, xử lý yêu cầu rút
            tiền và tra cứu lịch sử ví của tài xế.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={`Tổng số dư ví: ${formatMoney(totalBalance)} đ`}
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 700 }}
          />
          <Chip
            label="Quyền: ADMIN"
            color="success"
            variant="outlined"
            sx={{ fontWeight: 700 }}
          />
        </Stack>
      </Stack>

      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          mb: 3,
          overflow: "hidden",
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, nextValue) => setTab(nextValue)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            px: 2,
            pt: 1,
            borderBottom: "1px solid",
            borderColor: "divider",
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 700,
              minHeight: 48,
            },
            "& .MuiBadge-badge": {
              fontWeight: 700,
              minWidth: 20,
              height: 20,
            },
          }}
        >
          <Tab label="Danh sách ví" />

          <Tab
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <Box component="span">Yêu cầu rút tiền</Box>
                <Badge
                  badgeContent={walletWithdrawBadgeCount}
                  color="warning"
                  invisible={walletWithdrawBadgeCount <= 0}
                />
              </Stack>
            }
          />

          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <span>Phạt huỷ chuyến</span>
                {penaltyCounts.pending > 0 && (
                  <Chip
                    label={penaltyCounts.pending}
                    size="small"
                    color="warning"
                  />
                )}
              </Box>
            }
          />

          <Tab label="Lịch sử ví" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {tab === 0 ? (
            <Stack spacing={3}>
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      height: "100%",
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      Tổng tài xế
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                      {items.length}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      height: "100%",
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      Tài xế đã duyệt
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                      {
                        items.filter((item) => item.status === "VERIFIED")
                          .length
                      }
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      height: "100%",
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      Tổng số dư ví
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                      {formatMoney(totalBalance)} đ
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.5}
                  alignItems={{ xs: "stretch", md: "center" }}
                >
                  <TextField
                    label="Tìm theo tên / số điện thoại / biển số"
                    value={filters.q}
                    onChange={handleFilterChange("q")}
                    fullWidth
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <TextField
                    select
                    label="Trạng thái KYC"
                    value={filters.status}
                    onChange={handleFilterChange("status")}
                    sx={{ minWidth: { xs: "100%", md: 220 } }}
                  >
                    <MenuItem value="ALL">Tất cả</MenuItem>
                    <MenuItem value="PENDING">PENDING</MenuItem>
                    <MenuItem value="VERIFIED">VERIFIED</MenuItem>
                    <MenuItem value="REJECTED">REJECTED</MenuItem>
                    <MenuItem value="SUSPENDED">SUSPENDED</MenuItem>
                  </TextField>

                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={loadDrivers}
                    sx={{ minWidth: { xs: "100%", md: 140 } }}
                  >
                    Tải lại
                  </Button>
                </Stack>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                  overflow: "hidden",
                }}
              >
                {loading ? (
                  <Stack
                    spacing={1.5}
                    alignItems="center"
                    justifyContent="center"
                    sx={{ py: 8 }}
                  >
                    <CircularProgress />
                    <Typography color="text.secondary">
                      Đang tải danh sách ví tài xế...
                    </Typography>
                  </Stack>
                ) : items.length === 0 ? (
                  <Stack
                    spacing={1.5}
                    alignItems="center"
                    justifyContent="center"
                    sx={{ py: 8 }}
                  >
                    <LockOutlinedIcon color="disabled" />
                    <Typography color="text.secondary">
                      Không có tài xế nào phù hợp bộ lọc hiện tại.
                    </Typography>
                  </Stack>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Tài xế</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>
                            Số điện thoại
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>KYC</TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="right">
                            Số dư ví
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>
                            Biển số
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }} align="center">
                            Hành động
                          </TableCell>
                        </TableRow>
                      </TableHead>

                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.id} hover>
                            <TableCell>
                              <Stack spacing={0.35}>
                                <Typography sx={{ fontWeight: 700 }}>
                                  {getDriverName(item)}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Tạo lúc: {formatDateTimeVN(item.createdAt)}
                                </Typography>
                              </Stack>
                            </TableCell>

                            <TableCell>{getDriverPhone(item)}</TableCell>

                            <TableCell>
                              <Chip
                                size="small"
                                label={item.status || "N/A"}
                                color={getKycColor(item.status)}
                                variant="outlined"
                              />
                            </TableCell>

                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              {formatMoney(item.balance)} đ
                            </TableCell>

                            <TableCell>{item.plateNumber || "N/A"}</TableCell>

                            <TableCell align="center">
                              <Stack
                                direction={{ xs: "column", lg: "row" }}
                                spacing={1}
                                justifyContent="center"
                                alignItems="center"
                                sx={{ py: 0.5 }}
                              >
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  startIcon={<AddCardIcon />}
                                  onClick={() => openTopupDialog(item)}
                                >
                                  Nạp tiền
                                </Button>

                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  startIcon={<AddCircleOutlineIcon />}
                                  onClick={() => openAdjustAddDialog(item)}
                                >
                                  Điều chỉnh cộng
                                </Button>

                                <Button
                                  size="small"
                                  variant="contained"
                                  color="warning"
                                  startIcon={<RemoveCircleOutlineIcon />}
                                  onClick={() => openSubtractDialog(item)}
                                >
                                  Trừ tiền
                                </Button>

                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<ReceiptLongIcon />}
                                  onClick={() => openHistoryDialog(item)}
                                >
                                  Lịch sử ví
                                </Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
            </Stack>
          ) : tab === 1 ? (
            renderWithdrawTab()
          ) : tab === 2 ? (
            <Paper
              elevation={0}
              sx={{
                borderRadius: 3,
                border: "1px solid",
                borderColor: "divider",
                overflow: "hidden",
              }}
            >
              <Tabs
                value={penaltyTab}
                onChange={(_, value) => {
                  setPenaltyTab(value);
                }}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  px: 2,
                  pt: 1,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Tab label={`Chờ duyệt (${penaltyCounts.pending})`} />
                <Tab label={`Đã duyệt (${penaltyCounts.approved})`} />
              </Tabs>

              <Box sx={{ p: 2.5 }}>
                <Stack spacing={2}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={2}
                    alignItems={{ xs: "flex-start", md: "center" }}
                    justifyContent="space-between"
                  >
                    <Box>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{ mb: 0.5 }}
                      >
                        <PaidIcon
                          color={penaltyTab === 0 ? "warning" : "success"}
                        />
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                          {penaltyTab === 0
                            ? "Chờ duyệt phạt huỷ chuyến"
                            : "Lịch sử phạt huỷ chuyến đã duyệt"}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        {penaltyTab === 0
                          ? "Đây là các khoản phạt huỷ chuyến đang chờ admin duyệt."
                          : "Đây là các khoản phạt huỷ chuyến đã được admin duyệt."}
                      </Typography>
                    </Box>

                    <Chip
                      label={`${
                        penaltyTab === 0
                          ? penaltyCounts.pending
                          : penaltyCounts.approved
                      } ${penaltyTab === 0 ? "mục chờ duyệt" : "mục đã duyệt"}`}
                      color={penaltyTab === 0 ? "warning" : "success"}
                      variant="outlined"
                    />
                  </Stack>

                  <TextField
                    label="Tìm theo tài xế / số điện thoại / mã chuyến"
                    value={penaltyQuery}
                    onChange={(e) => {
                      setPenaltyQuery(e.target.value);
                    }}
                    fullWidth
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <Box sx={{ overflowX: "auto" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Thời gian</TableCell>
                          <TableCell>Tài xế</TableCell>
                          <TableCell>SĐT</TableCell>
                          <TableCell>Mã chuyến</TableCell>
                          <TableCell>Trạng thái lúc huỷ</TableCell>
                          <TableCell>Tiền phạt</TableCell>
                          <TableCell>Trạng thái</TableCell>
                          <TableCell>Hành động</TableCell>
                        </TableRow>
                      </TableHead>

                      <TableBody>
                        {penaltyLoading ? (
                          <TableRow>
                            <TableCell colSpan={8} align="center">
                              Đang tải dữ liệu...
                            </TableCell>
                          </TableRow>
                        ) : penaltyItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} align="center">
                              Không tìm thấy log phạt huỷ chuyến phù hợp.
                            </TableCell>
                          </TableRow>
                        ) : (
                          penaltyItems.map((item) => (
                            <TableRow key={item.id} hover>
                              <TableCell>
                                {formatDateTimeVN(item.createdAt)}
                              </TableCell>

                              <TableCell>
                                {item.driverNameSnapshot || "-"}
                              </TableCell>

                              <TableCell>
                                {item.driverPhoneSnapshot || "-"}
                              </TableCell>

                              <TableCell>{item.tripId || "-"}</TableCell>

                              <TableCell>
                                {item.tripStatusSnapshot || "-"}
                              </TableCell>

                              <TableCell>
                                {formatMoney(item.penaltyAmount)} đ
                              </TableCell>

                              <TableCell>
                                <Chip
                                  size="small"
                                  label={
                                    String(item.status || "").toUpperCase() ===
                                    "APPROVED"
                                      ? "Đã duyệt"
                                      : "Chờ duyệt"
                                  }
                                  color={
                                    String(item.status || "").toUpperCase() ===
                                    "APPROVED"
                                      ? "success"
                                      : "warning"
                                  }
                                />
                              </TableCell>

                              <TableCell>
                                {String(item.status || "").toUpperCase() ===
                                "PENDING" ? (
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="warning"
                                    onClick={() =>
                                      handleApprovePenalty(item.id)
                                    }
                                    disabled={penaltySubmittingId === item.id}
                                  >
                                    {penaltySubmittingId === item.id
                                      ? "Đang duyệt..."
                                      : "Duyệt"}
                                  </Button>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </Box>
                </Stack>
              </Box>
            </Paper>
          ) : (
            <Stack spacing={3}>
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      height: "100%",
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      Tổng giao dịch đang hiển thị
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                      {Number(ledgerMeta.total || 0).toLocaleString("vi-VN")}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      height: "100%",
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      Trang hiện tại
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                      {Number(ledgerMeta.page || 1)}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: "divider",
                      height: "100%",
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      Loại lọc hiện tại
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      {ledgerFilters.type === "ALL"
                        ? "Tất cả"
                        : getTxnTypeLabel(ledgerFilters.type)}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.5}
                  alignItems={{ xs: "stretch", md: "center" }}
                >
                  <TextField
                    label="Tìm theo tên / số điện thoại / ghi chú / mã chuyến / mã rút tiền"
                    value={ledgerFilters.q}
                    onChange={handleLedgerFilterChange("q")}
                    fullWidth
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <FormControl
                    sx={{ minWidth: { xs: "100%", md: 240 } }}
                    size="small"
                  >
                    <InputLabel id="wallet-history-type-label">
                      Loại giao dịch
                    </InputLabel>
                    <Select
                      labelId="wallet-history-type-label"
                      value={ledgerFilters.type}
                      label="Loại giao dịch"
                      onChange={handleLedgerFilterChange("type")}
                    >
                      <MenuItem value="ALL">Tất cả</MenuItem>
                      <MenuItem value="TOPUP">TOPUP</MenuItem>
                      <MenuItem value="ADJUST_ADD">ADJUST_ADD</MenuItem>
                      <MenuItem value="ADJUST_SUBTRACT">
                        ADJUST_SUBTRACT
                      </MenuItem>
                      <MenuItem value="COMMISSION_HOLD">
                        COMMISSION_HOLD
                      </MenuItem>
                      <MenuItem value="COMMISSION_REFUND">
                        COMMISSION_REFUND
                      </MenuItem>
                      <MenuItem value="TRIP_CANCEL_PENALTY">
                        TRIP_CANCEL_PENALTY
                      </MenuItem>
                      <MenuItem value="WITHDRAW_REQUEST">
                        WITHDRAW_REQUEST
                      </MenuItem>
                      <MenuItem value="WITHDRAW_REJECT_REFUND">
                        WITHDRAW_REJECT_REFUND
                      </MenuItem>
                      <MenuItem value="WITHDRAW_PAID">WITHDRAW_PAID</MenuItem>
                    </Select>
                  </FormControl>

                  <Button
                    variant="outlined"
                    startIcon={<HistoryIcon />}
                    onClick={loadLedgerTransactions}
                    sx={{ minWidth: { xs: "100%", md: 150 } }}
                  >
                    Tải lịch sử
                  </Button>
                </Stack>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                  overflow: "hidden",
                }}
              >
                {ledgerLoading ? (
                  <Stack
                    spacing={1.5}
                    alignItems="center"
                    justifyContent="center"
                    sx={{ py: 8 }}
                  >
                    <CircularProgress />
                    <Typography color="text.secondary">
                      Đang tải lịch sử ví toàn hệ thống...
                    </Typography>
                  </Stack>
                ) : ledgerItems.length === 0 ? (
                  <Stack
                    spacing={1.5}
                    alignItems="center"
                    justifyContent="center"
                    sx={{ py: 8 }}
                  >
                    <LockOutlinedIcon color="disabled" />
                    <Typography color="text.secondary">
                      Không có giao dịch ví nào phù hợp bộ lọc hiện tại.
                    </Typography>
                  </Stack>
                ) : (
                  <>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>
                              Thời gian
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>
                              Mã giao dịch
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>
                              Tài xế
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>SĐT</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Loại</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="right">
                              Số tiền
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="right">
                              Số dư trước
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="right">
                              Số dư sau
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>
                              Mã chuyến
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>
                              Yêu cầu rút
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>
                              Ghi chú
                            </TableCell>
                          </TableRow>
                        </TableHead>

                        <TableBody>
                          {ledgerItems.map((item) => (
                            <TableRow key={item.id} hover>
                              <TableCell>
                                {formatDateTimeVN(item.createdAt)}
                              </TableCell>

                              <TableCell>{item.id}</TableCell>

                              <TableCell>
                                {getDriverName(item.driverProfile || item)}
                              </TableCell>

                              <TableCell>
                                {item.driverProfile?.user?.phones?.[0]?.e164 ||
                                  "N/A"}
                              </TableCell>

                              <TableCell>
                                <Chip
                                  size="small"
                                  label={getTxnTypeLabel(item.type)}
                                  color={getTxnChipColor(item.type)}
                                  variant="outlined"
                                />
                              </TableCell>

                              <TableCell align="right">
                                {formatMoney(item.amount)} đ
                              </TableCell>

                              <TableCell align="right">
                                {formatMoney(item.balanceBefore)} đ
                              </TableCell>

                              <TableCell align="right">
                                {formatMoney(item.balanceAfter)} đ
                              </TableCell>

                              <TableCell>
                                {item.tripId || item.trip?.id || "N/A"}
                              </TableCell>

                              <TableCell>
                                {item.withdrawRequestId ||
                                  item.withdrawRequest?.id ||
                                  "N/A"}
                              </TableCell>

                              <TableCell sx={{ minWidth: 260 }}>
                                {item.note || "N/A"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    <TablePagination
                      component="div"
                      count={Number(ledgerMeta.total || 0)}
                      page={Math.max(0, Number(ledgerMeta.page || 1) - 1)}
                      onPageChange={(_, newPage) => {
                        setLedgerMeta((prev) => ({
                          ...prev,
                          page: newPage + 1,
                        }));
                      }}
                      rowsPerPage={Number(ledgerMeta.pageSize || 10)}
                      onRowsPerPageChange={(e) => {
                        const nextPageSize = Number(e.target.value || 10);
                        setLedgerMeta((prev) => ({
                          ...prev,
                          page: 1,
                          pageSize: nextPageSize,
                        }));
                      }}
                      rowsPerPageOptions={[5, 10, 20, 50]}
                      labelRowsPerPage="Số dòng mỗi trang"
                      showFirstButton
                      showLastButton
                      sx={{
                        borderTop: "1px solid",
                        borderColor: "divider",
                        ".MuiTablePagination-toolbar": {
                          minHeight: 56,
                          flexWrap: "wrap",
                          gap: 1,
                        },
                        ".MuiTablePagination-actions": {
                          display: "flex",
                          alignItems: "center",
                          marginLeft: 1,
                        },
                        ".MuiIconButton-root": {
                          color: "text.primary",
                        },
                      }}
                    />
                  </>
                )}
              </Paper>
            </Stack>
          )}
        </Box>
      </Paper>

      <WalletActionDialog
        open={actionState.open}
        mode={actionState.mode}
        driver={actionState.driver}
        loading={submitting}
        form={form}
        onClose={closeActionDialog}
        onChange={handleFormChange}
        onSubmit={handleSubmitAction}
      />

      <WalletHistoryDialog
        open={historyState.open}
        driver={historyState.driver}
        loading={historyState.loading}
        items={historyState.items}
        onClose={closeHistoryDialog}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={handleCloseSnackbar}
          sx={{ width: "100%", borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
