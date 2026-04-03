// Path: goviet247/apps/web/src/pages/admin/AdminLayout.jsx
import React from "react";
import { useTheme, useMediaQuery } from "@mui/material";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Button,
  Snackbar,
  Alert,
  Badge,
} from "@mui/material";

import DashboardIcon from "@mui/icons-material/Dashboard";
import ScheduleIcon from "@mui/icons-material/Schedule";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import PeopleIcon from "@mui/icons-material/People";
import LocalTaxiIcon from "@mui/icons-material/LocalTaxi";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import AssignmentIcon from "@mui/icons-material/Assignment";
import SettingsIcon from "@mui/icons-material/Settings";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import MailOutlineIcon from "@mui/icons-material/MailOutline";

import {
  clearAdminSession,
  getAdminUser,
  getAdminToken,
} from "../../utils/adminAuth";
import { fetchAdminDashboard } from "../../api/adminTrips";
import { io } from "socket.io-client";

const drawerWidth = 260;

function getSocketBaseUrl() {
  const raw = import.meta?.env?.VITE_API_URL || import.meta?.env?.VITE_API_BASE;

  if (!raw) {
    return window.location.origin;
  }

  return String(raw).replace(/\/api\/?$/i, "");
}

let __adminSocket = null;
let __adminSocketWired = false;

function getAdminSocket(baseUrl) {
  if (__adminSocket) return __adminSocket;

  __adminSocket = io(baseUrl, {
    transports: ["websocket", "polling"],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 2000,
  });

  return __adminSocket;
}

function normalizeBadgeCount(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

function buildMenuBadgeMap(dashboard, isSuperAdmin) {
  const stats = dashboard?.stats || {};
  const adminOnly = dashboard?.adminOnly || {};

  const withdrawPendingApproveCount = normalizeBadgeCount(
    adminOnly?.risks?.withdrawPendingCount,
  );

  const withdrawPendingTransferCount = normalizeBadgeCount(
    adminOnly?.finance?.withdrawPendingCount,
  );

  const penaltyPendingCount = normalizeBadgeCount(
    adminOnly?.risks?.driverTripPenaltyPendingCount,
  );

  return {
    "/admin/trips": normalizeBadgeCount(stats.pendingVerifyCount),
    "/admin/pending": normalizeBadgeCount(stats.unassignedCount),
    "/admin/trips/assigned": normalizeBadgeCount(stats.assignedCount),
    "/admin/alerts": normalizeBadgeCount(stats.recentAlertsCount),
    "/admin/system-notifications": 0,
    "/admin/drivers": normalizeBadgeCount(stats.driverKycPendingCount),
    "/admin/wallets": isSuperAdmin
      ? withdrawPendingApproveCount +
        withdrawPendingTransferCount +
        penaltyPendingCount
      : 0,
    "/admin/ledger": 0,
    "/admin/feedback": isSuperAdmin
      ? normalizeBadgeCount(stats.feedbackNewCount)
      : 0,
  };
}

function getBadgeColorByRoute(route) {
  if (route === "/admin/trips") return "error";
  if (route === "/admin/pending") return "error";
  if (route === "/admin/feedback") return "error";

  if (route === "/admin/alerts") return "warning";
  if (route === "/admin/ledger") return "warning";
  if (route === "/admin/drivers") return "warning";
  if (route === "/admin/wallets") return "warning";

  if (route === "/admin/trips/assigned") return "success";

  return "default";
}

function getAlertUiByRoute(route) {
  const color = getBadgeColorByRoute(route);

  if (color === "error") {
    return {
      badgeColor: "error",
      iconColor: "error.main",
      bgColor: "rgba(211, 47, 47, 0.08)",
    };
  }

  if (color === "warning") {
    return {
      badgeColor: "warning",
      iconColor: "warning.main",
      bgColor: "rgba(237, 108, 2, 0.10)",
    };
  }

  if (color === "success") {
    return {
      badgeColor: "success",
      iconColor: "success.main",
      bgColor: "rgba(46, 125, 50, 0.10)",
    };
  }

  return {
    badgeColor: "default",
    iconColor: "inherit",
    bgColor: "action.hover",
  };
}

const ADMIN_SOUND_FILE = "/sounds/ding.mp3";
const ADMIN_SOUND_COOLDOWN_MS = 1600;

let __adminUrgentAudio = null;
let __adminUpdateAudio = null;

const __adminLastPlayedAt = {
  urgent: 0,
  update: 0,
};

function getOrCreateAdminAudio(kind = "urgent") {
  if (typeof window === "undefined") return null;

  if (kind === "urgent") {
    if (!__adminUrgentAudio) {
      __adminUrgentAudio = new Audio(ADMIN_SOUND_FILE);
      __adminUrgentAudio.preload = "auto";
      __adminUrgentAudio.volume = 0.75;
    }
    return __adminUrgentAudio;
  }

  if (!__adminUpdateAudio) {
    __adminUpdateAudio = new Audio(ADMIN_SOUND_FILE);
    __adminUpdateAudio.preload = "auto";
    __adminUpdateAudio.volume = 0.35;
  }

  return __adminUpdateAudio;
}

async function playAdminUrgentSound() {
  try {
    const now = Date.now();
    if (now - __adminLastPlayedAt.urgent < ADMIN_SOUND_COOLDOWN_MS) return;
    __adminLastPlayedAt.urgent = now;

    const audio = getOrCreateAdminAudio("urgent");
    if (!audio) return;

    audio.currentTime = 0;
    await audio.play().catch(() => {});
  } catch (err) {
    console.log("[AdminLayout] urgent sound error:", err?.message || err);
  }
}

async function playAdminUpdateSound() {
  try {
    const now = Date.now();
    if (now - __adminLastPlayedAt.update < ADMIN_SOUND_COOLDOWN_MS) return;
    __adminLastPlayedAt.update = now;

    const audio = getOrCreateAdminAudio("update");
    if (!audio) return;

    audio.currentTime = 0;
    await audio.play().catch(() => {});
  } catch (err) {
    console.log("[AdminLayout] update sound error:", err?.message || err);
  }
}

function buildRealtimeEventKey(eventName, payload = {}) {
  const tripId = payload?.tripId || payload?.id || "";
  const withdrawRequestId = payload?.withdrawRequestId || "";
  const driverProfileId = payload?.driverProfileId || "";
  const status = payload?.status || "";
  const source = payload?.source || "";

  return [
    eventName,
    String(tripId),
    String(withdrawRequestId),
    String(driverProfileId),
    String(status),
    String(source),
  ].join("|");
}

function isUrgentDashboardChange(payload = {}) {
  const source = String(payload?.source || "")
    .trim()
    .toLowerCase();

  if (!source) return false;

  return (
    source.includes("withdraw") ||
    source.includes("wallet") ||
    source.includes("penalty") ||
    source.includes("alert") ||
    source.includes("pending") ||
    source.includes("unassigned")
  );
}

export default function AdminLayout() {
  const nav = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const user = getAdminUser();
  const token = getAdminToken();

  const role = String(user?.role || "")
    .trim()
    .toUpperCase();
  const isSuperAdmin = role === "ADMIN";

  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [snackOpen, setSnackOpen] = React.useState(false);
  const [snackText, setSnackText] = React.useState("");
  const [snackTarget, setSnackTarget] = React.useState("/admin/trips");
  const [dashboard, setDashboard] = React.useState(null);

  const prevBadgeRef = React.useRef({});
  const [pulseMap, setPulseMap] = React.useState({});
  const realtimeEventRef = React.useRef({
    key: "",
    at: 0,
  });

  const onLogout = () => {
    clearAdminSession();
    nav("/admin/login", { replace: true });
  };

  const showSnack = React.useCallback((text, target = "/admin") => {
    setSnackText(text);
    setSnackTarget(target);
    setSnackOpen(true);
  }, []);

  const loadDashboard = React.useCallback(async () => {
    try {
      const data = await fetchAdminDashboard();
      setDashboard(data || null);
    } catch (err) {
      console.log(
        "[AdminLayout] fetchAdminDashboard error:",
        err?.message || err,
      );
    }
  }, []);

  React.useEffect(() => {
    loadDashboard();

    const timer = window.setInterval(loadDashboard, 60000);

    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  React.useEffect(() => {
    if (!isMobile && mobileOpen) {
      setMobileOpen(false);
    }
  }, [isMobile, mobileOpen]);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const badgeMap = React.useMemo(
    () => buildMenuBadgeMap(dashboard, isSuperAdmin),
    [dashboard, isSuperAdmin],
  );

  React.useEffect(() => {
    const nextPulse = {};
    const prev = prevBadgeRef.current;

    Object.entries(badgeMap).forEach(([key, value]) => {
      const old = prev[key] || 0;
      if (value > old) {
        nextPulse[key] = true;

        setTimeout(() => {
          setPulseMap((p) => ({ ...p, [key]: false }));
        }, 1800);
      }
    });

    prevBadgeRef.current = badgeMap;
    if (Object.keys(nextPulse).length) {
      setPulseMap((p) => ({ ...p, ...nextPulse }));
    }
  }, [badgeMap]);

  const baseMenu = [
    { label: "Trang Chủ", icon: <DashboardIcon />, to: "/admin" },
    {
      label: "Chuyến (Chờ Duyệt)",
      icon: <AssignmentIcon />,
      to: "/admin/trips",
    },
    {
      label: "Chuyến Chưa Có Tài Xế",
      icon: <ScheduleIcon />,
      to: "/admin/pending",
    },
    {
      label: "Chuyến Tài Xế Đã Nhận",
      icon: <DirectionsCarIcon />,
      to: "/admin/trips/assigned",
    },
    { label: "Cảnh Báo", icon: <WarningAmberIcon />, to: "/admin/alerts" },
    {
      label: "Thông Báo Hệ Thống",
      icon: <NotificationsActiveIcon />,
      to: "/admin/system-notifications",
    },
    { label: "Tài Xế", icon: <LocalTaxiIcon />, to: "/admin/drivers" },
    { label: "Khách Hàng", icon: <PeopleIcon />, to: "/admin/users" },
  ];

  const adminOnlyMenu = [
    { label: "Cấu Hình", icon: <SettingsIcon />, to: "/admin/config" },
    {
      label: "Ví Tài Xế",
      icon: <AccountBalanceWalletIcon />,
      to: "/admin/wallets",
    },
    { label: "Sổ Sách", icon: <MenuBookIcon />, to: "/admin/ledger" },
    { label: "Thư Góp Ý", icon: <MailOutlineIcon />, to: "/admin/feedback" },
  ];

  const menu = isSuperAdmin ? [...baseMenu, ...adminOnlyMenu] : baseMenu;

  const getActiveKey = () => {
    const path = location.pathname;
    const sorted = [...menu].sort((a, b) => b.to.length - a.to.length);

    const hit = sorted.find((m) => {
      if (m.to === "/admin") return path === "/admin";
      return path === m.to || path.startsWith(m.to + "/");
    });

    return hit?.to || null;
  };

  const activeKey = getActiveKey();

  React.useEffect(() => {
    const baseUrl = getSocketBaseUrl();
    const socket = getAdminSocket(baseUrl);

    const shouldSkipRealtimeEvent = (eventName, payload = {}) => {
      const key = buildRealtimeEventKey(eventName, payload);
      const now = Date.now();
      const prev = realtimeEventRef.current;

      if (prev.key === key && now - prev.at < 1200) {
        return true;
      }

      realtimeEventRef.current = {
        key,
        at: now,
      };

      return false;
    };

    const handleNewTrip = async (payload) => {
      if (shouldSkipRealtimeEvent("admin:new_trip", payload)) return;

      await playAdminUrgentSound();

      const tripId = payload?.tripId || "";
      showSnack(
        `🔔 Có chuyến mới cần duyệt${
          tripId ? ` • ${String(tripId).slice(0, 8)}…` : ""
        }`,
        "/admin/trips",
      );

      loadDashboard();
    };

    const handleTripAccepted = async (payload) => {
      if (shouldSkipRealtimeEvent("admin:trip_accepted", payload)) return;

      await playAdminUrgentSound();

      const tripId = payload?.tripId || "";
      showSnack(
        `🚕 Có chuyến vừa được tài xế nhận${
          tripId ? ` • ${String(tripId).slice(0, 8)}…` : ""
        }`,
        "/admin/pending",
      );

      loadDashboard();
    };

    const handleTripStatusChanged = async (payload) => {
      if (shouldSkipRealtimeEvent("admin:trip_status_changed", payload)) return;

      await playAdminUpdateSound();

      const tripId = payload?.tripId || "";
      const status = String(payload?.status || "")
        .trim()
        .toUpperCase();

      const statusText =
        status === "CONTACTED"
          ? "đã chuyển sang CHƯA ĐÓN KHÁCH"
          : status === "IN_PROGRESS"
            ? "đã chuyển sang ĐANG TRÊN HÀNH TRÌNH"
            : status === "COMPLETED"
              ? "đã HOÀN THÀNH"
              : status === "CANCELLED"
                ? "đã HUỶ"
                : "đã thay đổi trạng thái";

      showSnack(
        `🔄 Chuyến ${tripId ? `${String(tripId).slice(0, 8)}… ` : ""}${statusText}`,
        "/admin/trips/assigned",
      );

      loadDashboard();
    };

    const handleTripCancelled = async (payload) => {
      if (shouldSkipRealtimeEvent("admin:trip_cancelled", payload)) return;

      await playAdminUrgentSound();

      const tripId = payload?.tripId || "";
      showSnack(
        `⚠️ Có chuyến đã bị huỷ${
          tripId ? ` • ${String(tripId).slice(0, 8)}…` : ""
        }`,
        "/admin/trips/assigned",
      );

      loadDashboard();
    };

    const handleDashboardChanged = async (payload) => {
      if (shouldSkipRealtimeEvent("admin:dashboard_changed", payload)) return;

      if (isUrgentDashboardChange(payload)) {
        await playAdminUrgentSound();
      } else {
        await playAdminUpdateSound();
      }

      const source = String(payload?.source || "")
        .trim()
        .toLowerCase();

      if (source.includes("withdraw") || source.includes("wallet")) {
        showSnack("💰 Ví tài xế vừa có thay đổi mới.", "/admin/wallets");
      } else if (source.includes("penalty")) {
        showSnack("⚠️ Có thay đổi mới ở phạt huỷ chuyến.", "/admin/wallets");
      } else if (source.includes("alert")) {
        showSnack("🚨 Có cảnh báo mới từ hệ thống.", "/admin/alerts");
      }

      loadDashboard();
    };

    if (!__adminSocketWired) {
      __adminSocketWired = true;

      socket.on("connect", () => {
        socket.emit("registerAdmin", {
          username: user?.username || "admin",
          token: token || "",
        });
      });

      socket.on("admin:new_trip", handleNewTrip);
      socket.on("admin:trip_accepted", handleTripAccepted);
      socket.on("admin:trip_status_changed", handleTripStatusChanged);
      socket.on("admin:trip_cancelled", handleTripCancelled);
      socket.on("admin:dashboard_changed", handleDashboardChanged);

      window.addEventListener(
        "admin:dashboard_changed",
        handleDashboardChanged,
      );

      return () => {
        window.removeEventListener(
          "admin:dashboard_changed",
          handleDashboardChanged,
        );
      };
    }
  }, [loadDashboard, showSnack, token, user?.username]);

  const drawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <style>
        {`
        @keyframes badgePulse {
          0% { transform: scale(1); }
          40% { transform: scale(1.35); }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        `}
      </style>

      <Box sx={{ p: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
          <Box
            sx={{
              width: 18,
              height: 18,
              borderRadius: 1.2,
              bgcolor: "#F97316",
              flexShrink: 0,
            }}
          />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            GoViet247 Admin
          </Typography>
        </Box>

        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.8 }}>
          {user?.role ? `${user.role} • ${user.username}` : "Admin Panel"}
        </Typography>
      </Box>

      <Divider />

      <List sx={{ flex: 1 }}>
        {menu.map((m) => {
          const active = activeKey === m.to;
          const badgeCount = badgeMap[m.to] || 0;
          const hasAlert = badgeCount > 0;
          const pulse = pulseMap[m.to];
          const alertUi = getAlertUiByRoute(m.to);

          return (
            <ListItemButton
              key={m.to}
              selected={active}
              onClick={() => {
                nav(m.to);
                setMobileOpen(false);
              }}
              sx={{
                mx: 1,
                my: 0.5,
                borderRadius: 2,
                ...(hasAlert &&
                  !active && {
                    bgcolor: alertUi.bgColor,
                  }),
                "&.Mui-selected": {
                  bgcolor: "action.selected",
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: hasAlert
                    ? alertUi.iconColor
                    : active
                      ? "primary.main"
                      : "inherit",
                  minWidth: 40,
                }}
              >
                {m.icon}
              </ListItemIcon>

              <ListItemText
                primary={m.label}
                primaryTypographyProps={{
                  sx: {
                    fontWeight: hasAlert || active ? 700 : 500,
                  },
                }}
              />

              {badgeCount > 0 && (
                <Badge
                  badgeContent={badgeCount > 99 ? "99+" : badgeCount}
                  color={alertUi.badgeColor}
                  sx={{
                    "& .MuiBadge-badge": {
                      fontWeight: 700,
                      minWidth: 22,
                      height: 22,
                      right: -6,
                      ...(pulse && {
                        animation: "badgePulse 0.6s ease 3",
                      }),
                    },
                  }}
                />
              )}
            </ListItemButton>
          );
        })}
      </List>

      <Divider />

      <Box sx={{ p: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<LogoutIcon />}
          onClick={onLogout}
        >
          Logout
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton
            color="inherit"
            edge="start"
            sx={{ display: { md: "none" } }}
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
            <Box
              sx={{
                width: 18,
                height: 18,
                borderRadius: 1.2,
                bgcolor: "#F97316",
                flexShrink: 0,
              }}
            />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              GoViet247 Admin
            </Typography>
          </Box>

          <Box sx={{ flex: 1 }} />

          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            {user?.username || "admin"}
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
          },
        }}
        open
      >
        <Toolbar />
        {drawerContent}
      </Drawer>

      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{
            keepMounted: false,
          }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
            },
          }}
        >
          {drawerContent}
        </Drawer>
      ) : null}

      <Box component="main" sx={{ flex: 1, p: 3 }}>
        <Toolbar />
        <Outlet />
      </Box>

      <Snackbar
        open={snackOpen}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackOpen(false)}
          severity="info"
          variant="filled"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setSnackOpen(false);
                nav(snackTarget || "/admin");
              }}
            >
              Xem ngay
            </Button>
          }
        >
          {snackText}
        </Alert>
      </Snackbar>
    </Box>
  );
}
