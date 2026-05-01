// Path: goviet247/apps/web/src/pages/admin/AdminDrivers.jsx
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
  fetchDrivers,
  fetchDriverDetail,
  fetchDriverLogs,
  patchDriverKyc,
  patchDriverAccount,
} from "../../api/adminDrivers";
import { initializeAdminSocketBridge } from "../../services/adminSocket";

import DriverActionDialog from "../../components/admin/DriverActionDialog";
import {
  docTypeLabel,
  docStatusLabel,
  docStatusColor,
} from "../../utils/driverDocs";

function statusColor(status) {
  switch (status) {
    case "PENDING":
      return "warning";
    case "VERIFIED":
      return "success";
    case "REJECTED":
      return "error";
    case "SUSPENDED":
      return "default";
    default:
      return "default";
  }
}

function formatNgayGio(input) {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return d.toLocaleString("vi-VN");
}

function getDriverDisplayName(driver) {
  return (
    driver?.fullName ||
    driver?.user?.displayName ||
    driver?.user?.phones?.[0]?.e164 ||
    "-"
  );
}

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true); // list loading
  const [meta, setMeta] = useState(null);

  // Filters (A)
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL"); // ALL | PENDING | VERIFIED | REJECTED | SUSPENDED
  const [phoneVerified, setPhoneVerified] = useState("all"); // all | true | false
  const [sort, setSort] = useState("createdAt_desc"); // createdAt_desc | createdAt_asc | status_asc | status_desc

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
    type: null, // "REJECT" | "SUSPEND" | "UNSUSPEND"
  });

  // ✅ NEW: lỗi hiển thị ngay trong dialog (vd: "Không có quyền admin")
  const [dialogError, setDialogError] = useState("");

  // Load list whenever filters change
  useEffect(() => {
    load(listParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listParams]);

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
        console.error("[AdminDrivers] realtime reload error:", err);
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
      console.error("[AdminDrivers] playRealtimeBeep error:", err);
    }
  }

  async function load(params = {}) {
    try {
      setLoading(true);
      const data = await fetchDrivers(params);
      setDrivers(data.items || []);
      setMeta(data.meta || null);
    } catch (err) {
      console.error(err);
      setToast({
        open: true,
        type: "error",
        message: err?.message || "Không tải được danh sách tài xế.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function refreshSelected(driverId = selectedId) {
    if (!driverId) return;
    const [d, l] = await Promise.all([
      fetchDriverDetail(driverId),
      fetchDriverLogs(driverId),
    ]);
    setDetail(d);
    setLogs(l?.logs || []);
  }

  async function openDrawer(driverId) {
    setTab(0);
    setSelectedId(driverId);
    setDrawerLoading(true);
    setDetail(null);
    setLogs([]);

    try {
      await refreshSelected(driverId);
    } catch (e) {
      console.error(e);
      setToast({
        open: true,
        type: "error",
        message: "Không tải được chi tiết tài xế.",
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
    setDialogError("");
  }

  // ======================
  // Actions
  // ======================

  async function handleApprove() {
    if (!selectedId) return;
    try {
      setActionLoading(true);
      const res = await patchDriverKyc(selectedId, { action: "APPROVE" });
      setToast({
        open: true,
        type: "success",
        message: res?.message || "Đã duyệt tài xế.",
      });

      await refreshSelected();
      await load(listParams);
    } catch (e) {
      console.error(e);
      // ✅ nếu staff bấm Duyệt thì cũng trả 403, show toast là đủ
      setToast({
        open: true,
        type: "error",
        message: e.message || "Duyệt tài xế thất bại.",
      });
    } finally {
      setActionLoading(false);
    }
  }

  function openDialog(type) {
    setDialogError("");
    setDialog({ open: true, type });
  }

  function closeDialog() {
    setDialogError("");
    setDialog({ open: false, type: null });
  }

  async function confirmDialog(reason) {
    if (!selectedId || !dialog.type) return;

    try {
      setActionLoading(true);
      setDialogError("");

      if (dialog.type === "REJECT") {
        const res = await patchDriverKyc(selectedId, {
          action: "REJECT",
          reason,
        });
        setToast({
          open: true,
          type: "success",
          message: res?.message || "Đã từ chối tài xế.",
        });
      }

      if (dialog.type === "SUSPEND") {
        const res = await patchDriverAccount(selectedId, {
          action: "SUSPEND",
          reason,
        });
        setToast({
          open: true,
          type: "success",
          message: res?.message || "Đã khoá tài xế.",
        });
      }

      if (dialog.type === "UNSUSPEND") {
        const res = await patchDriverAccount(selectedId, {
          action: "UNSUSPEND",
          reason,
        });
        setToast({
          open: true,
          type: "success",
          message: res?.message || "Đã mở khoá tài xế.",
        });
      }

      closeDialog();
      await refreshSelected();
      await load(listParams);
    } catch (e) {
      console.error(e);

      const msg = e?.message || "Thao tác thất bại.";

      // ✅ Nếu là lỗi quyền (403) => giữ dialog mở và show đỏ ngay trong dialog
      if (
        msg.toLowerCase().includes("không có quyền") ||
        msg.toLowerCase().includes("permission") ||
        msg.toLowerCase().includes("forbidden")
      ) {
        setDialogError(msg);
        return;
      }

      // ✅ Lỗi khác => toast như cũ
      setToast({
        open: true,
        type: "error",
        message: msg,
      });
    } finally {
      setActionLoading(false);
    }
  }

  function renderActions() {
    if (!detail) return null;

    const s = detail.status;

    if (s === "PENDING") {
      return (
        <Stack direction="row" spacing={1} mt={2}>
          <Button
            variant="contained"
            disabled={actionLoading}
            onClick={handleApprove}
          >
            Duyệt
          </Button>
          <Button
            variant="outlined"
            color="error"
            disabled={actionLoading}
            onClick={() => openDialog("REJECT")}
          >
            Từ chối
          </Button>
        </Stack>
      );
    }

    if (s === "REJECTED") {
      return (
        <Stack direction="row" spacing={1} mt={2}>
          <Button
            variant="contained"
            disabled={actionLoading}
            onClick={handleApprove}
          >
            Duyệt lại
          </Button>
          <Button
            variant="outlined"
            color="error"
            disabled={actionLoading}
            onClick={() => openDialog("REJECT")}
          >
            Từ chối lại
          </Button>
        </Stack>
      );
    }

    if (s === "VERIFIED") {
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

  // ======================
  // Render
  // ======================

  return (
    <Box p={3}>
      <Typography variant="h5" mb={2}>
        Quản lý tài xế
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
          placeholder="Tên, SĐT, biển số..."
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
            <MenuItem value="ALL">Tất cả</MenuItem>
            <MenuItem value="PENDING">PENDING</MenuItem>
            <MenuItem value="VERIFIED">VERIFIED</MenuItem>
            <MenuItem value="REJECTED">REJECTED</MenuItem>
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
            <MenuItem value="createdAt_desc">Mới nhất</MenuItem>
            <MenuItem value="createdAt_asc">Cũ nhất</MenuItem>
            <MenuItem value="status_asc">Trạng thái A→Z</MenuItem>
            <MenuItem value="status_desc">Trạng thái Z→A</MenuItem>
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
              <TableCell>Hãng xe</TableCell>
              <TableCell>Model xe</TableCell>
              <TableCell>Đời xe</TableCell>
              <TableCell>Biển số</TableCell>
              <TableCell>Ngày tạo</TableCell>
              <TableCell align="right">Hoàn thành</TableCell>
              <TableCell align="right">Đã huỷ</TableCell>
              <TableCell>Trạng thái</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {drivers.map((d) => (
              <TableRow
                key={d.id}
                hover
                sx={{ cursor: "pointer" }}
                onClick={() => openDrawer(d.id)}
              >
                <TableCell>{getDriverDisplayName(d)}</TableCell>

                <TableCell>
                  {(() => {
                    const p = d.user?.phones?.[0];
                    if (!p?.e164) return "-";
                    return p.isVerified ? p.e164 : `${p.e164} (chưa xác thực)`;
                  })()}
                </TableCell>

                <TableCell>{d.vehicleBrand || "-"}</TableCell>
                <TableCell>{d.vehicleModel || "-"}</TableCell>
                <TableCell>{d.vehicleYear || "-"}</TableCell>
                <TableCell>{d.plateNumber || "-"}</TableCell>
                <TableCell>{formatNgayGio(d.createdAt)}</TableCell>

                <TableCell align="right">
                  {Number(d.completedTripCount || 0)}
                </TableCell>
                <TableCell align="right">
                  {Number(d.cancelledTripCount || 0)}
                </TableCell>

                <TableCell>
                  <Chip label={d.status} color={statusColor(d.status)} />
                </TableCell>
              </TableRow>
            ))}

            {drivers.length === 0 && (
              <TableRow>
                <TableCell colSpan={10}>
                  <Typography color="text.secondary">
                    Không có tài xế phù hợp.
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
                {getDriverDisplayName(detail)}
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
                <Tab label="Giấy tờ" />
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

                  <Typography>Biển số: {detail.plateNumber || "-"}</Typography>
                  <Typography>
                    Xe: {detail.vehicleBrand || "-"} {detail.vehicleModel || ""}
                  </Typography>
                  <Typography>Đời xe: {detail.vehicleYear || "-"}</Typography>
                  <Typography>
                    Ngày tạo hồ sơ: {formatNgayGio(detail.createdAt)}
                  </Typography>

                  {detail.status === "REJECTED" && detail.rejectReason && (
                    <Typography mt={2} color="error">
                      Lý do từ chối: {detail.rejectReason}
                    </Typography>
                  )}

                  {detail.status === "SUSPENDED" && detail.suspendReason && (
                    <Typography mt={2} color="error">
                      Lý do khoá: {detail.suspendReason}
                    </Typography>
                  )}
                </>
              )}

              {/* TAB 2: Giấy tờ */}
              {tab === 1 && (
                <>
                  {!detail.documents || detail.documents.length === 0 ? (
                    <Typography color="text.secondary">
                      Chưa có giấy tờ.
                    </Typography>
                  ) : (
                    detail.documents.map((doc) => (
                      <Box
                        key={doc.id}
                        sx={{
                          border: "1px solid #eee",
                          borderRadius: 2,
                          p: 1.5,
                          mb: 1.5,
                        }}
                      >
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Typography fontWeight={700}>
                            {docTypeLabel(doc.type)}
                          </Typography>
                          <Chip
                            size="small"
                            label={docStatusLabel(doc.status)}
                            color={docStatusColor(doc.status)}
                          />
                        </Box>

                        <Typography
                          variant="body2"
                          color="text.secondary"
                          mt={0.5}
                        >
                          Tải lên:{" "}
                          {doc.createdAt
                            ? new Date(doc.createdAt).toLocaleString("vi-VN")
                            : "-"}
                        </Typography>

                        {doc.reviewedAt && (
                          <Typography variant="body2" color="text.secondary">
                            Duyệt lúc:{" "}
                            {new Date(doc.reviewedAt).toLocaleString("vi-VN")}
                          </Typography>
                        )}

                        {doc.note && (
                          <Typography variant="body2" mt={0.5}>
                            Ghi chú: {doc.note}
                          </Typography>
                        )}

                        <Box mt={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={!doc.viewUrl && !doc.fileUrl}
                            onClick={() =>
                              window.open(doc.viewUrl || doc.fileUrl, "_blank")
                            }
                          >
                            Xem ảnh
                          </Button>
                        </Box>
                      </Box>
                    ))
                  )}
                </>
              )}

              {/* TAB 3: Lịch sử */}
              {tab === 2 && (
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
          dialog.type === "REJECT"
            ? "Từ chối tài xế"
            : dialog.type === "SUSPEND"
              ? "Khoá tài khoản tài xế"
              : "Mở khoá tài xế"
        }
        description={
          dialog.type === "REJECT"
            ? "Vui lòng nhập lý do từ chối hồ sơ."
            : dialog.type === "SUSPEND"
              ? "Vui lòng nhập lý do khoá tài khoản."
              : "Vui lòng nhập lý do mở khoá tài khoản."
        }
        confirmText="Xác nhận"
        onConfirm={confirmDialog}
        // ✅ NEW
        errorText={dialogError}
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
