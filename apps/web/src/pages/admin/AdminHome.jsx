// Path: goviet247/apps/web/src/pages/admin/AdminHome.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import LocalTaxiIcon from "@mui/icons-material/LocalTaxi";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import BadgeIcon from "@mui/icons-material/Badge";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import TodayIcon from "@mui/icons-material/Today";
import CurrencyExchangeIcon from "@mui/icons-material/CurrencyExchange";
import SettingsSuggestIcon from "@mui/icons-material/SettingsSuggest";
import SecurityIcon from "@mui/icons-material/Security";
import { fetchAdminDashboard } from "../../api/adminTrips";
import { getAdminUser } from "../../utils/adminAuth";

function formatMoney(value) {
  try {
    return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
  } catch {
    return String(value || 0);
  }
}

function formatDateTime(value) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleString("vi-VN");
}

function getPhoneText(phones) {
  if (!Array.isArray(phones) || phones.length === 0) return "--";
  return phones[0]?.e164 || "--";
}

function SummaryCard({ title, value, icon, onClick, clickable = true }) {
  const content = (
    <CardContent sx={{ p: 2.25 }}>
      <Stack direction="row" justifyContent="space-between" spacing={2}>
        <Box>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", fontWeight: 600 }}
          >
            {title}
          </Typography>
          <Typography variant="h4" sx={{ mt: 1, fontWeight: 800 }}>
            {value}
          </Typography>
        </Box>
        <Box sx={{ color: "primary.main", pt: 0.5 }}>{icon}</Box>
      </Stack>
    </CardContent>
  );

  return (
    <Card
      elevation={2}
      sx={{
        height: "100%",
        borderRadius: 3,
      }}
    >
      {clickable ? (
        <CardActionArea onClick={onClick} sx={{ height: "100%" }}>
          {content}
        </CardActionArea>
      ) : (
        content
      )}
    </Card>
  );
}

function SectionPaper({ title, subtitle, children, action }) {
  return (
    <Paper elevation={2} sx={{ p: 2.5, borderRadius: 3, height: "100%" }}>
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        spacing={2}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography
              variant="body2"
              sx={{ mt: 0.5, color: "text.secondary" }}
            >
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {action || null}
      </Stack>

      <Divider sx={{ my: 2 }} />

      {children}
    </Paper>
  );
}

function EmptyState({ text }) {
  return (
    <Typography variant="body2" sx={{ color: "text.secondary" }}>
      {text}
    </Typography>
  );
}

function UrgentTripList({ items, onOpenPage, emptyText }) {
  if (!items?.length) {
    return <EmptyState text={emptyText} />;
  }

  return (
    <List disablePadding>
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          <ListItem
            disableGutters
            sx={{
              alignItems: "flex-start",
              py: 1.25,
            }}
          >
            <ListItemText
              primary={
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  spacing={1}
                >
                  <Typography sx={{ fontWeight: 700 }}>
                    {item.riderName || "Khách chưa có tên"}
                  </Typography>
                  <Chip
                    size="small"
                    color="warning"
                    label={`${item.waitingMinutes || 0} phút`}
                  />
                </Stack>
              }
              secondary={
                <Box sx={{ mt: 0.5 }}>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", mb: 0.25 }}
                  >
                    {item.pickupAddress}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", mb: 0.25 }}
                  >
                    → {item.dropoffAddress}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.disabled" }}>
                    Tạo lúc: {formatDateTime(item.createdAt)}
                  </Typography>
                </Box>
              }
            />
          </ListItem>

          {index < items.length - 1 ? <Divider /> : null}
        </React.Fragment>
      ))}

      <Box sx={{ pt: 1.5 }}>
        <Chip
          label="Xem trang chi tiết"
          clickable
          color="primary"
          variant="outlined"
          onClick={onOpenPage}
        />
      </Box>
    </List>
  );
}

function DriverKycList({ items, onOpenPage, emptyText }) {
  if (!items?.length) {
    return <EmptyState text={emptyText} />;
  }

  return (
    <List disablePadding>
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          <ListItem disableGutters sx={{ alignItems: "flex-start", py: 1.25 }}>
            <ListItemText
              primary={
                <Typography sx={{ fontWeight: 700 }}>
                  {item.user?.displayName || "Tài xế chưa có tên"}
                </Typography>
              }
              secondary={
                <Box sx={{ mt: 0.5 }}>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", mb: 0.25 }}
                  >
                    SĐT: {getPhoneText(item.user?.phones)}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", mb: 0.25 }}
                  >
                    Biển số: {item.plateNumber || "--"}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.disabled" }}>
                    Gửi lúc: {formatDateTime(item.createdAt)}
                  </Typography>
                </Box>
              }
            />
          </ListItem>

          {index < items.length - 1 ? <Divider /> : null}
        </React.Fragment>
      ))}

      <Box sx={{ pt: 1.5 }}>
        <Chip
          label="Xem trang tài xế"
          clickable
          color="primary"
          variant="outlined"
          onClick={onOpenPage}
        />
      </Box>
    </List>
  );
}

function FeedbackList({ items, onOpenPage, emptyText }) {
  if (!items?.length) {
    return <EmptyState text={emptyText} />;
  }

  return (
    <List disablePadding>
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          <ListItem disableGutters sx={{ alignItems: "flex-start", py: 1.25 }}>
            <ListItemText
              primary={
                <Typography sx={{ fontWeight: 700 }}>
                  {item.subject || item.senderName || "Góp ý mới"}
                </Typography>
              }
              secondary={
                <Box sx={{ mt: 0.5 }}>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", mb: 0.25 }}
                  >
                    {item.message || "--"}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.disabled" }}>
                    {item.actorRole} • {formatDateTime(item.createdAt)}
                  </Typography>
                </Box>
              }
            />
          </ListItem>

          {index < items.length - 1 ? <Divider /> : null}
        </React.Fragment>
      ))}

      <Box sx={{ pt: 1.5 }}>
        <Chip
          label="Xem thư góp ý"
          clickable
          color="primary"
          variant="outlined"
          onClick={onOpenPage}
        />
      </Box>
    </List>
  );
}

export default function AdminHome() {
  const navigate = useNavigate();
  const adminUser = useMemo(() => getAdminUser(), []);
  const isAdmin =
    String(adminUser?.role || "")
      .trim()
      .toUpperCase() === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const data = await fetchAdminDashboard();

        if (!mounted) return;
        setDashboard(data);
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Không thể tải dữ liệu trang chủ.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    const handleDashboardChanged = () => {
      loadData();
    };

    loadData();

    window.addEventListener("admin:dashboard_changed", handleDashboardChanged);

    return () => {
      mounted = false;
      window.removeEventListener(
        "admin:dashboard_changed",
        handleDashboardChanged,
      );
    };
  }, []);

  if (loading) {
    return (
      <Paper
        elevation={2}
        sx={{
          p: 4,
          borderRadius: 3,
          minHeight: 220,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography sx={{ color: "text.secondary" }}>
            Đang tải dữ liệu trang chủ...
          </Typography>
        </Stack>
      </Paper>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ borderRadius: 3 }}>
        {error}
      </Alert>
    );
  }

  const stats = dashboard?.stats || {};
  const urgent = dashboard?.urgent || {};
  const today = dashboard?.today || {};
  const adminOnly = dashboard?.adminOnly || null;

  return (
    <Stack spacing={3}>
      <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Trang Chủ
        </Typography>
        <Typography sx={{ mt: 1, color: "text.secondary" }}>
          Tổng quan vận hành GoViet247 hôm nay. Staff nhìn việc cần xử lý, admin
          nhìn thêm sức khoẻ hệ thống và tài chính.
        </Typography>
      </Paper>

      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <SummaryCard
            title="Chuyến chờ duyệt"
            value={stats.pendingVerifyCount || 0}
            icon={<AccessTimeIcon fontSize="large" />}
            onClick={() => navigate("/admin/trips")}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <SummaryCard
            title="Chuyến chưa có tài xế"
            value={stats.unassignedCount || 0}
            icon={<WarningAmberIcon fontSize="large" />}
            onClick={() => navigate("/admin/pending-trips")}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <SummaryCard
            title="Chuyến tài xế đã nhận"
            value={stats.assignedCount || 0}
            icon={<LocalTaxiIcon fontSize="large" />}
            onClick={() => navigate("/admin/trips/assigned")}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <SummaryCard
            title="Cảnh báo 24h"
            value={stats.recentAlertsCount || 0}
            icon={<WarningAmberIcon fontSize="large" />}
            onClick={() => navigate("/admin/notifications")}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <SummaryCard
            title="Tài xế chờ KYC"
            value={stats.driverKycPendingCount || 0}
            icon={<BadgeIcon fontSize="large" />}
            onClick={() => navigate("/admin/drivers")}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <SummaryCard
            title="Góp ý mới"
            value={stats.feedbackNewCount || 0}
            icon={<MarkEmailUnreadIcon fontSize="large" />}
            onClick={isAdmin ? () => navigate("/admin/feedback") : undefined}
            clickable={isAdmin}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <SectionPaper
            title="Cần xử lý ngay"
            subtitle="Các chuyến chờ duyệt lâu nhất"
          >
            <UrgentTripList
              items={urgent.pendingTrips}
              emptyText="Hiện không có chuyến chờ duyệt."
              onOpenPage={() => navigate("/admin/trips")}
            />
          </SectionPaper>
        </Grid>

        <Grid item xs={12} md={6}>
          <SectionPaper
            title="Cần xử lý ngay"
            subtitle="Các chuyến đã duyệt nhưng chưa có tài xế"
          >
            <UrgentTripList
              items={urgent.unassignedTrips}
              emptyText="Hiện không có chuyến verified đang chờ tài xế."
              onOpenPage={() => navigate("/admin/pending-trips")}
            />
          </SectionPaper>
        </Grid>

        <Grid item xs={12} md={6}>
          <SectionPaper title="KYC tài xế" subtitle="Hồ sơ tài xế chờ duyệt">
            <DriverKycList
              items={urgent.driverKycs}
              emptyText="Hiện không có hồ sơ KYC chờ duyệt."
              onOpenPage={() => navigate("/admin/drivers")}
            />
          </SectionPaper>
        </Grid>

        {isAdmin ? (
          <Grid item xs={12} md={6}>
            <SectionPaper
              title="Thư góp ý mới"
              subtitle="Những góp ý cần xem sớm"
            >
              <FeedbackList
                items={urgent.feedbacks}
                emptyText="Hiện không có góp ý mới."
                onOpenPage={() => navigate("/admin/feedback")}
              />
            </SectionPaper>
          </Grid>
        ) : null}
      </Grid>

      <SectionPaper
        title="Hôm nay"
        subtitle="Nhịp vận hành trong ngày"
        action={
          <Chip
            icon={<TodayIcon />}
            label="Cập nhật theo dữ liệu hiện tại"
            color="primary"
            variant="outlined"
          />
        }
      >
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Chuyến tạo mới
                </Typography>
                <Typography variant="h4" sx={{ mt: 1, fontWeight: 800 }}>
                  {today.createdCount || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Chuyến đã duyệt
                </Typography>
                <Typography variant="h4" sx={{ mt: 1, fontWeight: 800 }}>
                  {today.verifiedCount || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Chuyến hoàn thành
                </Typography>
                <Typography variant="h4" sx={{ mt: 1, fontWeight: 800 }}>
                  {today.completedCount || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Chuyến đã huỷ
                </Typography>
                <Typography variant="h4" sx={{ mt: 1, fontWeight: 800 }}>
                  {today.cancelledCount || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </SectionPaper>

      {isAdmin && adminOnly ? (
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={4}>
            <SectionPaper
              title="Tài chính hệ thống"
              subtitle="Chỉ admin mới thấy"
              action={
                <Chip
                  icon={<CurrencyExchangeIcon />}
                  label="Admin only"
                  color="warning"
                  variant="outlined"
                />
              }
            >
              <Stack spacing={1.25}>
                <Typography>
                  <strong>Tổng số dư ví tài xế:</strong>{" "}
                  {formatMoney(adminOnly.finance?.walletBalanceTotal)} đ
                </Typography>
                <Typography>
                  <strong>Số tài xế có ví:</strong>{" "}
                  {adminOnly.finance?.driverCount || 0}
                </Typography>
                <Typography>
                  <strong>Tổng tiền rút đã duyệt chờ chi:</strong>{" "}
                  {formatMoney(adminOnly.finance?.withdrawPendingTotal)} đ
                </Typography>
                <Typography>
                  <strong>Số yêu cầu đã duyệt chờ chi:</strong>{" "}
                  {adminOnly.finance?.withdrawPendingCount || 0}
                </Typography>
              </Stack>
            </SectionPaper>
          </Grid>

          <Grid item xs={12} md={4}>
            <SectionPaper
              title="Cấu hình hệ thống"
              subtitle="Snapshot cấu hình hiện tại"
              action={
                <Chip
                  icon={<SettingsSuggestIcon />}
                  label="Admin only"
                  color="warning"
                  variant="outlined"
                />
              }
            >
              <Stack spacing={1.25}>
                <Typography>
                  <strong>Commission hiện tại:</strong>{" "}
                  {adminOnly.system?.commissionPercent || 0}%
                </Typography>
                <Typography>
                  <strong>Tiền cọc tài xế:</strong>{" "}
                  {formatMoney(adminOnly.system?.driverDepositAmount)} đ
                </Typography>
                <Typography>
                  <strong>Support phone tài xế:</strong>{" "}
                  {adminOnly.system?.supportPhoneDriver || "--"}
                </Typography>
                <Typography>
                  <strong>Support phone khách:</strong>{" "}
                  {adminOnly.system?.supportPhoneRider || "--"}
                </Typography>
                <Typography>
                  <strong>Timezone:</strong>{" "}
                  {adminOnly.system?.timezone || "Asia/Ho_Chi_Minh"}
                </Typography>
              </Stack>
            </SectionPaper>
          </Grid>

          <Grid item xs={12} md={4}>
            <SectionPaper
              title="Rủi ro cần chú ý"
              subtitle="Các tín hiệu cần để mắt"
              action={
                <Chip
                  icon={<SecurityIcon />}
                  label="Admin only"
                  color="warning"
                  variant="outlined"
                />
              }
            >
              <Stack spacing={1.25}>
                <Typography>
                  <strong>Chuyến chờ duyệt quá lâu:</strong>{" "}
                  {adminOnly.risks?.pendingVerifyTooLongCount || 0}
                </Typography>
                <Typography>
                  <strong>Chuyến đã duyệt nhưng chưa có tài xế quá lâu:</strong>{" "}
                  {adminOnly.risks?.unassignedTooLongCount || 0}
                </Typography>
                <Typography>
                  <strong>Yêu cầu rút tiền đang chờ:</strong>{" "}
                  {adminOnly.risks?.withdrawPendingCount || 0}
                </Typography>
                <Typography>
                  <strong>Feedback tồn đọng:</strong>{" "}
                  {adminOnly.risks?.feedbackBacklogCount || 0}
                </Typography>
              </Stack>
            </SectionPaper>
          </Grid>
        </Grid>
      ) : null}
    </Stack>
  );
}
