// Path: goviet247/apps/web/src/pages/admin/AdminFeedback.jsx
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
  Pagination,
  CircularProgress,
  Divider,
  Tabs,
  Tab,
} from "@mui/material";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import CloseIcon from "@mui/icons-material/Close";

import { getAdminToken, getAdminUser } from "../../utils/adminAuth";

function getApiBaseUrl() {
  return (
    import.meta?.env?.VITE_API_URL ||
    import.meta?.env?.VITE_API_BASE ||
    "http://localhost:5050/api"
  );
}

function formatDateTime(value) {
  if (!value) return "—";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString("vi-VN");
}

function getActorRoleLabel(value) {
  if (value === "RIDER") return "Rider";
  if (value === "DRIVER") return "Driver";
  return value || "—";
}

function getSourceLabel(value) {
  switch (value) {
    case "RIDER_PROFILE":
      return "Rider • Hồ sơ";
    case "RIDER_TRIP_HISTORY":
      return "Rider • Lịch sử chuyến";
    case "DRIVER_MENU":
      return "Driver • Menu";
    case "DRIVER_TRIP_HISTORY":
      return "Driver • Lịch sử chuyến";
    default:
      return value || "—";
  }
}

function getStatusColor(value) {
  switch (value) {
    case "NEW":
      return "error";
    case "IN_REVIEW":
      return "warning";
    case "RESOLVED":
      return "success";
    case "CLOSED":
      return "default";
    default:
      return "default";
  }
}

function getStatusLabel(value) {
  switch (value) {
    case "NEW":
      return "Mới";
    case "IN_REVIEW":
      return "Đang xử lý";
    case "RESOLVED":
      return "Đã xử lý";
    case "CLOSED":
      return "Đóng";
    default:
      return value || "—";
  }
}

function getGroupLabel(value) {
  return value === "resolved" ? "Đã xử lý" : "Chưa xử lý";
}

function normalizeStatusForGroup(group, status) {
  const normalized = String(status || "").trim().toUpperCase();

  if (!normalized) return "";

  if (group === "resolved") {
    return ["RESOLVED", "CLOSED"].includes(normalized) ? normalized : "";
  }

  return ["NEW", "IN_REVIEW"].includes(normalized) ? normalized : "";
}

export default function AdminFeedback() {
  const user = getAdminUser();
  const token = getAdminToken();
  const role = String(user?.role || "").toUpperCase();
  const isSuperAdmin = role === "ADMIN";

  const [qInput, setQInput] = React.useState("");
  const [actorRoleInput, setActorRoleInput] = React.useState("");
  const [statusInput, setStatusInput] = React.useState("");
  const [groupTab, setGroupTab] = React.useState("pending");

  const [q, setQ] = React.useState("");
  const [actorRole, setActorRole] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [page, setPage] = React.useState(1);

  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState([]);
  const [meta, setMeta] = React.useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });

  const [tabCounts, setTabCounts] = React.useState({
    pending: 0,
    resolved: 0,
  });

  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [selectedFeedback, setSelectedFeedback] = React.useState(null);

  const [editStatus, setEditStatus] = React.useState("NEW");
  const [editAdminNote, setEditAdminNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const [snack, setSnack] = React.useState({
    open: false,
    severity: "success",
    text: "",
  });

  const pageSize = 10;
  const apiBase = getApiBaseUrl();

  const showSnack = React.useCallback((severity, text) => {
    setSnack({ open: true, severity, text });
  }, []);

  const getAllowedStatusesForTab = React.useCallback((tab) => {
    if (tab === "resolved") return ["RESOLVED", "CLOSED"];
    return ["NEW", "IN_REVIEW"];
  }, []);

  const getStatusOptionsForTab = React.useCallback((tab) => {
    if (tab === "resolved") {
      return [
        { value: "", label: "Tất cả" },
        { value: "RESOLVED", label: "Đã xử lý" },
        { value: "CLOSED", label: "Đóng" },
      ];
    }

    return [
      { value: "", label: "Tất cả" },
      { value: "NEW", label: "Mới" },
      { value: "IN_REVIEW", label: "Đang xử lý" },
    ];
  }, []);

  const buildQueryString = React.useCallback(() => {
    const params = new URLSearchParams();

    if (q.trim()) params.set("q", q.trim());
    if (actorRole) params.set("actorRole", actorRole);
    if (status) {
      params.set("status", status);
    } else {
      const allowedStatuses = getAllowedStatusesForTab(groupTab);
      if (allowedStatuses.length > 0) {
        params.set("status", allowedStatuses.join(","));
      }
    }

    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    return params.toString();
  }, [q, actorRole, status, page, pageSize, groupTab, getAllowedStatusesForTab]);

  const applyClientGroupFilter = React.useCallback(
    (list) => {
      const allowedStatuses = getAllowedStatusesForTab(groupTab);
      return Array.isArray(list)
        ? list.filter((item) =>
            allowedStatuses.includes(String(item?.status || "").trim().toUpperCase()),
          )
        : [];
    },
    [groupTab, getAllowedStatusesForTab],
  );

  const computeTabCounts = React.useCallback((list) => {
    const counts = {
      pending: 0,
      resolved: 0,
    };

    (Array.isArray(list) ? list : []).forEach((item) => {
      const current = String(item?.status || "").trim().toUpperCase();
      if (["NEW", "IN_REVIEW"].includes(current)) counts.pending += 1;
      if (["RESOLVED", "CLOSED"].includes(current)) counts.resolved += 1;
    });

    return counts;
  }, []);

  const fetchTabCounts = React.useCallback(async () => {
    try {
      const baseParams = new URLSearchParams();
      if (q.trim()) baseParams.set("q", q.trim());
      if (actorRole) baseParams.set("actorRole", actorRole);
      baseParams.set("page", "1");
      baseParams.set("pageSize", "100");

      const [pendingRes, resolvedRes] = await Promise.all([
        fetch(
          `${apiBase}/admin/feedbacks?${new URLSearchParams({
            ...Object.fromEntries(baseParams.entries()),
            status: "NEW,IN_REVIEW",
          }).toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        ),
        fetch(
          `${apiBase}/admin/feedbacks?${new URLSearchParams({
            ...Object.fromEntries(baseParams.entries()),
            status: "RESOLVED,CLOSED",
          }).toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        ),
      ]);

      const [pendingData, resolvedData] = await Promise.all([
        pendingRes.json(),
        resolvedRes.json(),
      ]);

      if (
        pendingRes.ok &&
        pendingData?.success &&
        resolvedRes.ok &&
        resolvedData?.success
      ) {
        setTabCounts({
          pending: Number(pendingData?.meta?.total || 0),
          resolved: Number(resolvedData?.meta?.total || 0),
        });
      }
    } catch (error) {
      console.error("[AdminFeedback] fetchTabCounts error:", error);
    }
  }, [apiBase, q, actorRole, token]);

  const fetchFeedbacks = React.useCallback(async () => {
    try {
      setLoading(true);

      const qs = buildQueryString();
      const res = await fetch(`${apiBase}/admin/feedbacks?${qs}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Không thể tải danh sách góp ý.");
      }

      const serverItems = Array.isArray(data.items) ? data.items : [];
      const filteredItems = applyClientGroupFilter(serverItems);
      const allCounts = computeTabCounts(serverItems);

      setItems(filteredItems);
      setTabCounts((prev) => ({
        pending:
          Number(data?.meta?.total || 0) > 0 && groupTab === "pending"
            ? Number(data?.meta?.total || 0)
            : prev.pending || allCounts.pending,
        resolved:
          Number(data?.meta?.total || 0) > 0 && groupTab === "resolved"
            ? Number(data?.meta?.total || 0)
            : prev.resolved || allCounts.resolved,
      }));

      setMeta(
        data.meta || {
          page: 1,
          pageSize,
          total: filteredItems.length,
          totalPages: 1,
        },
      );
    } catch (error) {
      console.error("[AdminFeedback] fetchFeedbacks error:", error);
      showSnack("error", error.message || "Không thể tải danh sách góp ý.");
    } finally {
      setLoading(false);
    }
  }, [
    apiBase,
    applyClientGroupFilter,
    buildQueryString,
    computeTabCounts,
    groupTab,
    pageSize,
    showSnack,
    token,
  ]);

  const fetchFeedbackDetail = React.useCallback(
    async (feedbackId) => {
      try {
        setDetailLoading(true);

        const res = await fetch(`${apiBase}/admin/feedbacks/${feedbackId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (!res.ok || !data?.success) {
          throw new Error(data?.message || "Không thể tải chi tiết góp ý.");
        }

        const feedback = data.feedback;
        setSelectedFeedback(feedback);
        setEditStatus(String(feedback?.status || "NEW"));
        setEditAdminNote(String(feedback?.adminNote || ""));
        setDetailOpen(true);
      } catch (error) {
        console.error("[AdminFeedback] fetchFeedbackDetail error:", error);
        showSnack("error", error.message || "Không thể tải chi tiết góp ý.");
      } finally {
        setDetailLoading(false);
      }
    },
    [apiBase, showSnack, token],
  );

  const handleSave = React.useCallback(async () => {
    if (!selectedFeedback?.id) return;

    try {
      setSaving(true);

      const res = await fetch(
        `${apiBase}/admin/feedbacks/${selectedFeedback.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: editStatus,
            adminNote: editAdminNote,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Không thể cập nhật góp ý.");
      }

      const updated = data.feedback;
      const updatedStatus = String(updated?.status || "").trim().toUpperCase();

      setSelectedFeedback((prev) => ({
        ...prev,
        ...updated,
      }));

      setItems((prev) => {
        const next = prev.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                ...updated,
              }
            : item,
        );

        const allowedStatuses = getAllowedStatusesForTab(groupTab);
        return next.filter((item) =>
          allowedStatuses.includes(String(item?.status || "").trim().toUpperCase()),
        );
      });

      setTabCounts((prev) => {
        const next = { ...prev };
        const belongsPending = ["NEW", "IN_REVIEW"].includes(updatedStatus);
        const belongsResolved = ["RESOLVED", "CLOSED"].includes(updatedStatus);

        if (
          ["NEW", "IN_REVIEW"].includes(
            String(selectedFeedback?.status || "").trim().toUpperCase(),
          ) &&
          belongsResolved
        ) {
          next.pending = Math.max(0, Number(next.pending || 0) - 1);
          next.resolved = Number(next.resolved || 0) + 1;
        }

        if (
          ["RESOLVED", "CLOSED"].includes(
            String(selectedFeedback?.status || "").trim().toUpperCase(),
          ) &&
          belongsPending
        ) {
          next.resolved = Math.max(0, Number(next.resolved || 0) - 1);
          next.pending = Number(next.pending || 0) + 1;
        }

        return next;
      });

      if (
        groupTab === "pending" &&
        ["RESOLVED", "CLOSED"].includes(updatedStatus)
      ) {
        setDetailOpen(false);
      }

      if (
        groupTab === "resolved" &&
        ["NEW", "IN_REVIEW"].includes(updatedStatus)
      ) {
        setDetailOpen(false);
      }

      showSnack("success", "Cập nhật góp ý thành công.");
    } catch (error) {
      console.error("[AdminFeedback] handleSave error:", error);
      showSnack("error", error.message || "Không thể cập nhật góp ý.");
    } finally {
      setSaving(false);
    }
  }, [
    apiBase,
    editAdminNote,
    editStatus,
    groupTab,
    selectedFeedback,
    showSnack,
    token,
    getAllowedStatusesForTab,
  ]);

  React.useEffect(() => {
    if (!isSuperAdmin) return;
    fetchFeedbacks();
  }, [fetchFeedbacks, isSuperAdmin]);

  React.useEffect(() => {
    if (!isSuperAdmin) return;
    fetchTabCounts();
  }, [fetchTabCounts, isSuperAdmin]);

  React.useEffect(() => {
  if (!isSuperAdmin) return;

  const handleRealtimeFeedbackChanged = () => {
    fetchFeedbacks();
    fetchTabCounts();
  };

  window.addEventListener(
    "admin:dashboard_changed",
    handleRealtimeFeedbackChanged,
  );

  return () => {
    window.removeEventListener(
      "admin:dashboard_changed",
      handleRealtimeFeedbackChanged,
    );
  };
}, [fetchFeedbacks, fetchTabCounts, isSuperAdmin]);

  if (!isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const statusOptions = getStatusOptionsForTab(groupTab);

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
            <MailOutlineIcon color="primary" />
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Thư Góp Ý
            </Typography>
          </Stack>

          <Typography variant="body1" color="text.secondary">
            Nơi tiếp nhận và xử lý góp ý từ Rider và Driver.
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
          mb: 2.5,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack spacing={2.5}>
          <Tabs
            value={groupTab}
            onChange={(_, nextValue) => {
              const nextGroup = String(nextValue || "pending");
              setGroupTab(nextGroup);
              setPage(1);
              setStatus("");
              setStatusInput("");
            }}
            variant="scrollable"
            allowScrollButtonsMobile
            sx={{
              minHeight: 44,
              "& .MuiTab-root": {
                minHeight: 44,
                textTransform: "none",
                fontWeight: 700,
              },
            }}
          >
            <Tab
              value="pending"
              label={`${getGroupLabel("pending")} (${tabCounts.pending || 0})`}
            />
            <Tab
              value="resolved"
              label={`${getGroupLabel("resolved")} (${tabCounts.resolved || 0})`}
            />
          </Tabs>

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Tìm kiếm"
                placeholder="Tên, số điện thoại, nội dung..."
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                label="Loại người gửi"
                value={actorRoleInput}
                onChange={(e) => setActorRoleInput(e.target.value)}
              >
                <MenuItem value="">Tất cả</MenuItem>
                <MenuItem value="RIDER">Rider</MenuItem>
                <MenuItem value="DRIVER">Driver</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} md={3}>
              <TextField
                select
                fullWidth
                label="Trạng thái"
                value={statusInput}
                onChange={(e) => setStatusInput(e.target.value)}
              >
                {statusOptions.map((option) => (
                  <MenuItem key={option.value || "all"} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} md={2}>
              <Stack direction="row" spacing={1} sx={{ height: "100%" }}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => {
                    setPage(1);
                    setQ(qInput.trim());
                    setActorRole(actorRoleInput);
                    setStatus(normalizeStatusForGroup(groupTab, statusInput));
                  }}
                >
                  Lọc
                </Button>

                <Button
                  variant="outlined"
                  onClick={() => {
                    setQInput("");
                    setActorRoleInput("");
                    setStatusInput("");
                    setQ("");
                    setActorRole("");
                    setStatus("");
                    setPage(1);
                  }}
                >
                  Reset
                </Button>
              </Stack>
            </Grid>
          </Grid>
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
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            bgcolor: "grey.50",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Danh sách góp ý
            </Typography>
            <Chip
              size="small"
              label={`Tổng: ${meta?.total || 0}`}
              color="primary"
              variant="outlined"
            />
            <Chip
              size="small"
              label={`Nhóm: ${getGroupLabel(groupTab)}`}
              variant="outlined"
            />
          </Stack>

          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={() => {
              fetchFeedbacks();
              fetchTabCounts();
            }}
            disabled={loading}
          >
            Tải lại
          </Button>
        </Box>

        {loading ? (
          <Box
            sx={{
              py: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 1.5,
            }}
          >
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Đang tải danh sách góp ý...
            </Typography>
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ p: 4 }}>
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              Chưa có góp ý nào trong nhóm <strong>{getGroupLabel(groupTab)}</strong>{" "}
              khớp bộ lọc hiện tại.
            </Alert>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Thời gian</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Người gửi</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Nguồn</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Nội dung</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Trạng thái</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      Thao tác
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item.id}
                      hover
                      sx={{
                        bgcolor:
                          ["NEW", "IN_REVIEW"].includes(
                            String(item?.status || "").trim().toUpperCase(),
                          )
                            ? "rgba(255, 244, 229, 0.25)"
                            : "inherit",
                      }}
                    >
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {formatDateTime(item.createdAt)}
                      </TableCell>

                      <TableCell sx={{ minWidth: 180 }}>
                        <Stack spacing={0.5}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {item.senderName ||
                              item.user?.displayName ||
                              "Không rõ tên"}
                          </Typography>

                          <Stack direction="row" spacing={1} flexWrap="wrap">
                            <Chip
                              size="small"
                              label={getActorRoleLabel(item.actorRole)}
                              color={
                                item.actorRole === "RIDER"
                                  ? "primary"
                                  : "secondary"
                              }
                              variant="outlined"
                            />

                            {item.senderPhone ? (
                              <Chip
                                size="small"
                                label={item.senderPhone}
                                variant="outlined"
                              />
                            ) : null}
                          </Stack>
                        </Stack>
                      </TableCell>

                      <TableCell sx={{ minWidth: 180 }}>
                        <Typography variant="body2">
                          {getSourceLabel(item.source)}
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ minWidth: 300 }}>
                        <Stack spacing={0.5}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {item.subject || "Không có tiêu đề"}
                          </Typography>

                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {item.message}
                          </Typography>
                        </Stack>
                      </TableCell>

                      <TableCell>
                        <Chip
                          size="small"
                          color={getStatusColor(item.status)}
                          label={getStatusLabel(item.status)}
                        />
                      </TableCell>

                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<VisibilityOutlinedIcon />}
                          onClick={() => fetchFeedbackDetail(item.id)}
                          disabled={detailLoading}
                        >
                          Xem
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider />

            <Box
              sx={{
                p: 2,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Pagination
                color="primary"
                page={meta?.page || 1}
                count={Math.max(1, meta?.totalPages || 1)}
                onChange={(_, value) => setPage(value)}
              />
            </Box>
          </>
        )}
      </Paper>

      <Dialog
        open={detailOpen}
        onClose={() => {
          if (saving) return;
          setDetailOpen(false);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pb: 1.5 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Chi tiết góp ý
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ID: {selectedFeedback?.id || "—"}
              </Typography>
            </Box>

            <Chip
              color={getStatusColor(selectedFeedback?.status)}
              label={getStatusLabel(selectedFeedback?.status)}
            />
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          {!selectedFeedback ? (
            <Box
              sx={{
                py: 6,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Stack spacing={2.5}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Người gửi"
                    value={
                      selectedFeedback.senderName ||
                      selectedFeedback.user?.displayName ||
                      ""
                    }
                    InputProps={{ readOnly: true }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Số điện thoại"
                    value={selectedFeedback.senderPhone || ""}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Vai trò"
                    value={getActorRoleLabel(selectedFeedback.actorRole)}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Nguồn gửi"
                    value={getSourceLabel(selectedFeedback.source)}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Ngày gửi"
                    value={formatDateTime(selectedFeedback.createdAt)}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Tiêu đề"
                    value={selectedFeedback.subject || ""}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    label="Nội dung góp ý"
                    value={selectedFeedback.message || ""}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
              </Grid>

              {selectedFeedback.trip ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: "grey.50",
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                    Thông tin chuyến liên quan
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Mã chuyến"
                        value={selectedFeedback.trip.id || ""}
                        InputProps={{ readOnly: true }}
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Trạng thái chuyến"
                        value={selectedFeedback.trip.status || ""}
                        InputProps={{ readOnly: true }}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Điểm đón"
                        value={selectedFeedback.trip.pickupAddress || ""}
                        InputProps={{ readOnly: true }}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Điểm trả"
                        value={selectedFeedback.trip.dropoffAddress || ""}
                        InputProps={{ readOnly: true }}
                      />
                    </Grid>
                  </Grid>
                </Paper>
              ) : null}

              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>
                  Xử lý góp ý
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      select
                      fullWidth
                      label="Trạng thái xử lý"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                    >
                      <MenuItem value="NEW">Mới</MenuItem>
                      <MenuItem value="IN_REVIEW">Đang xử lý</MenuItem>
                      <MenuItem value="RESOLVED">Đã xử lý</MenuItem>
                      <MenuItem value="CLOSED">Đóng</MenuItem>
                    </TextField>
                  </Grid>

                  <Grid item xs={12} md={8}>
                    <TextField
                      fullWidth
                      multiline
                      minRows={4}
                      label="Ghi chú admin"
                      value={editAdminNote}
                      onChange={(e) => setEditAdminNote(e.target.value)}
                      placeholder="Nhập ghi chú nội bộ để lưu lại quá trình xử lý..."
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={1.5}
                      alignItems={{ xs: "flex-start", md: "center" }}
                      justifyContent="space-between"
                    >
                      <Typography variant="body2" color="text.secondary">
                        Người xử lý:{" "}
                        {selectedFeedback?.resolvedBy?.username || "Chưa có"} •
                        Thời gian xử lý:{" "}
                        {formatDateTime(selectedFeedback?.resolvedAt)}
                      </Typography>

                      <Button
                        variant="contained"
                        startIcon={<SaveOutlinedIcon />}
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? "Đang lưu..." : "Lưu cập nhật"}
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </Paper>
            </Stack>
          )}
        </DialogContent>

        <DialogActions>
          <Button
            startIcon={<CloseIcon />}
            onClick={() => setDetailOpen(false)}
            disabled={saving}
          >
            Đóng
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          severity={snack.severity}
          variant="filled"
          onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
        >
          {snack.text}
        </Alert>
      </Snackbar>
    </Box>
  );
}