// Path: goviet247/apps/web/src/components/customer/CustomerLayout.jsx
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  Button,
  Container,
  Stack,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
  Badge,
  ListItemText,
} from "@mui/material";
import LocalPhoneIcon from "@mui/icons-material/LocalPhone";
import ChatIcon from "@mui/icons-material/Chat";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import DirectionsCarFilledOutlinedIcon from "@mui/icons-material/DirectionsCarFilledOutlined";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import { useEffect, useMemo, useState } from "react";
import { getPublicSystemConfig } from "../../api/systemConfig";
import ZaloFloatingButton from "./ZaloFloatingButton";
import { useCustomerAuth } from "../../context/CustomerAuthContext";

export const HEADER_H = 72;
export const FOOTER_H = 44;

export const CUSTOMER_SCROLL_ID = "customer-scroll-container";

function formatPhoneForDisplay(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");

  if (raw.startsWith("+84") && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }

  if (digits.startsWith("84") && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }

  return digits || raw;
}

export default function CustomerLayout() {
  const [supportPhone, setSupportPhone] = useState("1900-0000");
  const [supportEmail, setSupportEmail] = useState("");
  const [brandName, setBrandName] = useState("GoViet247");
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [footerCopyright, setFooterCopyright] = useState(
    "© 2023 GoViet247 - Công ty TNHH Công nghệ ViNa LightHouse",
  );
  const [anchorEl, setAnchorEl] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, notifications, markAllNotificationsRead } =
    useCustomerAuth();

  const menuOpen = Boolean(anchorEl);
  const isBookingPage = location.pathname === "/dat-xe";

  const unreadNotificationCount = useMemo(() => {
    return (Array.isArray(notifications) ? notifications : []).filter(
      (item) => !item?.isRead,
    ).length;
  }, [notifications]);

  const recentNotifications = useMemo(() => {
    return (Array.isArray(notifications) ? notifications : []).slice(0, 5);
  }, [notifications]);

  const greetingLabel = useMemo(() => {
    const displayName = String(user?.displayName || "").trim();
    if (displayName) return displayName;

    const phone = formatPhoneForDisplay(user?.phone);
    if (phone) return phone;

    return "Tài khoản";
  }, [user]);

  useEffect(() => {
    async function loadConfig() {
      try {
        const cfg = await getPublicSystemConfig();

        setSupportPhone(cfg?.supportPhoneRider || "1900-0000");
        setSupportEmail(cfg?.supportEmailRider || "");
        setBrandName(cfg?.brandName || "GoViet247");
        setBrandLogoUrl(cfg?.brandLogoUrl || "");
        setFooterCopyright(
          cfg?.footerCopyright ||
            "© 2023 GoViet247 - Công ty TNHH Công nghệ ViNa LightHouse",
        );
      } catch (err) {
        console.error("Load system config failed:", err);
      }
    }

    loadConfig();
  }, []);

  const handleOpenUserMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorEl(null);
  };

  const handleGoProfile = () => {
    handleCloseUserMenu();
    navigate("/ho-so");
  };

  const handleGoNotifications = () => {
    handleCloseUserMenu();
    markAllNotificationsRead();
    navigate("/thong-bao");
  };

  const handleGoBooking = () => {
    navigate("/dat-xe");
  };

  const handleLogout = () => {
    handleCloseUserMenu();
    logout();
    navigate("/", { replace: true });
  };

  return (
    <Box sx={{ height: "100dvh", bgcolor: "#fff", overflow: "hidden" }}>
      {/* ================= HEADER ================= */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          height: HEADER_H,
          bgcolor: "#ffffff",
          borderBottom: "1px solid #f1f5f9",
          justifyContent: "center",
          zIndex: (t) => t.zIndex.drawer + 2,
        }}
      >
        <Toolbar sx={{ minHeight: HEADER_H }}>
          <Container
            maxWidth="lg"
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: { xs: 0, sm: 2 },
            }}
          >
            {/* Logo */}
            <Box component={Link} to="/" sx={{ textDecoration: "none" }}>
              <Stack direction="row" alignItems="center" spacing={1.2}>
                {brandLogoUrl ? (
                  <Box
                    component="img"
                    src={brandLogoUrl}
                    alt={brandName || "GoViet247"}
                    sx={{
                      width: 34,
                      height: 34,
                      objectFit: "contain",
                      display: "block",
                      borderRadius: 1.5,
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: 2,
                      bgcolor: "#F97316",
                    }}
                  />
                )}

                <Typography
                  sx={{
                    color: "#1F2937",
                    fontWeight: 800,
                    letterSpacing: 0.3,
                    fontSize: 18,
                  }}
                >
                  {brandName || "GoViet247"}
                </Typography>
              </Stack>
            </Box>

            {/* Actions */}
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="text"
                startIcon={<ChatIcon />}
                sx={{
                  color: "#374151",
                  textTransform: "none",
                  display: { xs: "none", md: "inline-flex" },
                }}
                href={`https://zalo.me/${supportPhone}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Chat Zalo
              </Button>

              <Button
                variant={isBookingPage ? "contained" : "outlined"}
                startIcon={
                  <DirectionsCarFilledOutlinedIcon
                    sx={{ fontSize: { xs: 18, sm: 20 } }}
                  />
                }
                onClick={handleGoBooking}
                sx={{
                  textTransform: "none",
                  borderRadius: 2,
                  fontWeight: 800,
                  display: "inline-flex",
                  minWidth: { xs: "auto", sm: 0 },
                  px: { xs: 1.25, sm: 1.75 },
                  color: isBookingPage ? "white" : "#F97316",
                  borderColor: "#F97316",
                  bgcolor: isBookingPage ? "#F97316" : "transparent",
                  "& .MuiButton-startIcon": {
                    mr: { xs: 0.5, sm: 1 },
                    ml: 0,
                  },
                  "&:hover": {
                    bgcolor: "#EA580C",
                    color: "white",
                    borderColor: "#EA580C",
                  },
                }}
              >
                Đặt xe
              </Button>

              {!user ? (
                <>
                  <Button
                    variant="outlined"
                    sx={{
                      textTransform: "none",
                      borderRadius: 2,
                      fontWeight: 700,
                      color: "#374151",
                      borderColor: "#e5e7eb",
                      "&:hover": {
                        borderColor: "#d1d5db",
                        bgcolor: "#f9fafb",
                      },
                    }}
                    onClick={() => navigate("/dang-nhap")}
                  >
                    Đăng nhập
                  </Button>

                  <Button
                    variant="contained"
                    sx={{
                      textTransform: "none",
                      borderRadius: 2,
                      fontWeight: 800,
                      bgcolor: "#F97316",
                      "&:hover": { bgcolor: "#EA580C" },
                    }}
                    onClick={() => navigate("/dang-ky")}
                  >
                    Đăng ký
                  </Button>
                </>
              ) : (
                <>
                  <Tooltip title="Mở menu tài khoản" arrow>
                    <Badge
                      color="error"
                      badgeContent={unreadNotificationCount}
                      invisible={unreadNotificationCount <= 0}
                      overlap="rectangular"
                      sx={{
                        "& .MuiBadge-badge": {
                          right: 10,
                          top: 8,
                          fontWeight: 800,
                        },
                      }}
                    >
                      <Button
                        variant="outlined"
                        onClick={handleOpenUserMenu}
                        sx={{
                          minWidth: "auto",
                          px: { xs: 1, sm: 1.5 },
                          borderRadius: 2,
                          borderColor: menuOpen ? "#F97316" : "#e5e7eb",
                          bgcolor: menuOpen ? "#FFF7ED" : "#ffffff",
                          color: "#374151",
                          boxShadow: menuOpen
                            ? "0 0 0 3px rgba(249,115,22,0.12)"
                            : "none",
                          "&:hover": {
                            borderColor: "#F97316",
                            bgcolor: "#FFF7ED",
                          },
                        }}
                      >
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={0.5}
                        >
                          <AccountCircleOutlinedIcon
                            sx={{ fontSize: { xs: 20, sm: 22 } }}
                          />

                          <KeyboardArrowDownRoundedIcon
                            sx={{
                              fontSize: { xs: 18, sm: 20 },
                              transition: "transform 0.2s ease",
                              transform: menuOpen ? "rotate(180deg)" : "none",
                              display: { xs: "none", sm: "inline-flex" },
                            }}
                          />

                          {/* chỉ show text ở desktop */}
                          <Box
                            component="span"
                            sx={{
                              display: { xs: "none", sm: "inline-block" },
                              ml: 0.5,
                              fontWeight: 800,
                              maxWidth: 180,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Xin chào, {greetingLabel}
                          </Box>
                        </Stack>
                      </Button>
                    </Badge>
                  </Tooltip>

                  <Menu
                    anchorEl={anchorEl}
                    open={menuOpen}
                    onClose={handleCloseUserMenu}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "right" }}
                    PaperProps={{
                      sx: {
                        mt: 1,
                        minWidth: 240,
                        borderRadius: 2.5,
                        overflow: "hidden",
                        border: "1px solid #fed7aa",
                        boxShadow: "0 14px 36px rgba(15, 23, 42, 0.14)",
                      },
                    }}
                  >
                    <Box sx={{ px: 2, py: 1.35, bgcolor: "#FFF7ED" }}>
                      <Typography
                        sx={{
                          fontWeight: 900,
                          fontSize: 14,
                          color: "#1F2937",
                        }}
                      >
                        {String(user?.displayName || "").trim() ||
                          "Tài khoản khách hàng"}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ opacity: 0.78, color: "#374151" }}
                      >
                        {formatPhoneForDisplay(user?.phone) ||
                          "Chưa có số điện thoại"}
                      </Typography>
                    </Box>

                    <Divider />

                    <MenuItem onClick={handleGoProfile} sx={{ py: 1.35 }}>
                      <PersonOutlineIcon sx={{ mr: 1.2, fontSize: 20 }} />
                      <ListItemText primary="Hồ sơ" />
                    </MenuItem>

                    <MenuItem
                      onClick={handleGoNotifications}
                      sx={{ py: 1.35, alignItems: "flex-start" }}
                    >
                      <NotificationsNoneOutlinedIcon
                        sx={{ mr: 1.2, fontSize: 20, mt: 0.2 }}
                      />
                      <ListItemText
                        primary="Thông báo"
                        secondary={
                          recentNotifications.length > 0
                            ? recentNotifications
                                .map((item) => item?.message)
                                .filter(Boolean)
                                .slice(0, 2)
                                .join(" • ")
                            : "Xem thông báo hệ thống mới nhất"
                        }
                        primaryTypographyProps={{ fontWeight: 700 }}
                        secondaryTypographyProps={{
                          sx: {
                            mt: 0.25,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            whiteSpace: "normal",
                          },
                        }}
                      />
                      {unreadNotificationCount > 0 && (
                        <Badge
                          color="error"
                          badgeContent={unreadNotificationCount}
                          sx={{ ml: 1, mt: 0.5 }}
                        />
                      )}
                    </MenuItem>

                    <MenuItem onClick={handleLogout} sx={{ py: 1.35 }}>
                      <LogoutIcon sx={{ mr: 1.2, fontSize: 20 }} />
                      Đăng xuất
                    </MenuItem>
                  </Menu>
                </>
              )}
            </Stack>
          </Container>
        </Toolbar>
      </AppBar>

      {/* ================= CONTENT ================= */}
      <Box
        id={CUSTOMER_SCROLL_ID}
        key={location.pathname}
        sx={{
          position: "fixed",
          top: `${HEADER_H}px`,
          bottom: `${FOOTER_H}px`,
          left: 0,
          right: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          scrollBehavior: "smooth",
          bgcolor: "#fff",
          pb: 2,
          zIndex: 0,
        }}
      >
        <Outlet />
      </Box>

      {/* ================= FOOTER ================= */}
      <Box
        sx={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: (t) => t.zIndex.drawer + 2,
          height: FOOTER_H,
          display: "flex",
          alignItems: "center",
          bgcolor: "#F97316",
          color: "white",
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 13,
              gap: 1.5,
              flexWrap: "wrap",
            }}
          >
            <span>
              {footerCopyright ||
                "© 2023 GoViet247 - Công ty TNHH Công nghệ ViNa LightHouse"}
            </span>
            <span>
              Hỗ trợ: {supportPhone}
              {supportEmail ? ` | ${supportEmail}` : ""}
            </span>
          </Box>
        </Container>
      </Box>

      <ZaloFloatingButton />
    </Box>
  );
}
