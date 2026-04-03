// Path: goviet247/apps/web/src/pages/customer/CustomerProfile.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
} from "@mui/material";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import HistoryIcon from "@mui/icons-material/History";
import FeedbackOutlinedIcon from "@mui/icons-material/FeedbackOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import { Navigate, useNavigate } from "react-router-dom";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { getMyTrips } from "../../api/trips";
import { updateMe } from "../../api/auth";
import { FOOTER_H } from "../../components/customer/CustomerLayout";
import { io } from "socket.io-client";

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

function formatDateTime(input) {
  if (!input) return "—";

  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function formatPrice(value) {
  const num = Number(value || 0);
  return `${num.toLocaleString("vi-VN")} đ`;
}

function getCustomerDisplayName(user) {
  return (
    String(user?.riderName || "").trim() ||
    String(user?.displayName || "").trim() ||
    formatPhoneForDisplay(user?.phone) ||
    ""
  );
}

function getStatusLabel(status, isVerified) {
  const s = String(status || "").toUpperCase();

  if (s === "PENDING") {
    return isVerified ? "Chờ tài xế" : "Chờ duyệt";
  }

  if (s === "ACCEPTED") return "Đã có tài xế";
  if (s === "CONTACTED") return "Đã liên hệ";
  if (s === "IN_PROGRESS") return "Đang di chuyển";
  if (s === "COMPLETED") return "Hoàn thành";
  if (s === "CANCELLED") return "Đã huỷ";

  return status || "—";
}

function getStatusColor(status, isVerified) {
  const s = String(status || "").toUpperCase();

  if (s === "PENDING") {
    return isVerified ? "info" : "warning";
  }

  if (s === "ACCEPTED") return "info";
  if (s === "CONTACTED") return "info";
  if (s === "IN_PROGRESS") return "primary";
  if (s === "COMPLETED") return "success";
  if (s === "CANCELLED") return "default";

  return "default";
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getRouteText(trip) {
  const pickup = String(trip?.pickupAddress || "").trim();
  const dropoff = String(trip?.dropoffAddress || "").trim();

  const stopAddresses = Array.isArray(trip?.stops)
    ? trip.stops
        .map((stop) => String(stop?.address || "").trim())
        .filter(Boolean)
    : [];

  const parts = [];

  if (pickup) {
    parts.push(pickup);
  }

  stopAddresses.forEach((address) => {
    const last = parts[parts.length - 1];
    if (normalizeText(last) !== normalizeText(address)) {
      parts.push(address);
    }
  });

  if (dropoff) {
    const last = parts[parts.length - 1];
    if (normalizeText(last) !== normalizeText(dropoff)) {
      parts.push(dropoff);
    }
  }

  if (parts.length === 0) return "—";
  return parts.join(" → ");
}

function getTripTypeLabel(trip) {
  const direction = String(trip?.direction || "")
    .trim()
    .toUpperCase();

  if (direction === "ROUND_TRIP") return "Khứ hồi";
  if (direction === "ONE_WAY") return "Một chiều";

  if (trip?.returnTime) return "Khứ hồi";

  return "Một chiều";
}

function getCarTypeLabel(carType) {
  switch (carType) {
    case "CAR_5":
      return "Xe 5 chỗ";
    case "CAR_7":
      return "Xe 7 chỗ";
    case "CAR_16":
      return "Xe 16 chỗ";
    default:
      return carType || "—";
  }
}

function getTripRiderName(trip) {
  return String(trip?.riderName || "").trim() || "—";
}

function getTripRiderPhone(trip) {
  const raw = String(trip?.riderPhone || "").trim();
  if (!raw) return "—";
  return formatPhoneForDisplay(raw);
}

function canShowFeedbackButton(trip) {
  const status = String(trip?.status || "")
    .trim()
    .toUpperCase();
  return status === "COMPLETED" || status === "CANCELLED";
}

function canCancelTripByRider(trip) {
  return (
    String(trip?.status || "")
      .trim()
      .toUpperCase() === "PENDING"
  );
}

function getApiBaseUrl() {
  return (
    import.meta?.env?.VITE_API_URL ||
    import.meta?.env?.VITE_API_BASE ||
    "http://localhost:5050/api"
  );
}

function getSocketBaseUrl() {
  const apiBase = String(getApiBaseUrl() || "").replace(/\/+$/, "");

  if (apiBase.endsWith("/api")) {
    return apiBase.slice(0, -4);
  }

  return apiBase;
}

function mergeTripsPreserveOrder(prevTrips = [], nextTrips = []) {
  const nextMap = new Map(
    (Array.isArray(nextTrips) ? nextTrips : []).map((trip) => [trip.id, trip]),
  );

  const merged = [];

  for (const oldTrip of Array.isArray(prevTrips) ? prevTrips : []) {
    const freshTrip = nextMap.get(oldTrip.id);
    if (freshTrip) {
      merged.push(freshTrip);
      nextMap.delete(oldTrip.id);
    }
  }

  for (const trip of nextMap.values()) {
    merged.push(trip);
  }

  return merged;
}

const RIDER_SOUND_FILE = "/sounds/ding.mp3";
const RIDER_SOUND_COOLDOWN_MS = 1800;

let __riderUrgentAudio = null;
let __riderUpdateAudio = null;

function canPlayRiderRealtimeSound() {
  if (typeof window === "undefined") return false;
  if (document.visibilityState !== "visible") return false;
  if (!document.hasFocus()) return false;
  return true;
}

function getOrCreateRiderAudio(kind = "urgent") {
  if (typeof window === "undefined") return null;

  if (kind === "urgent") {
    if (!__riderUrgentAudio) {
      __riderUrgentAudio = new Audio(RIDER_SOUND_FILE);
      __riderUrgentAudio.preload = "auto";
      __riderUrgentAudio.volume = 0.75;
    }
    return __riderUrgentAudio;
  }

  if (!__riderUpdateAudio) {
    __riderUpdateAudio = new Audio(RIDER_SOUND_FILE);
    __riderUpdateAudio.preload = "auto";
    __riderUpdateAudio.volume = 0.4;
  }

  return __riderUpdateAudio;
}

async function playRiderUrgentSound() {
  try {
    const audio = getOrCreateRiderAudio("urgent");
    if (!audio) return;
    audio.currentTime = 0;
    await audio.play().catch(() => {});
  } catch (err) {
    console.log("[CustomerProfile] urgent sound error:", err?.message || err);
  }
}

async function playRiderUpdateSound() {
  try {
    const audio = getOrCreateRiderAudio("update");
    if (!audio) return;
    audio.currentTime = 0;
    await audio.play().catch(() => {});
  } catch (err) {
    console.log("[CustomerProfile] update sound error:", err?.message || err);
  }
}

function getTripRealtimeChangeInfo(prevTrip, nextTrip) {
  if (!nextTrip?.id) return null;

  const prevStatus = String(prevTrip?.status || "")
    .trim()
    .toUpperCase();
  const nextStatus = String(nextTrip?.status || "")
    .trim()
    .toUpperCase();

  const prevVerified = Boolean(prevTrip?.isVerified);
  const nextVerified = Boolean(nextTrip?.isVerified);

  if (!prevTrip) {
    return null;
  }

  if (!prevVerified && nextVerified && nextStatus === "PENDING") {
    return {
      level: "urgent",
      message: `🎉 Chuyến ${String(nextTrip.id).slice(0, 8)}… đã được duyệt và đang chờ tài xế.`,
    };
  }

  if (
    prevStatus !== nextStatus &&
    (nextStatus === "ACCEPTED" || nextStatus === "CONTACTED")
  ) {
    return {
      level: "urgent",
      message: `🚕 Chuyến ${String(nextTrip.id).slice(0, 8)}… đã có tài xế nhận.`,
    };
  }

  if (prevStatus !== nextStatus && nextStatus === "CANCELLED") {
    return {
      level: "urgent",
      message: `⚠️ Chuyến ${String(nextTrip.id).slice(0, 8)}… đã bị huỷ.`,
    };
  }

  if (prevStatus !== nextStatus && nextStatus === "IN_PROGRESS") {
    return {
      level: "update",
      message: `🛣️ Chuyến ${String(nextTrip.id).slice(0, 8)}… đang di chuyển.`,
    };
  }

  if (prevStatus !== nextStatus && nextStatus === "COMPLETED") {
    return {
      level: "update",
      message: `✅ Chuyến ${String(nextTrip.id).slice(0, 8)}… đã hoàn thành.`,
    };
  }

  return null;
}

const CANCEL_REASON_OPTIONS = [
  "Đặt nhầm chuyến",
  "Đổi lịch trình",
  "Đổi điểm đón / điểm đến",
  "Không còn nhu cầu",
  "Lý do khác",
];

export default function CustomerProfile() {
  const navigate = useNavigate();
  const { token, user, loading, login, pushNotification } = useCustomerAuth();
  const socketRef = useRef(null);

  const hasLoadedTripsRef = useRef(false);
  const lastTripSoundAtRef = useRef(0);
  const lastTripEventKeyRef = useRef("");

  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  const [tripLoading, setTripLoading] = useState(true);
  const [trips, setTrips] = useState([]);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [cancelReason, setCancelReason] = useState("Đặt nhầm chuyến");
  const [cancelReasonOther, setCancelReasonOther] = useState("");
  const [cancelingTrip, setCancelingTrip] = useState(false);

  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackTrip, setFeedbackTrip] = useState(null);
  const [feedbackSource, setFeedbackSource] = useState("RIDER_PROFILE");
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);

  const [snackbar, setSnackbar] = useState({
    open: false,
    severity: "success",
    message: "",
  });

  useEffect(() => {
  setDisplayName(getCustomerDisplayName(user));
}, [user]);

  const notifyTripRealtimeChanges = async (prevTrips = [], nextTrips = []) => {
    if (!hasLoadedTripsRef.current) {
      return;
    }

    if (!canPlayRiderRealtimeSound()) {
      return;
    }

    const prevMap = new Map(
      (Array.isArray(prevTrips) ? prevTrips : []).map((trip) => [
        trip.id,
        trip,
      ]),
    );

    for (const nextTrip of Array.isArray(nextTrips) ? nextTrips : []) {
      const prevTrip = prevMap.get(nextTrip.id);
      const change = getTripRealtimeChangeInfo(prevTrip, nextTrip);

      if (!change) {
        continue;
      }

      const eventKey = [
        nextTrip.id,
        String(prevTrip?.status || "").toUpperCase(),
        String(nextTrip?.status || "").toUpperCase(),
        String(Boolean(prevTrip?.isVerified)),
        String(Boolean(nextTrip?.isVerified)),
      ].join("|");

      const now = Date.now();

      if (
        lastTripEventKeyRef.current === eventKey &&
        now - lastTripSoundAtRef.current < RIDER_SOUND_COOLDOWN_MS
      ) {
        return;
      }

      lastTripEventKeyRef.current = eventKey;
      lastTripSoundAtRef.current = now;

      if (change.level === "urgent") {
        await playRiderUrgentSound();
      } else {
        await playRiderUpdateSound();
      }

      pushNotification({
        id: eventKey,
        title:
          change.level === "urgent"
            ? "Cập nhật quan trọng"
            : "Cập nhật chuyến đi",
        message: change.message,
        tripId: nextTrip.id,
        createdAt: new Date().toISOString(),
        isRead: false,
        level: change.level,
      });

      setSnackbar({
        open: true,
        severity: change.level === "urgent" ? "info" : "success",
        message: change.message,
      });

      return;
    }
  };

  async function refreshTripsSilent(currentToken) {
    if (!currentToken) return;

    try {
      const items = await getMyTrips(currentToken);

      setTrips((prev) => {
        void notifyTripRealtimeChanges(prev, items);
        return mergeTripsPreserveOrder(prev, items);
      });

      hasLoadedTripsRef.current = true;
    } catch (err) {
      console.error("refreshTripsSilent failed:", err);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadTrips({ silent = false } = {}) {
      if (!token) {
        if (mounted) {
          setTripLoading(false);
        }
        return;
      }

      try {
        if (!silent && mounted) {
          setTripLoading(true);
        }

        const items = await getMyTrips(token);

        if (!mounted) return;

        setTrips((prev) => {
          void notifyTripRealtimeChanges(prev, items);
          return mergeTripsPreserveOrder(prev, items);
        });

        hasLoadedTripsRef.current = true;
      } catch (err) {
        if (!mounted) return;

        console.error("Load my trips failed:", err);

        if (!silent) {
          setSnackbar({
            open: true,
            severity: "error",
            message: err.message || "Không tải được lịch sử chuyến đi.",
          });
        }
      } finally {
        if (!mounted) return;

        if (!silent) {
          setTripLoading(false);
        }
      }
    }

    const handleVisibleRefresh = () => {
      if (document.visibilityState === "visible") {
        loadTrips({ silent: true });
      }
    };

    const handleWindowFocus = () => {
      loadTrips({ silent: true });
    };

    hasLoadedTripsRef.current = false;
    loadTrips();

    const timer = window.setInterval(() => {
      loadTrips({ silent: true });
    }, 10000);

    document.addEventListener("visibilitychange", handleVisibleRefresh);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      mounted = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibleRefresh);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [token]);

  useEffect(() => {
    if (!token || !user?.id) {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io(getSocketBaseUrl(), {
      transports: ["websocket", "polling"],
      withCredentials: true,
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Rider Socket] connected:", socket.id);
      socket.emit("registerRider", { userId: user.id });
    });

    socket.on("disconnect", (reason) => {
      console.log("[Rider Socket] disconnected:", reason);
    });

    socket.on("rider:trip_changed", async (payload) => {
      console.log("[Rider Socket] rider:trip_changed", payload);
      await refreshTripsSilent(token);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [token, user?.id]);

  const joinedDate = useMemo(() => {
    return formatDateTime(user?.createdAt);
  }, [user?.createdAt]);

  if (!loading && !user) {
    return <Navigate to="/dang-nhap" replace />;
  }

  const handleSaveProfile = async () => {
  const nextName = String(displayName || "").trim();

  if (nextName.length < 2) {
    setSnackbar({
      open: true,
      severity: "warning",
      message: "Tên khách hàng phải có ít nhất 2 ký tự.",
    });
    return;
  }

  try {
    setSaving(true);

    const updatedUser = await updateMe(token, {
      displayName: nextName,
    });

    login(token, updatedUser);

    setDisplayName(getCustomerDisplayName(updatedUser));

    setSnackbar({
      open: true,
      severity: "success",
      message: "Đã cập nhật hồ sơ thành công.",
    });
  } catch (err) {
    console.error("Update profile failed:", err);
    setSnackbar({
      open: true,
      severity: "error",
      message: err.message || "Không cập nhật được hồ sơ.",
    });
  } finally {
    setSaving(false);
  }
};

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleOpenFeedbackProfile = () => {
    setFeedbackTrip(null);
    setFeedbackSource("RIDER_PROFILE");
    setFeedbackSubject("");
    setFeedbackMessage("");
    setFeedbackDialogOpen(true);
  };

  const handleOpenFeedbackTrip = (trip) => {
    setFeedbackTrip(trip);
    setFeedbackSource("RIDER_TRIP_HISTORY");
    setFeedbackSubject("");
    setFeedbackMessage("");
    setFeedbackDialogOpen(true);
  };

  const handleCloseFeedbackDialog = () => {
    if (sendingFeedback) return;
    setFeedbackDialogOpen(false);
    setFeedbackTrip(null);
    setFeedbackSource("RIDER_PROFILE");
    setFeedbackSubject("");
    setFeedbackMessage("");
  };

  const handleSendFeedback = async () => {
    const finalSubject = String(feedbackSubject || "").trim();
    const finalMessage = String(feedbackMessage || "").trim();

    if (finalMessage.length < 5) {
      setSnackbar({
        open: true,
        severity: "warning",
        message: "Nội dung góp ý phải có ít nhất 5 ký tự.",
      });
      return;
    }

    try {
      setSendingFeedback(true);

      const payload = {
        source: feedbackSource,
        subject: finalSubject || undefined,
        message: finalMessage,
      };

      if (feedbackSource === "RIDER_TRIP_HISTORY" && feedbackTrip?.id) {
        payload.tripId = feedbackTrip.id;
      }

      const res = await fetch(`${getApiBaseUrl()}/feedbacks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Không thể gửi góp ý.");
      }

      handleCloseFeedbackDialog();

      setSnackbar({
        open: true,
        severity: "success",
        message: "Đã gửi góp ý thành công. Cảm ơn bạn đã đóng góp ý kiến.",
      });
    } catch (err) {
      console.error("Send feedback failed:", err);
      setSnackbar({
        open: true,
        severity: "error",
        message: err.message || "Không thể gửi góp ý.",
      });
    } finally {
      setSendingFeedback(false);
    }
  };

  const handleOpenCancelDialog = (trip) => {
    setSelectedTrip(trip);
    setCancelReason("Đặt nhầm chuyến");
    setCancelReasonOther("");
    setCancelDialogOpen(true);
  };

  const handleCloseCancelDialog = () => {
    if (cancelingTrip) return;
    setCancelDialogOpen(false);
    setSelectedTrip(null);
    setCancelReason("Đặt nhầm chuyến");
    setCancelReasonOther("");
  };

  const handleCancelTrip = async () => {
    if (!selectedTrip?.id || !token) return;

    const finalReason =
      cancelReason === "Lý do khác"
        ? String(cancelReasonOther || "").trim()
        : cancelReason;

    if (!finalReason) {
      setSnackbar({
        open: true,
        severity: "warning",
        message: "Vui lòng chọn hoặc nhập lý do huỷ chuyến.",
      });
      return;
    }

    try {
      setCancelingTrip(true);

      const res = await fetch(
        `${getApiBaseUrl()}/trips/${selectedTrip.id}/cancel-by-rider`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            cancelReason: finalReason,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Không thể huỷ chuyến.");
      }

      setTrips((prev) =>
        prev.map((trip) =>
          trip.id === selectedTrip.id
            ? {
                ...trip,
                ...data.trip,
              }
            : trip,
        ),
      );

      setSnackbar({
        open: true,
        severity: "success",
        message: "Đã huỷ chuyến thành công.",
      });

      handleCloseCancelDialog();
    } catch (err) {
      console.error("Cancel trip failed:", err);
      setSnackbar({
        open: true,
        severity: "error",
        message: err.message || "Không thể huỷ chuyến.",
      });
    } finally {
      setCancelingTrip(false);
    }
  };

  return (
    <Box sx={{ py: { xs: 2, md: 4 }, bgcolor: "#f7f8fa", minHeight: "100%" }}>
      <Container maxWidth="lg">
        <Stack spacing={3}>
          <Box>
            <Typography
              sx={{
                fontSize: { xs: 28, md: 34 },
                fontWeight: 900,
                color: "#111827",
              }}
            >
              Hồ sơ khách hàng
            </Typography>
            <Typography sx={{ mt: 0.5, color: "#6b7280" }}>
              Quản lý thông tin tài khoản và xem lại lịch sử chuyến đi của bạn.
            </Typography>
          </Box>

          <Card
            sx={{
              borderRadius: 3,
              boxShadow: "0 12px 28px rgba(15,23,42,0.08)",
            }}
          >
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Stack
                direction="row"
                spacing={1.2}
                alignItems="center"
                sx={{ mb: 2 }}
              >
                <PersonOutlineIcon />
                <Typography sx={{ fontWeight: 900, fontSize: 20 }}>
                  Thông tin tài khoản
                </Typography>
              </Stack>

              {loading ? (
                <Box sx={{ py: 4, textAlign: "center" }}>
                  <CircularProgress size={28} />
                </Box>
              ) : (
                <Stack spacing={2.5}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField
                      label="Tên khách hàng"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      fullWidth
                    />

                    <TextField
                      label="Số điện thoại"
                      value={formatPhoneForDisplay(user?.phone)}
                      fullWidth
                      InputProps={{ readOnly: true }}
                    />
                  </Stack>

                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField
                      label="Ngày tham gia"
                      value={joinedDate}
                      fullWidth
                      InputProps={{ readOnly: true }}
                    />

                    <TextField
                      label="Vai trò"
                      value="Khách hàng"
                      fullWidth
                      InputProps={{ readOnly: true }}
                    />
                  </Stack>

                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.25}
                    alignItems={{ xs: "stretch", sm: "center" }}
                  >
                    <Button
                      variant="contained"
                      onClick={handleSaveProfile}
                      disabled={saving}
                      sx={{
                        textTransform: "none",
                        borderRadius: 2,
                        fontWeight: 800,
                        minWidth: 160,
                      }}
                    >
                      {saving ? "Đang lưu..." : "Lưu cập nhật"}
                    </Button>

                    <Button
                      variant="outlined"
                      startIcon={<FeedbackOutlinedIcon />}
                      onClick={handleOpenFeedbackProfile}
                      sx={{
                        textTransform: "none",
                        borderRadius: 2,
                        fontWeight: 800,
                        minWidth: 160,
                      }}
                    >
                      Góp ý chung
                    </Button>
                  </Stack>
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card
            sx={{
              borderRadius: 3,
              boxShadow: "0 12px 28px rgba(15,23,42,0.08)",
            }}
          >
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Stack
                direction="row"
                spacing={1.2}
                alignItems="center"
                sx={{ mb: 2 }}
              >
                <HistoryIcon />
                <Typography sx={{ fontWeight: 900, fontSize: 20 }}>
                  Lịch sử chuyến đi
                </Typography>
              </Stack>

              {tripLoading ? (
                <Box sx={{ py: 4, textAlign: "center" }}>
                  <CircularProgress size={28} />
                </Box>
              ) : trips.length === 0 ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    textAlign: "center",
                    bgcolor: "#fafafa",
                  }}
                >
                  <Typography sx={{ fontWeight: 800, mb: 0.5 }}>
                    Bạn chưa có chuyến đi nào
                  </Typography>
                  <Typography sx={{ color: "#6b7280", mb: 2 }}>
                    Khi bạn đặt chuyến bằng tài khoản này, lịch sử sẽ hiển thị ở
                    đây.
                  </Typography>

                  <Button
                    variant="contained"
                    onClick={() => navigate("/dat-xe")}
                    sx={{
                      textTransform: "none",
                      borderRadius: 2,
                      fontWeight: 800,
                    }}
                  >
                    Đặt chuyến ngay
                  </Button>
                </Paper>
              ) : (
                <Stack spacing={2}>
                  {trips.map((trip) => (
                    <Paper
                      key={trip.id}
                      variant="outlined"
                      sx={{
                        p: { xs: 2, md: 2.5 },
                        borderRadius: 3,
                        borderColor: "rgba(15,23,42,0.08)",
                        boxShadow: "0 4px 14px rgba(15,23,42,0.04)",
                      }}
                    >
                      <Stack spacing={2}>
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={1.5}
                          alignItems={{ xs: "flex-start", md: "center" }}
                          justifyContent="space-between"
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              sx={{
                                fontWeight: 900,
                                fontSize: { xs: 16, md: 18 },
                                color: "#111827",
                                wordBreak: "break-word",
                              }}
                            >
                              {trip.id}
                            </Typography>

                            <Typography
                              sx={{
                                mt: 0.5,
                                color: "#6b7280",
                                fontSize: 13,
                              }}
                            >
                              Ngày tạo: {formatDateTime(trip.createdAt)}
                            </Typography>
                          </Box>

                          <Chip
                            label={getStatusLabel(trip.status, trip.isVerified)}
                            color={getStatusColor(trip.status, trip.isVerified)}
                            size="small"
                            sx={{ fontWeight: 700 }}
                          />
                        </Stack>

                        <Divider />

                        <Box>
                          <Typography
                            sx={{
                              color: "#6b7280",
                              fontSize: 13,
                              mb: 0.6,
                              fontWeight: 700,
                            }}
                          >
                            Tuyến đường
                          </Typography>

                          <Typography
                            sx={{
                              fontWeight: 700,
                              color: "#111827",
                              whiteSpace: "normal",
                              wordBreak: "break-word",
                              lineHeight: 1.65,
                              fontSize: { xs: 14, md: 15 },
                            }}
                            title={getRouteText(trip)}
                          >
                            {getRouteText(trip)}
                          </Typography>
                        </Box>

                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: {
                              xs: "1fr",
                              sm: "repeat(2, minmax(0, 1fr))",
                            },
                            gap: 1.5,
                          }}
                        >
                          <Paper
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              borderRadius: 2.5,
                              bgcolor: "#fafafa",
                              minWidth: 0,
                            }}
                          >
                            <Typography
                              sx={{
                                color: "#6b7280",
                                fontSize: 12,
                                mb: 0.4,
                                fontWeight: 700,
                                textTransform: "uppercase",
                              }}
                            >
                              Người đi
                            </Typography>
                            <Typography
                              sx={{
                                fontWeight: 800,
                                color: "#111827",
                                wordBreak: "break-word",
                              }}
                            >
                              {getTripRiderName(trip)}
                            </Typography>
                          </Paper>

                          <Paper
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              borderRadius: 2.5,
                              bgcolor: "#fafafa",
                              minWidth: 0,
                            }}
                          >
                            <Typography
                              sx={{
                                color: "#6b7280",
                                fontSize: 12,
                                mb: 0.4,
                                fontWeight: 700,
                                textTransform: "uppercase",
                              }}
                            >
                              Số điện thoại
                            </Typography>
                            <Typography
                              sx={{
                                fontWeight: 800,
                                color: "#111827",
                                wordBreak: "break-word",
                              }}
                            >
                              {getTripRiderPhone(trip)}
                            </Typography>
                          </Paper>
                        </Box>

                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: {
                              xs: "1fr",
                              sm: "repeat(3, minmax(0, 1fr))",
                            },
                            gap: 1.5,
                          }}
                        >
                          <Paper
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              borderRadius: 2.5,
                              bgcolor: "#fafafa",
                              minWidth: 0,
                            }}
                          >
                            <Typography
                              sx={{
                                color: "#6b7280",
                                fontSize: 12,
                                mb: 0.4,
                                fontWeight: 700,
                                textTransform: "uppercase",
                              }}
                            >
                              Loại chuyến
                            </Typography>
                            <Typography sx={{ fontWeight: 800 }}>
                              {getTripTypeLabel(trip)}
                            </Typography>
                          </Paper>

                          <Paper
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              borderRadius: 2.5,
                              bgcolor: "#fafafa",
                              minWidth: 0,
                            }}
                          >
                            <Typography
                              sx={{
                                color: "#6b7280",
                                fontSize: 12,
                                mb: 0.4,
                                fontWeight: 700,
                                textTransform: "uppercase",
                              }}
                            >
                              Loại xe
                            </Typography>
                            <Typography sx={{ fontWeight: 800 }}>
                              {getCarTypeLabel(trip.carType)}
                            </Typography>
                          </Paper>

                          <Paper
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              borderRadius: 2.5,
                              bgcolor: "#fafafa",
                              minWidth: 0,
                            }}
                          >
                            <Typography
                              sx={{
                                color: "#6b7280",
                                fontSize: 12,
                                mb: 0.4,
                                fontWeight: 700,
                                textTransform: "uppercase",
                              }}
                            >
                              Giá
                            </Typography>
                            <Typography
                              sx={{ fontWeight: 800, color: "#0f766e" }}
                            >
                              {formatPrice(trip.totalPrice)}
                            </Typography>
                          </Paper>
                        </Box>

                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          justifyContent="flex-end"
                          alignItems={{ xs: "stretch", sm: "center" }}
                        >
                          {canCancelTripByRider(trip) ? (
                            <Button
                              color="error"
                              variant="outlined"
                              startIcon={<CancelOutlinedIcon />}
                              onClick={() => handleOpenCancelDialog(trip)}
                              fullWidth={false}
                              sx={{
                                textTransform: "none",
                                borderRadius: 2,
                                fontWeight: 800,
                                width: { xs: "100%", sm: "auto" },
                                minHeight: 42,
                              }}
                            >
                              Huỷ chuyến
                            </Button>
                          ) : null}

                          {canShowFeedbackButton(trip) ? (
                            <Button
                              variant="outlined"
                              startIcon={<FeedbackOutlinedIcon />}
                              onClick={() => handleOpenFeedbackTrip(trip)}
                              fullWidth={false}
                              sx={{
                                textTransform: "none",
                                borderRadius: 2,
                                fontWeight: 800,
                                width: { xs: "100%", sm: "auto" },
                                minHeight: 42,
                              }}
                            >
                              Góp ý
                            </Button>
                          ) : null}
                        </Stack>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Container>

      <Dialog
        open={feedbackDialogOpen}
        onClose={handleCloseFeedbackDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 900 }}>
          {feedbackSource === "RIDER_TRIP_HISTORY"
            ? "Góp ý cho chuyến đi"
            : "Góp ý chung"}
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Cảm ơn bạn đã gửi góp ý. Mọi ý kiến đều giúp GoViet247 hoàn thiện
              hơn từng chút một.
            </Alert>

            {feedbackSource === "RIDER_TRIP_HISTORY" ? (
              <>
                <TextField
                  label="Mã chuyến"
                  value={feedbackTrip?.id || ""}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />

                <TextField
                  label="Tuyến đường"
                  value={getRouteText(feedbackTrip)}
                  fullWidth
                  multiline
                  minRows={3}
                  InputProps={{ readOnly: true }}
                />
              </>
            ) : null}

            <TextField
              label="Tiêu đề"
              value={feedbackSubject}
              onChange={(e) => setFeedbackSubject(e.target.value)}
              fullWidth
              placeholder="Ví dụ: Góp ý giao diện, góp ý trải nghiệm đặt xe..."
            />

            <TextField
              label="Nội dung góp ý"
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              fullWidth
              multiline
              minRows={4}
              placeholder="Vui lòng mô tả góp ý của bạn..."
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={handleCloseFeedbackDialog}
            disabled={sendingFeedback}
          >
            Đóng
          </Button>

          <Button
            variant="contained"
            onClick={handleSendFeedback}
            disabled={sendingFeedback}
          >
            {sendingFeedback ? "Đang gửi..." : "Gửi góp ý"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={cancelDialogOpen}
        onClose={handleCloseCancelDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 900 }}>Huỷ chuyến</DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              Bạn chỉ có thể tự huỷ chuyến khi chuyến đang ở trạng thái{" "}
              <strong>Chờ duyệt</strong>.
            </Alert>

            <TextField
              label="Mã chuyến"
              value={selectedTrip?.id || ""}
              fullWidth
              InputProps={{ readOnly: true }}
            />

            <TextField
              label="Lý do huỷ"
              select
              fullWidth
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            >
              {CANCEL_REASON_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>

            {cancelReason === "Lý do khác" ? (
              <TextField
                label="Nhập lý do khác"
                fullWidth
                multiline
                minRows={3}
                value={cancelReasonOther}
                onChange={(e) => setCancelReasonOther(e.target.value)}
              />
            ) : null}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseCancelDialog} disabled={cancelingTrip}>
            Đóng
          </Button>

          <Button
            color="error"
            variant="contained"
            onClick={handleCancelTrip}
            disabled={cancelingTrip}
          >
            {cancelingTrip ? "Đang huỷ..." : "Xác nhận huỷ chuyến"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3200}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{
          bottom: `${FOOTER_H + 16}px !important`,
        }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
