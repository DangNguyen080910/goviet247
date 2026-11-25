import { sortNotifications } from "../../../../api/src/shared/notificationPresentation.js";
import CopyTripIdButton from "../../components/common/CopyTripIdButton.jsx";
import {useNavigate} from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Box,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";

import { HEADER_H, FOOTER_H } from "../../components/customer/CustomerLayout";
import { useCustomerAuth } from "../../context/CustomerAuthContext";

function formatDateTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}

function NotificationCard({ id, title, message, createdAt, unread = false, tripId, isPinned, isCollapsed = true, onChange }) {
  const [collapsed, setCollapsed] = useState(isCollapsed);
  useEffect(() => setCollapsed(isCollapsed), [id, isCollapsed]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saving = useRef(false);
  const change = async values => {
    if (saving.current) return;
    if (values.isCollapsed !== undefined) setCollapsed(values.isCollapsed);
    saving.current = true; setBusy(true); setError("");
    try { await onChange(id, values); }
    catch (err) { setError(err.message || "Chưa lưu được lựa chọn thông báo."); }
    finally { saving.current = false; setBusy(false); }
  };
  const navigate=useNavigate();
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        border: "1px solid #fed7aa",
        backgroundColor: "#fff7ed",
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2.5,
            bgcolor: "#ffedd5",
            color: "#f97316",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <CampaignOutlinedIcon />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            sx={{ mb: 0.5 }}
          >
            <Typography
              sx={{
                fontWeight: 800,
                color: "#111827",
                lineHeight: 1.35,
              }}
            >
              {title}
            </Typography>

            {unread ? (
              <Box
                sx={{
                  px: 1,
                  py: 0.25,
                  borderRadius: 999,
                  bgcolor: "#dc2626",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 800,
                  lineHeight: 1.4,
                }}
              >
                Mới
              </Box>
            ) : null}
          </Stack>

          <Typography
            sx={{
              color: "#374151",
              whiteSpace: "pre-line",
              lineHeight: 1.6,
              ...(collapsed ? { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } : {}),
            }}
          >
            {message || "Không có nội dung"}
          </Typography>
          <Stack spacing={0.5} sx={{ mt: 0.5 }}>
            <Button sx={{ alignSelf: "flex-start" }} disabled={busy} aria-expanded={!collapsed} onClick={() => change({ isCollapsed: !collapsed })}>{collapsed ? "Xem thêm" : "Thu gọn"}</Button>
            <Button variant="outlined" size="small" sx={{ alignSelf: "flex-end" }} disabled={busy} aria-pressed={Boolean(isPinned)} onClick={() => change({ isPinned: !isPinned })}>{isPinned ? "📌 Bỏ ghim" : "Ghim"}</Button>
          </Stack>
          {error && <Alert severity="error">{error}</Alert>}
          {tripId && <CopyTripIdButton tripId={tripId}/>}
          {tripId && <Button onClick={()=>navigate(`/ho-so?focusTripId=${encodeURIComponent(tripId)}`)}>Xem chuyến</Button>}

          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            sx={{ mt: 1.25, color: "#6b7280" }}
          >
            <AccessTimeOutlinedIcon sx={{ fontSize: 16 }} />
            <Typography variant="body2">{formatDateTime(createdAt)}</Typography>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

export default function CustomerNotifications() {
  const { notifications, notificationsLoading, markAllNotificationsRead, updateNotificationPreferences } =
    useCustomerAuth();

  const daDanhDauDaDocRef = useRef(false);

  useEffect(() => {
    if (daDanhDauDaDocRef.current) return;

    daDanhDauDaDocRef.current = true;
    markAllNotificationsRead();
  }, [markAllNotificationsRead]);

  const visibleItems = useMemo(() => {
    const list = Array.isArray(notifications) ? notifications : [];

    return sortNotifications(list);
  }, [notifications]);

  return (
    <Box
      sx={{
        minHeight: `calc(100dvh - ${HEADER_H}px - ${FOOTER_H}px)`,
        bgcolor: "#ffffff",
        py: { xs: 2, md: 3 },
      }}
    >
      <Container maxWidth="md">
        <Stack spacing={2}>
          <Box>
            <Typography
              sx={{
                fontSize: { xs: 24, md: 30 },
                fontWeight: 900,
                color: "#111827",
              }}
            >
              Thông báo
            </Typography>

            <Typography
              sx={{
                mt: 0.75,
                color: "#6b7280",
                lineHeight: 1.7,
              }}
            >
              Xem các thông báo hệ thống dành cho khách hàng.
            </Typography>
          </Box>

          {notificationsLoading ? (
            <Paper
              elevation={0}
              sx={{
                p: 4,
                borderRadius: 3,
                border: "1px solid #e5e7eb",
                textAlign: "center",
                bgcolor: "#fff",
              }}
            >
              <CircularProgress />
              <Typography sx={{ mt: 1.5, color: "#6b7280" }}>
                Đang tải thông báo...
              </Typography>
            </Paper>
          ) : visibleItems.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 4,
                borderRadius: 3,
                border: "1px dashed #fdba74",
                textAlign: "center",
                bgcolor: "#fff",
              }}
            >
              <NotificationsNoneOutlinedIcon
                sx={{ fontSize: 42, color: "#f97316", mb: 1 }}
              />
              <Typography sx={{ fontWeight: 800, color: "#111827" }}>
                Chưa có thông báo nào
              </Typography>
              <Typography sx={{ mt: 0.75, color: "#6b7280" }}>
                Khi có thông báo mới từ hệ thống, nội dung sẽ hiển thị tại đây.
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={1.5}>
              {visibleItems.map((item) => (
                <NotificationCard
                  key={item.id}
                  id={item.id} isPinned={item.isPinned} isCollapsed={item.isCollapsed} onChange={updateNotificationPreferences}
                  tripId={item.tripId || item.data?.tripId || item.meta?.tripId || String(item.message||'').match(/\[tripId:([^\]]+)\]/)?.[1]}
                  title={item.title || "Thông báo hệ thống"}
                  message={String(item.message || "").replace(/\s*\[tripId:[^\]]+\]/g, "").trim()}
                  createdAt={item.createdAt}
                  unread={Boolean(item.isRead === false)}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
