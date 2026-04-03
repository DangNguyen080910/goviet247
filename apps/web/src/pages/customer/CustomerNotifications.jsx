import { useEffect, useMemo, useRef } from "react";
import {
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

  return date.toLocaleString("vi-VN");
}

function NotificationCard({ title, message, createdAt, unread = false }) {
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
            }}
          >
            {message || "Không có nội dung"}
          </Typography>

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
  const { notifications, notificationsLoading, markAllNotificationsRead } =
    useCustomerAuth();

  const daDanhDauDaDocRef = useRef(false);

  useEffect(() => {
    if (daDanhDauDaDocRef.current) return;

    daDanhDauDaDocRef.current = true;
    markAllNotificationsRead();
  }, [markAllNotificationsRead]);

  const visibleItems = useMemo(() => {
    const list = Array.isArray(notifications) ? notifications : [];

    return [...list].sort((a, b) => {
      const timeA = new Date(a?.createdAt || 0).getTime();
      const timeB = new Date(b?.createdAt || 0).getTime();
      return timeB - timeA;
    });
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
                  title={item.title || "Thông báo hệ thống"}
                  message={item.message || ""}
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
