// Path: goviet247/apps/web/src/pages/admin/AdminCustomers.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Drawer,
  Divider,
  Button,
  Stack,
  Snackbar,
  Alert,
  Tabs,
  Tab,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";

import {
  fetchCustomers,
  fetchCustomerDetail,
  fetchCustomerLogs,
  patchCustomerAccount,
} from "../../api/adminCustomers";
import { initializeAdminSocketBridge } from "../../services/adminSocket";

import DriverActionDialog from "../../components/admin/DriverActionDialog";

function statusColor(status) {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "SUSPENDED":
      return "default";
    default:
      return "default";
  }
}

function getCustomerDisplayName(customer) {
  return (
    customer?.riderProfile?.fullName ||
    customer?.displayName ||
    customer?.phones?.[0]?.e164 ||
    "-"
  );
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState(null);

  // Filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all"); // all | ACTIVE | SUSPENDED
  const [phoneVerified, setPhoneVerified] = useState("all"); // all | true | false
  const [sort, setSort] = useState("newest"); // newest | oldest

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Debounce search
  const [qDebounced, setQDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const listParams = useMemo(() => {
    return {
      q: qDebounced,
      status,
      phoneVerified,
      sort,
      page,
      pageSize,
    };
  }, [qDebounced, status, phoneVerified, sort, page, pageSize]);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [logs, setLogs] = useState([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Tabs in drawer
  const [tab, setTab] = useState(0);

  // Toast
  const [toast, setToast] = useState({
    open: false,
    type: "success",
    message: "",
  });

  // Dialog state
  const [dialog, setDialog] = useState({
    open: false,
    type: null, // "SUSPEND" | "UNSUSPEND"
  });

  // Load list whenever filters change
  useEffect(() => {
    load(listParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listParams]);

  function playRealtimeBeep() {
    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) return;

      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);

      gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.08,
        audioContext.currentTime + 0.01,
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + 0.18,
      );

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.18);

      oscillator.onended = () => {
        audioContext.close().catch(() => {});
      };
    } catch (err) {
      console.error("[AdminCustomers] playRealtimeBeep error:", err);
    }
  }

  useEffect(() => {
    initializeAdminSocketBridge();

    let dangTaiRealtime = false;

    const handleDashboardChanged = async () => {
      if (dangTaiRealtime) return;
      dangTaiRealtime = true;

      try {
        await load(listParams);

        if (selectedId) {
          await refreshSelected(selectedId);
        }

        playRealtimeBeep();
      } catch (err) {
        console.error("[AdminCustomers] realtime reload error:", err);
      } finally {
        dangTaiRealtime = false;
      }
    };

    window.addEventListener("admin:dashboard_changed", handleDashboardChanged);

    return () => {
      window.removeEventListener(
        "admin:dashboard_changed",
        handleDashboardChanged,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listParams, selectedId]);

  async function load(params = {}) {
    try {
      setLoading(true);
      const data = await fetchCustomers(params);
      setCustomers(data.items || []);
      setMeta(data.meta || null);
    } catch (err) {
      console.error(err);
      setToast({
        open: true,
        type: "error",
        message: err?.message || "Không tải được danh sách khách hàng.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function refreshSelected(userId = selectedId) {
    if (!userId) return;
    const [d, l] = await Promise.all([
      fetchCustomerDetail(userId),
      fetchCustomerLogs(userId),
    ]);
    setDetail(d);
    setLogs(l?.logs || []);
  }

  async function openDrawer(userId) {
    setTab(0);
    setSelectedId(userId);
    setDrawerLoading(true);
    setDetail(null);
    setLogs([]);

    try {
      await refreshSelected(userId);
    } catch (e) {
      console.error(e);
      setToast({
        open: true,
        type: "error",
        message: "Không tải được chi tiết khách hàng.",
      });
    } finally {
      setDrawerLoading(false);
    }
  }

  function closeDrawer() {
    setSelectedId(null);
    setDetail(null);
    setLogs([]);
    setDrawerLoading(false);
    setActionLoading(false);
    setTab(0);
  }

  function openDialog(type) {
    setDialog({ open: true, type });
  }

  function closeDialog() {
    setDialog({ open: false, type: null });
  }

  async function confirmDialog(reason) {
    if (!selectedId || !dialog.type) return;

    try {
      setActionLoading(true);

      if (dialog.type === "SUSPEND") {
        const res = await patchCustomerAccount(selectedId, {
          action: "SUSPEND",
          reason,
        });
        setToast({
          open: true,
          type: "success",
          message: res?.message || "Đã khoá khách hàng.",
        });
      }

      if (dialog.type === "UNSUSPEND") {
        const res = await patchCustomerAccount(selectedId, {
          action: "UNSUSPEND",
          reason,
        });
        setToast({
          open: true,
          type: "success",
          message: res?.message || "Đã mở khoá khách hàng.",
        });
      }

      closeDialog();
      await refreshSelected();
      await load(listParams);
    } catch (e) {
      console.error(e);
      setToast({
        open: true,
        type: "error",
        message: e.message || "Thao tác thất bại.",
      });
    } finally {
      setActionLoading(false);
    }
  }

  function renderActions() {
    if (!detail) return null;
    const s = detail.status;

    if (s === "ACTIVE") {
      return (
        <Stack direction="row" spacing={1} mt={2}>
          <Button
            variant="contained"
            color="error"
            disabled={actionLoading}
            onClick={() => openDialog("SUSPEND")}
          >
            Khoá tài khoản
          </Button>
        </Stack>
      );
    }

    if (s === "SUSPENDED") {
      return (
        <Stack direction="row" spacing={1} mt={2}>
          <Button
            variant="contained"
            disabled={actionLoading}
            onClick={() => openDialog("UNSUSPEND")}
          >
            Mở khoá
          </Button>
        </Stack>
      );
    }

    return null;
  }

  return (
    <Box p={3}>
      <Typography variant="h5" mb={2}>
        Quản lý khách hàng
      </Typography>

      {/* Filter bar */}
      <Box
        sx={{
          mb: 2,
          display: "flex",
          gap: 1.5,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <TextField
          size="small"
          label="Tìm kiếm"
          placeholder="Tên, SĐT..."
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          sx={{ minWidth: 260 }}
        />

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Trạng thái</InputLabel>
          <Select
            label="Trạng thái"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <MenuItem value="all">Tất cả</MenuItem>
            <MenuItem value="ACTIVE">ACTIVE</MenuItem>
            <MenuItem value="SUSPENDED">SUSPENDED</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 190 }}>
          <InputLabel>SĐT xác thực</InputLabel>
          <Select
            label="SĐT xác thực"
            value={phoneVerified}
            onChange={(e) => {
              setPage(1);
              setPhoneVerified(e.target.value);
            }}
          >
            <MenuItem value="all">Tất cả</MenuItem>
            <MenuItem value="true">Đã xác thực</MenuItem>
            <MenuItem value="false">Chưa xác thực</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 190 }}>
          <InputLabel>Sắp xếp</InputLabel>
          <Select
            label="Sắp xếp"
            value={sort}
            onChange={(e) => {
              setPage(1);
              setSort(e.target.value);
            }}
          >
            <MenuItem value="newest">Mới nhất</MenuItem>
            <MenuItem value="oldest">Cũ nhất</MenuItem>
          </Select>
        </FormControl>

        {meta?.total !== undefined && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ ml: "auto" }}
          >
            Tổng: <b>{meta.total}</b>
          </Typography>
        )}
      </Box>

      {loading ? (
        <Box p={3}>
          <CircularProgress />
        </Box>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Họ tên</TableCell>
              <TableCell>SĐT</TableCell>
              <TableCell>Tổng chuyến</TableCell>
              <TableCell>Trạng thái</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {customers.map((c) => (
              <TableRow
                key={c.id}
                hover
                sx={{ cursor: "pointer" }}
                onClick={() => openDrawer(c.id)}
              >
                <TableCell>{getCustomerDisplayName(c)}</TableCell>

                <TableCell>
                  {(() => {
                    const p = c.phones?.[0];
                    if (!p?.e164) return "-";
                    return p.isVerified ? p.e164 : `${p.e164} (chưa xác thực)`;
                  })()}
                </TableCell>

                <TableCell>{c._count?.riderTrips ?? 0}</TableCell>

                <TableCell>
                  <Chip
                    label={c.riderProfile?.status || "ACTIVE"}
                    color={statusColor(c.riderProfile?.status || "ACTIVE")}
                  />
                </TableCell>
              </TableRow>
            ))}

            {customers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography color="text.secondary">
                    Không có khách hàng phù hợp.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {/* Pagination */}
      {!loading && meta?.totalPages && meta.totalPages > 1 && (
        <Box
          sx={{
            mt: 2,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flexWrap: "wrap",
          }}
        >
          <Button
            variant="outlined"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Trước
          </Button>

          <Typography variant="body2">
            Trang <b>{meta.page}</b> / <b>{meta.totalPages}</b>
          </Typography>

          <Button
            variant="outlined"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
          >
            Sau
          </Button>

          <Box sx={{ flex: 1 }} />

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Mỗi trang</InputLabel>
            <Select
              label="Mỗi trang"
              value={pageSize}
              onChange={(e) => {
                setPage(1);
                setPageSize(Number(e.target.value));
              }}
            >
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Drawer */}
      <Drawer anchor="right" open={!!selectedId} onClose={closeDrawer}>
        <Box width={420} p={3}>
          {drawerLoading && (
            <Box display="flex" alignItems="center" gap={2}>
              <CircularProgress size={22} />
              <Typography>Đang tải chi tiết...</Typography>
            </Box>
          )}

          {!drawerLoading && detail && (
            <>
              <Typography variant="h6">
                {getCustomerDisplayName(detail.user)}
              </Typography>

              <Box mt={1}>
                <Chip
                  label={detail.status}
                  color={statusColor(detail.status)}
                />
              </Box>

              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                sx={{ mt: 2 }}
                variant="fullWidth"
              >
                <Tab label="Thông tin" />
                <Tab label="Lịch sử" />
              </Tabs>

              <Divider sx={{ my: 2 }} />

              {/* TAB 1: Thông tin */}
              {tab === 0 && (
                <>
                  {renderActions()}

                  {(() => {
                    const phone = detail.user?.phones?.[0];
                    const e164 = phone?.e164 || "-";
                    const hasPhone = !!phone?.e164;
                    const isVerified = !!phone?.isVerified;

                    return (
                      <Typography mt={2}>
                        SĐT: {e164}
                        {hasPhone && (
                          <Chip
                            size="small"
                            sx={{ ml: 1 }}
                            color={isVerified ? "success" : "warning"}
                            label={isVerified ? "ĐÃ XÁC THỰC" : "CHƯA XÁC THỰC"}
                          />
                        )}
                      </Typography>
                    );
                  })()}

                  <Typography>
                    Tổng chuyến: <b>{detail.counts?.riderTrips ?? 0}</b>
                  </Typography>

                  {detail.status === "SUSPENDED" && detail.suspendReason && (
                    <Typography mt={2} color="error">
                      Lý do khoá: {detail.suspendReason}
                    </Typography>
                  )}
                </>
              )}

              {/* TAB 2: Lịch sử */}
              {tab === 1 && (
                <>
                  {logs.length === 0 ? (
                    <Typography color="text.secondary">
                      Chưa có lịch sử.
                    </Typography>
                  ) : (
                    logs.map((x) => (
                      <Box key={x.id} mb={1.5}>
                        <Typography fontWeight={600}>
                          {x.action} ({x.fromStatus} → {x.toStatus})
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {x.actorUsername} ·{" "}
                          {new Date(x.createdAt).toLocaleString("vi-VN")}
                        </Typography>
                        {x.note && (
                          <Typography variant="body2">
                            Ghi chú: {x.note}
                          </Typography>
                        )}
                        <Divider sx={{ mt: 1.2 }} />
                      </Box>
                    ))
                  )}
                </>
              )}
            </>
          )}

          {!drawerLoading && !detail && (
            <Typography color="text.secondary">
              Không có dữ liệu chi tiết.
            </Typography>
          )}
        </Box>
      </Drawer>

      {/* Dialog bắt reason */}
      <DriverActionDialog
        open={dialog.open}
        onClose={closeDialog}
        requireReason={true}
        title={
          dialog.type === "SUSPEND"
            ? "Khoá tài khoản khách hàng"
            : "Mở khoá khách hàng"
        }
        description={
          dialog.type === "SUSPEND"
            ? "Vui lòng nhập lý do khoá tài khoản."
            : "Vui lòng nhập lý do mở khoá tài khoản."
        }
        confirmText="Xác nhận"
        onConfirm={confirmDialog}
      />

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={2500}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={toast.type}
          variant="filled"
          onClose={() => setToast((t) => ({ ...t, open: false }))}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
