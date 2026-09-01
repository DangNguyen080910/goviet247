// Path: goviet247/apps/driver-mobile/app/dashboard.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import { io, type Socket } from "socket.io-client";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Linking,
  Image,
  AppState,
  Platform,
  type AppStateStatus,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { API_BASE_URL } from "../constants/api";
import { getMe } from "../services/authApi";
import { getDriverToken, removeDriverToken } from "../services/storage";
import {
  acceptDriverTrip,
  cancelDriverTrip,
  changeDriverTripStatus,
  getAvailableTrips,
  getDriverSupportConfig,
  getMyTrips,
  type AvailableTripItem,
  type MyTripItem,
} from "../services/tripApi";
import { playNewTripNotify, playTripChangedNotify } from "../services/notify";
import { getMyDriverProfile } from "../services/driverProfileApi";
import { useNotifications } from "../context/NotificationContext";
import { showSuccess, showError } from "../services/toast";

type DashboardTab = "AVAILABLE" | "MY_TRIPS";

type DriverMenuKey =
  | "HOME"
  | "PROFILE"
  | "HISTORY"
  | "WALLET"
  | "NOTIFICATIONS"
  | "BOOKING"
  | "RULES"
  | "SUPPORT"
  | "FEEDBACK"
  | "LOGOUT";

const CUSTOMER_BOOKING_URL = "https://goviet247.com/dat-xe";

function formatVietnamesePhone(phone?: string | null) {
  const raw = String(phone || "").trim();

  if (!raw) {
    return "";
  }

  if (raw.startsWith("+84")) {
    return `0${raw.slice(3)}`;
  }

  if (raw.startsWith("84")) {
    return `0${raw.slice(2)}`;
  }

  return raw;
}

function getDriverDisplayName(profile: any) {
  return (
    profile?.fullName?.trim?.() ||
    profile?.displayName?.trim?.() ||
    profile?.phone?.trim?.() ||
    "Tài xế GoViet247"
  );
}

export default function DashboardScreen() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("AVAILABLE");

  const [availableTrips, setAvailableTrips] = useState<AvailableTripItem[]>([]);
  const [myTrips, setMyTrips] = useState<MyTripItem[]>([]);

  const [loadingAvailable, setLoadingAvailable] = useState(true);
  const [loadingMyTrips, setLoadingMyTrips] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingTripId, setAcceptingTripId] = useState<string | null>(null);
  const [changingTripId, setChangingTripId] = useState<string | null>(null);
  const [cancelingTripId, setCancelingTripId] = useState<string | null>(null);
  const [cancelTripId, setCancelTripId] = useState<string | null>(null);
  const [inProgressBlockedTripId, setInProgressBlockedTripId] = useState<
    string | null
  >(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] =
    useState(false);

  const [availableError, setAvailableError] = useState("");
  const [myTripsError, setMyTripsError] = useState("");
  const [supportPhone, setSupportPhone] = useState("0977100917");
  const [brandName, setBrandName] = useState("GoViet247");
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);

  const [driverMenuName, setDriverMenuName] = useState("Tài xế GoViet247");
  const [driverMenuPhone, setDriverMenuPhone] = useState(
    "Chưa có số điện thoại",
  );
  const [driverMenuAvatar, setDriverMenuAvatar] = useState<string | null>(null);

  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());
  const [expandedIncomeTripId, setExpandedIncomeTripId] = useState<
    string | null
  >(null);

  const socketRef = useRef<Socket | null>(null);
  const socketUserIdRef = useRef<string | null>(null);
  const realtimeLoadingRef = useRef(false);
  const runtimeBlockHandledRef = useRef(false);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastNewTripNotifyAtRef = useRef(0);
  const lastNewTripIdRef = useRef<string | null>(null);
  const prevUnreadCountRef = useRef(0);

  const {
    items: notifications,
    unreadCount,
    loading: loadingNotifications,
    refresh: refreshNotifications,
    markAllAsRead,
  } = useNotifications();

  const insets = useSafeAreaInsets();
  const topInset = insets.top;
  const bottomInset = Math.max(insets.bottom, 12);

  const availableCount = useMemo(() => availableTrips.length, [availableTrips]);

  const visibleMyTrips = useMemo(() => {
    return myTrips.filter((trip) =>
      ["ACCEPTED", "CONTACTED", "IN_PROGRESS"].includes(trip.status),
    );
  }, [myTrips]);

  const myTripsCount = useMemo(() => visibleMyTrips.length, [visibleMyTrips]);

  const cancelTrip = useMemo(() => {
    return visibleMyTrips.find((trip) => trip.id === cancelTripId) ?? null;
  }, [cancelTripId, visibleMyTrips]);

  const cancelPenaltyPreview = useMemo(() => {
    if (!cancelTrip) {
      return 0;
    }
    return Number(cancelTrip.requiredWalletAmountSnapshot || 0);
  }, [cancelTrip]);

  const formatMoney = useCallback((value?: number | null) => {
    const amount = Number(value ?? 0);
    return `${amount.toLocaleString("vi-VN")}đ`;
  }, []);

  const formatDateTime = useCallback((iso?: string | null) => {
    if (!iso) {
      return "--";
    }

    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
      return "--";
    }

    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const mmMonth = String(date.getMonth() + 1).padStart(2, "0");
    const yy = String(date.getFullYear()).slice(-2);

    return `${hh}:${mm} ${dd}/${mmMonth}/${yy}`;
  }, []);

  const getCarTypeLabel = useCallback((carType?: string) => {
    switch (carType) {
      case "CAR_5":
        return "5 chỗ";
      case "CAR_7":
        return "7 chỗ";
      case "CAR_16":
        return "16 chỗ";
      default:
        return "Xe";
    }
  }, []);

  const getDirectionLabel = useCallback((direction?: string) => {
    switch (direction) {
      case "ROUND_TRIP":
        return "khứ hồi";
      case "ONE_WAY":
      default:
        return "1 chiều";
    }
  }, []);

  const getFuelPreferenceLabel = useCallback((fuelPreference?: string) => {
    switch (fuelPreference) {
      case "ELECTRIC":
        return "Xe điện";
      case "GASOLINE":
        return "Xe xăng";
      case "ANY":
      default:
        return "Không yêu cầu";
    }
  }, []);

  const getTripTitle = useCallback(
    (trip: AvailableTripItem | MyTripItem) => {
      return `Bao chuyến ${getCarTypeLabel(trip.carType)} (${getDirectionLabel(
        trip.direction,
      )})`;
    },
    [getCarTypeLabel, getDirectionLabel],
  );

  const getStatusLabel = useCallback((status?: string) => {
    switch (status) {
      case "ACCEPTED":
        return "Đã nhận";
      case "CONTACTED":
        return "Đã liên hệ khách";
      case "IN_PROGRESS":
        return "Đang trên hành trình";
      case "COMPLETED":
        return "Đã hoàn thành";
      case "CANCELLED":
        return "Đã huỷ";
      case "PENDING":
      default:
        return "Chờ nhận";
    }
  }, []);

  const getTripIncomeBreakdown = useCallback((trip: MyTripItem) => {
    const totalPrice = Number(trip.totalPrice ?? 0);
    const commissionAmount = Number(trip.commissionAmountSnapshot ?? 0);
    const driverVatAmount = Number(trip.driverVatAmountSnapshot ?? 0);
    const driverPitAmount = Number(trip.driverPitAmountSnapshot ?? 0);
    const driverTaxTotal = Number(
      trip.driverTaxTotalSnapshot ?? driverVatAmount + driverPitAmount,
    );
    const requiredWalletAmount = Number(
      trip.requiredWalletAmountSnapshot ?? commissionAmount + driverTaxTotal,
    );
    const driverReceive = Number(
      trip.driverReceiveSnapshot ??
        Math.max(0, totalPrice - requiredWalletAmount),
    );

    return {
      totalPrice,
      commissionAmount,
      driverVatAmount,
      driverPitAmount,
      driverTaxTotal,
      requiredWalletAmount,
      driverReceive,
    };
  }, []);

  const normalizeImageUrl = useCallback((fileUrl?: string | null) => {
    const raw = String(fileUrl || "").trim();

    if (!raw) {
      return null;
    }

    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return raw;
    }

    if (raw.startsWith("/")) {
      return `${API_BASE_URL}${raw}`;
    }

    return `${API_BASE_URL}/${raw}`;
  }, []);

  const getAcceptLockRemainingSeconds = useCallback(
    (trip: AvailableTripItem) => {
      if (!trip.driverAcceptOpenAt) {
        return 0;
      }

      const openAt = new Date(trip.driverAcceptOpenAt).getTime();
      const remainingMs = openAt - currentTimeMs;

      if (remainingMs <= 0) {
        return 0;
      }

      return Math.ceil(remainingMs / 1000);
    },
    [currentTimeMs],
  );

  const loadDriverMenuProfile = useCallback(async () => {
    try {
      const token = await getDriverToken();

      if (!token) {
        return;
      }

      const data = await getMyDriverProfile(token);
      const profile = data?.profile;

      const documents = Array.isArray(profile?.documents)
        ? profile.documents
        : [];

      const portraitDoc = documents.find((doc: any) => {
        const docType = String(
          doc?.type || doc?.documentType || doc?.docType || "",
        ).toUpperCase();

        return docType === "PORTRAIT";
      });

      const portraitAny = portraitDoc as any;

      const portraitUrl =
        portraitAny?.viewUrl ||
        portraitAny?.signedUrl ||
        portraitAny?.fileUrl ||
        portraitAny?.file_url ||
        portraitAny?.url ||
        portraitAny?.publicUrl ||
        portraitAny?.s3Url ||
        null;

      setDriverMenuName(getDriverDisplayName(profile));
      setDriverMenuPhone(
        formatVietnamesePhone(profile?.phone) || "Chưa có số điện thoại",
      );
      setDriverMenuAvatar(normalizeImageUrl(portraitUrl));
    } catch {
      setDriverMenuName("Tài xế GoViet247");
      setDriverMenuPhone("Chưa có số điện thoại");
      setDriverMenuAvatar(null);
    }
  }, [normalizeImageUrl]);

  const loadSupportConfig = useCallback(async () => {
    try {
      const base = String(API_BASE_URL || "").replace(/\/+$/, "");
      const url = base.endsWith("/api")
        ? `${base}/public/system-config`
        : `${base}/api/public/system-config`;

      const res = await fetch(url);
      const json = await res.json().catch(() => ({}));

      const data = json?.data || {};

      // 🔥 support phone (giữ logic cũ)
      if (data?.supportPhoneDriver) {
        setSupportPhone(data.supportPhoneDriver);
      }

      // 🔥 branding
      if (data?.brandName) {
        setBrandName(data.brandName);
      }

      if (data?.brandLogoUrl) {
        setBrandLogoUrl(data.brandLogoUrl);
      }
    } catch (err) {
      console.warn("loadSupportConfig error:", err);
    }
  }, []);

  const forceLogoutWithBlockedStatus = useCallback(
    async (status?: string | null, reason?: string | null) => {
      if (runtimeBlockHandledRef.current) {
        return;
      }

      runtimeBlockHandledRef.current = true;

      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      await removeDriverToken();

      const normalizedStatus = String(status || "").toUpperCase();

      let title = "Thông báo";
      let message =
        "Tài khoản của bạn hiện không thể tiếp tục sử dụng ứng dụng.";

      if (normalizedStatus === "REJECTED") {
        title = "Hồ sơ bị từ chối";
        message =
          reason?.trim() ||
          "Hồ sơ tài xế của bạn đã bị từ chối. Vui lòng liên hệ hỗ trợ để biết thêm chi tiết.";
      }

      if (normalizedStatus === "SUSPENDED") {
        title = "Tài khoản bị tạm khóa";
        message =
          reason?.trim() ||
          "Tài khoản tài xế của bạn đang bị tạm khóa. Vui lòng liên hệ hỗ trợ để biết thêm chi tiết.";
      }

      // Web: dùng window.alert rồi replace ngay cho chắc
      if (Platform.OS === "web") {
        window.alert(`${title}\n\n${message}`);
        router.replace("/");
        return;
      }

      // Native: giữ Alert chuẩn
      Alert.alert(title, message, [
        {
          text: "OK",
          onPress: () => {
            router.replace("/");
          },
        },
      ]);
    },
    [],
  );

  const enforceDriverAccessGuard = useCallback(async () => {
    const token = await getDriverToken();

    if (!token) {
      router.replace("/");
      return false;
    }

    try {
      const data = await getMyDriverProfile(token);

      if (!data?.hasDriverProfile) {
        await removeDriverToken();
        router.replace("/driver-profile/create");
        return false;
      }

      const profile = data?.profile;
      const status = String(profile?.status || "").toUpperCase();

      if (status === "REJECTED") {
        await forceLogoutWithBlockedStatus(
          status,
          profile?.rejectReason || "Hồ sơ tài xế của bạn đã bị từ chối.",
        );
        return false;
      }

      if (status === "SUSPENDED") {
        await forceLogoutWithBlockedStatus(
          status,
          profile?.suspendReason ||
            "Tài khoản tài xế của bạn đang bị tạm khóa.",
        );
        return false;
      }

      return true;
    } catch (error: any) {
      const message = String(error?.message || "").toLowerCase();

      // Token hỏng / hết hạn / 401 / 403 thì đá ra luôn
      if (
        message.includes("token") ||
        message.includes("401") ||
        message.includes("403") ||
        message.includes("không xác định") ||
        message.includes("không lấy được")
      ) {
        await removeDriverToken();
        router.replace("/");
        return false;
      }

      throw error;
    }
  }, [forceLogoutWithBlockedStatus]);

  const loadAvailableTrips = useCallback(async () => {
    try {
      setAvailableError("");
      const items = await getAvailableTrips();
      setAvailableTrips(items);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Không thể tải danh sách chuyến.";
      setAvailableError(message);
    } finally {
      setLoadingAvailable(false);
    }
  }, []);

  const loadMyTrips = useCallback(async () => {
    try {
      setMyTripsError("");
      const items = await getMyTrips({ scope: "active" });
      setMyTrips(items);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không thể tải đơn của tôi.";
      setMyTripsError(message);
    } finally {
      setLoadingMyTrips(false);
    }
  }, []);

  const loadDashboardData = useCallback(async () => {
    const canContinue = await enforceDriverAccessGuard();

    if (!canContinue) {
      return;
    }

    await Promise.all([
      loadAvailableTrips(),
      loadMyTrips(),
      loadSupportConfig(),
      loadDriverMenuProfile(),
      refreshNotifications(),
    ]);
  }, [
    enforceDriverAccessGuard,
    loadAvailableTrips,
    loadMyTrips,
    loadSupportConfig,
    loadDriverMenuProfile,
    refreshNotifications,
  ]);

  const reloadTripsFromRealtime = useCallback(async () => {
    if (realtimeLoadingRef.current) {
      return;
    }

    try {
      realtimeLoadingRef.current = true;
      await Promise.all([loadAvailableTrips(), loadMyTrips()]);
    } finally {
      realtimeLoadingRef.current = false;
    }
  }, [loadAvailableTrips, loadMyTrips]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        const prevState = appStateRef.current;
        appStateRef.current = nextState;

        console.log("[DriverAppState] change:", prevState, "->", nextState);

        if (nextState === "active") {
          console.log(
            "[DriverAppState] app active, socket connected =",
            socketRef.current?.connected ?? false,
          );

          if (socketRef.current) {
            if (socketRef.current.connected) {
              if (socketUserIdRef.current) {
                console.log(
                  "[DriverAppState] socket already connected, registerDriver again:",
                  socketUserIdRef.current,
                );
                socketRef.current.emit("registerDriver", {
                  userId: socketUserIdRef.current,
                });
              }
            } else {
              console.log(
                "[DriverAppState] socket disconnected, reconnect now",
              );
              socketRef.current.connect();
            }
          } else {
            console.log("[DriverAppState] socket not ready yet");
          }

          void loadDashboardData();
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [loadDashboardData]);

  useEffect(() => {
    const prevUnread = prevUnreadCountRef.current;
    const hasNewUnread = unreadCount > prevUnread;

    if (
      hasNewUnread &&
      appStateRef.current === "active" &&
      !notificationModalVisible
    ) {
      void playTripChangedNotify();
    }

    prevUnreadCountRef.current = unreadCount;
  }, [notificationModalVisible, unreadCount]);

  useEffect(() => {
    let mounted = true;
    let socket: Socket | null = null;

    async function setupRealtime() {
      try {
        const token = await getDriverToken();

        if (!token || !mounted) {
          console.log("[DriverSocket] skip setup: missing token or unmounted");
          return;
        }

        const meData = await getMe(token);
        const userId = meData?.user?.id;

        if (!userId || !mounted) {
          console.log("[DriverSocket] skip setup: missing userId or unmounted");
          return;
        }

        socketUserIdRef.current = userId;

        console.log("[DriverSocket] setup with API_BASE_URL =", API_BASE_URL);
        console.log("[DriverSocket] setup with userId =", userId);

        socket = io(API_BASE_URL, {
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000,
          transports: ["websocket", "polling"],
        });

        socketRef.current = socket;

        socket.on("connect", () => {
          console.log("[DriverSocket] connected:", socket?.id);
          console.log(
            "[DriverSocket] emit registerDriver with userId =",
            userId,
          );
          socket?.emit("registerDriver", { userId });
        });

        socket.on("disconnect", (reason) => {
          console.log("[DriverSocket] disconnected:", reason);
        });

        socket.on("connect_error", (error) => {
          console.log("[DriverSocket] connect_error:", error?.message || error);
        });

        socket.io.on("reconnect_attempt", (attempt) => {
          console.log("[DriverSocket] reconnect_attempt:", attempt);
        });

        socket.io.on("reconnect", (attempt) => {
          console.log("[DriverSocket] reconnected after attempt:", attempt);
          console.log(
            "[DriverSocket] emit registerDriver again after reconnect, userId =",
            userId,
          );
          socket?.emit("registerDriver", { userId });
        });

        socket.io.on("reconnect_error", (error) => {
          console.log(
            "[DriverSocket] reconnect_error:",
            error?.message || error,
          );
        });

        socket.io.on("reconnect_failed", () => {
          console.log("[DriverSocket] reconnect_failed");
        });

        socket.on("trip:new", async (payload) => {
          console.log("[DriverSocket] trip:new", payload);

          const incomingTripId = String(
            payload?.tripId || payload?.id || payload?.data?.tripId || "",
          ).trim();
          const now = Date.now();

          const isDuplicateById =
            !!incomingTripId && lastNewTripIdRef.current === incomingTripId;

          const isDuplicateByTime = now - lastNewTripNotifyAtRef.current < 2500;

          if (!isDuplicateById && !isDuplicateByTime) {
            lastNewTripIdRef.current = incomingTripId || null;
            lastNewTripNotifyAtRef.current = now;

            if (appStateRef.current === "active") {
              await playNewTripNotify();
            }
          }

          await reloadTripsFromRealtime();
        });

        socket.on("trip:changed", async (payload) => {
          console.log("[DriverSocket] trip:changed", payload);

          if (appStateRef.current === "active") {
            await playTripChangedNotify();
          }

          await reloadTripsFromRealtime();
        });

        socket.on("admin:dashboard_changed", async (payload) => {
          console.log("[DriverSocket] admin:dashboard_changed", payload);
        });

        socket.on("driver:notification_changed", async (payload) => {
          console.log("[DriverSocket] driver:notification_changed", payload);
          await refreshNotifications();
        });
      } catch (error) {
        console.error("[DriverSocket] setup error:", error);
      }
    }

    setupRealtime();

    return () => {
      mounted = false;

      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      socketUserIdRef.current = null;
    };
  }, [reloadTripsFromRealtime, refreshNotifications]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);

      const canContinue = await enforceDriverAccessGuard();

      if (!canContinue) {
        return;
      }

      await loadDashboardData();
    } finally {
      setRefreshing(false);
    }
  }, [enforceDriverAccessGuard, loadDashboardData]);

  const handleCloseMenu = useCallback(() => {
    setMenuVisible(false);
  }, []);

  const handleOpenMenu = useCallback(() => {
    setMenuVisible(true);
  }, []);

  const handleOpenNotifications = useCallback(async () => {
    setNotificationModalVisible(true);

    if (unreadCount > 0) {
      try {
        await markAllAsRead();
      } catch (error: any) {
        console.error("mark notifications as read error", error);
      }
    }
  }, [markAllAsRead, unreadCount]);

  const handleCloseNotifications = useCallback(() => {
    setNotificationModalVisible(false);
  }, []);

  const handleLogout = async () => {
    handleCloseMenu();

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    await removeDriverToken();
    router.replace("/");
  };

  const handleOpenCustomerBooking = useCallback(async () => {
    try {
      const supported = await Linking.canOpenURL(CUSTOMER_BOOKING_URL);

      if (!supported) {
        Alert.alert(
          "Không thể mở trang đặt xe",
          "Thiết bị hiện không mở được đường dẫn đặt xe.",
        );
        return;
      }

      await Linking.openURL(CUSTOMER_BOOKING_URL);
    } catch {
      Alert.alert(
        "Không thể mở trang đặt xe",
        "Có lỗi xảy ra khi mở trang đặt xe.",
      );
    }
  }, []);

  const handleMenuPress = useCallback(
    async (key: DriverMenuKey) => {
      handleCloseMenu();

      switch (key) {
        case "HOME":
          setActiveTab("AVAILABLE");
          return;

        case "PROFILE":
          try {
            const token = await getDriverToken();

            if (!token) {
              throw new Error("Phiên đăng nhập đã hết hạn.");
            }

            const data = await getMyDriverProfile(token);

            if (!data?.hasDriverProfile) {
              router.push("/driver-profile/create");
              return;
            }

            const status = data.profile?.status;

            if (status === "PENDING") {
              router.push("/driver-profile/pending");
              return;
            }

            if (status === "REJECTED") {
              router.push("/driver-profile/rejected");
              return;
            }

            if (status === "SUSPENDED") {
              router.push("/driver-profile/suspended");
              return;
            }

            if (status === "VERIFIED") {
              router.push("/driver-profile");
              return;
            }

            router.push("/driver-profile/create");
          } catch (error: any) {
            Alert.alert(
              "Không mở được hồ sơ",
              error?.message || "Không thể tải hồ sơ tài xế.",
            );
          }
          return;

        case "HISTORY":
          router.push("/trip-history");
          return;

        case "WALLET":
          router.push("/wallet");
          return;

        case "NOTIFICATIONS":
          await handleOpenNotifications();
          return;

        case "BOOKING":
          await handleOpenCustomerBooking();
          return;

        case "RULES":
          router.push("/rules");
          return;

        case "SUPPORT":
          router.push("/support");
          return;

        case "FEEDBACK":
          router.push("/feedback");
          return;

        case "LOGOUT":
          await handleLogout();
          return;

        default:
          return;
      }
    },
    [
      handleCloseMenu,
      handleLogout,
      handleOpenCustomerBooking,
      handleOpenNotifications,
    ],
  );

  const handleAcceptTrip = useCallback(
    async (tripId: string) => {
      const trip = availableTrips.find((t) => t.id === tripId);
      const remainingSeconds = trip ? getAcceptLockRemainingSeconds(trip) : 0;

      if (remainingSeconds > 0) {
        return;
      }

      try {
        setAcceptingTripId(tripId);
        await acceptDriverTrip(tripId);

        await Promise.all([loadAvailableTrips(), loadMyTrips()]);
        setActiveTab("MY_TRIPS");

        showSuccess("Nhận chuyến thành công.");
      } catch (error: any) {
        const message =
          error instanceof Error ? error.message : "Không thể nhận chuyến.";

        showError(message);
      } finally {
        setAcceptingTripId(null);
      }
    },
    [
      availableTrips,
      getAcceptLockRemainingSeconds,
      loadAvailableTrips,
      loadMyTrips,
    ],
  );

  const handleMarkContacted = useCallback(
    async (tripId: string) => {
      try {
        setChangingTripId(tripId);
        await changeDriverTripStatus(tripId, "CONTACTED");

        await Promise.all([loadAvailableTrips(), loadMyTrips()]);

        showSuccess("Đã cập nhật trạng thái: Đã liên hệ khách.");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Không thể cập nhật trạng thái chuyến.";

        showError(message);
      } finally {
        setChangingTripId(null);
      }
    },
    [loadAvailableTrips, loadMyTrips],
  );

  const handlePressCancel = useCallback((trip: MyTripItem) => {
    if (trip.status === "IN_PROGRESS") {
      setInProgressBlockedTripId(trip.id);
      return;
    }

    setCancelTripId(trip.id);
  }, []);

  const handleConfirmCancel = useCallback(async () => {
    if (!cancelTripId) {
      return;
    }

    try {
      setCancelingTripId(cancelTripId);
      await cancelDriverTrip(cancelTripId);

      setCancelTripId(null);

      await Promise.all([loadAvailableTrips(), loadMyTrips()]);

      showSuccess("Đã huỷ chuyến");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không thể huỷ chuyến.";

      showError(message);
    } finally {
      setCancelingTripId(null);
    }
  }, [cancelTripId, loadAvailableTrips, loadMyTrips]);

  const renderTripStops = useCallback(
    (
      trip: AvailableTripItem | MyTripItem,
      mode: "masked" | "full" = "full",
    ) => {
      const stops = Array.isArray(trip?.stops) ? trip.stops : [];

      if (!stops.length) {
        return null;
      }

      return stops.map((stop, index) => (
        <View
          key={stop.id || `${trip.id}-stop-${index}`}
          style={styles.infoRow}
        >
          <Text style={styles.infoIcon}>🛑</Text>
          <Text style={styles.infoText}>
            Điểm dừng {index + 1}:{" "}
            {mode === "masked"
              ? stop.addressMasked || stop.address || ""
              : stop.address || stop.addressMasked || ""}
          </Text>
        </View>
      ));
    },
    [],
  );

  const getTripRouteDisplay = useCallback(
    (
      trip: AvailableTripItem | MyTripItem,
      mode: "masked" | "full" = "full",
    ) => {
      const allStops = Array.isArray(trip?.stops) ? trip.stops : [];
      const isRoundTrip = trip?.direction === "ROUND_TRIP";

      const getAddress = (value?: {
        address?: string | null;
        addressMasked?: string | null;
      }) => {
        if (mode === "masked") {
          return value?.addressMasked || value?.address || "";
        }

        return value?.address || value?.addressMasked || "";
      };

      const dropoffAddress =
        mode === "masked"
          ? trip.dropoffAddressMasked || trip.dropoffAddress || ""
          : trip.dropoffAddress || trip.dropoffAddressMasked || "";

      // Rule production:
      // - Không dùng "Điểm dừng"
      // - Không dùng "Điểm về"
      // - Tất cả điểm sau điểm đón đều gọi là "Điểm đến"
      // - Khứ hồi chỉ hiển thị hành trình đi, không cần render điểm quay về
      if (isRoundTrip) {
        return {
          destinations: allStops.map((stop, index) => ({
            key: stop.id || `${trip.id}-destination-${index}`,
            label: allStops.length === 1 ? "Điểm đến" : `Điểm đến ${index + 1}`,
            address: getAddress(stop),
          })),
        };
      }

      // 1 chiều, nếu không có stops thì fallback về dropoffAddress
      if (allStops.length === 0) {
        return {
          destinations: dropoffAddress
            ? [
                {
                  key: `${trip.id}-destination-final`,
                  label: "Điểm đến",
                  address: dropoffAddress,
                },
              ]
            : [],
        };
      }

      return {
        destinations: allStops.map((stop, index) => ({
          key: stop.id || `${trip.id}-destination-${index}`,
          label: allStops.length === 1 ? "Điểm đến" : `Điểm đến ${index + 1}`,
          address: getAddress(stop),
        })),
      };
    },
    [],
  );

  const renderAvailableContent = () => {
    if (loadingAvailable) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#F97316" />
          <Text style={styles.loadingText}>Đang tải danh sách chuyến...</Text>
        </View>
      );
    }

    if (availableError) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Không thể tải dữ liệu</Text>
          <Text style={styles.emptyText}>{availableError}</Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadAvailableTrips}
            activeOpacity={0.85}
          >
            <Text style={styles.retryButtonText}>Tải lại</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (availableTrips.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Chưa có chuyến nào</Text>
          <Text style={styles.emptyText}>
            Khi có chuyến đã duyệt và chưa có tài xế, danh sách sẽ hiển thị tại
            đây.
          </Text>
        </View>
      );
    }

    return availableTrips.map((trip) => {
      const isAccepting = acceptingTripId === trip.id;
      const remainingSeconds = getAcceptLockRemainingSeconds(trip);
      const isLocked = remainingSeconds > 0;
      const isDisabled = isAccepting || isLocked;
      const routeDisplay = getTripRouteDisplay(trip, "masked");

      return (
        <View key={trip.id} style={styles.tripCard}>
          <View style={styles.tripTopRow}>
            <Text style={styles.tripIdBadge}>#{trip.id.slice(-8)}</Text>
            <Text style={styles.tripTime}>
              {formatDateTime(trip.pickupTime)}
            </Text>
          </View>

          <Text style={styles.tripTitle}>{getTripTitle(trip)}</Text>

          <View style={styles.fuelBadge}>
            <Text style={styles.fuelBadgeText}>
              Nhiên liệu: {getFuelPreferenceLabel(trip.fuelPreference)}
            </Text>
          </View>

          <View style={styles.priceRow}>
            <View style={styles.priceBlock}>
              <Text style={styles.priceLabel}>Giá chuyến</Text>
              <Text style={styles.priceSubLabel}>(tiền thu khách)</Text>
              <Text style={styles.customerPrice}>
                {formatMoney(trip.totalPrice)}
              </Text>
            </View>

            <View style={styles.priceBlockRight}>
              <Text style={styles.priceLabel}>Thu nhập ròng</Text>
              <Text style={styles.driverIncome}>
                {formatMoney(trip.driverReceive)}
              </Text>

              {/* <Text style={styles.requiredWalletHint}>
                Số dư tối thiểu để nhận chuyến:{" "}
                {formatMoney(trip.requiredWalletAmount)}
              </Text> */}
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={styles.infoText}>
              Điểm đón: {trip.pickupAddressMasked || trip.pickupAddress}
            </Text>
          </View>

          {routeDisplay.destinations.map((destination) => (
            <View key={destination.key} style={styles.infoRow}>
              <Text style={styles.infoIcon}>▸</Text>
              <Text style={styles.infoText}>
                {destination.label}: {destination.address}
              </Text>
            </View>
          ))}

          <View style={styles.metaGroup}>
            <Text style={styles.metaText}>
              Ngày giờ đón khách: {formatDateTime(trip.pickupTime)}
            </Text>

            {trip.direction === "ROUND_TRIP" && !!trip.returnTime && (
              <Text style={styles.metaText}>
                Ngày giờ quay về: {formatDateTime(trip.returnTime)}
              </Text>
            )}
          </View>

          <View style={styles.cardFooter}>
            {isLocked ? (
              <Text style={styles.acceptLockHint}>
                Mở nhận chuyến sau {remainingSeconds}s
              </Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.acceptButton,
                isDisabled && styles.acceptButtonDisabled,
                isLocked && styles.acceptButtonLocked,
              ]}
              onPress={() => handleAcceptTrip(trip.id)}
              activeOpacity={0.85}
              disabled={isDisabled}
            >
              <Text style={styles.acceptButtonText}>
                {isAccepting
                  ? "Đang nhận..."
                  : isLocked
                    ? `Nhận sau ${remainingSeconds}s`
                    : "Nhận chuyến"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    });
  };

  const renderStatusNotice = (trip: MyTripItem) => {
    if (trip.status === "ACCEPTED") {
      return (
        <View style={[styles.noticeBox, styles.noticeWarningBox]}>
          <Text style={[styles.noticeText, styles.noticeWarningText]}>
            ⚠️ Vui lòng liên hệ khách trong 5 phút để xác nhận chuyến.
          </Text>
        </View>
      );
    }

    if (trip.status === "CONTACTED") {
      return (
        <View style={[styles.noticeBox, styles.noticeInfoBox]}>
          <Text style={[styles.noticeText, styles.noticeInfoText]}>
            ℹ️ Vui lòng xin phép khách chụp hình như nội quy công ty và gửi định
            vị cho admin qua Zalo số điện thoại: {supportPhone} khi đón khách.
          </Text>
        </View>
      );
    }

    if (trip.status === "IN_PROGRESS") {
      return (
        <View style={[styles.noticeBox, styles.noticeInfoBox]}>
          <Text style={[styles.noticeText, styles.noticeInfoText]}>
            ℹ️ Vui lòng xin phép khách chụp hình như nội quy công ty và gửi định
            vị cho admin qua Zalo số điện thoại: {supportPhone} khi trả khách.
          </Text>
        </View>
      );
    }

    return null;
  };

  const renderMyTripsContent = () => {
    if (loadingMyTrips) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#F97316" />
          <Text style={styles.loadingText}>Đang tải đơn của tôi...</Text>
        </View>
      );
    }

    if (myTripsError) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Không thể tải dữ liệu</Text>
          <Text style={styles.emptyText}>{myTripsError}</Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadMyTrips}
            activeOpacity={0.85}
          >
            <Text style={styles.retryButtonText}>Tải lại</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (visibleMyTrips.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Chưa có đơn nào</Text>
          <Text style={styles.emptyText}>
            Khi tài xế nhận chuyến, danh sách sẽ hiển thị tại đây.
          </Text>
        </View>
      );
    }

    return visibleMyTrips.map((trip) => {
      const isChanging = changingTripId === trip.id;
      const isCanceling = cancelingTripId === trip.id;
      const isExpandedIncome = expandedIncomeTripId === trip.id;
      const income = getTripIncomeBreakdown(trip);
      const routeDisplay = getTripRouteDisplay(trip, "full");

      return (
        <View key={trip.id} style={styles.tripCard}>
          <View style={styles.tripTopRow}>
            <Text style={styles.tripIdBadge}>#{trip.id.slice(-8)}</Text>
            <Text style={styles.tripTime}>
              {formatDateTime(trip.pickupTime)}
            </Text>
          </View>

          <Text style={styles.tripTitle}>{getTripTitle(trip)}</Text>

          <View style={styles.fuelBadge}>
            <Text style={styles.fuelBadgeText}>
              Nhiên liệu: {getFuelPreferenceLabel(trip.fuelPreference)}
            </Text>
          </View>

          {renderStatusNotice(trip)}

          <View style={styles.priceRow}>
            <View style={styles.priceBlock}>
              <Text style={styles.priceLabel}>Giá chuyến</Text>
              <Text style={styles.priceSubLabel}>(tiền thu khách)</Text>
              <Text style={styles.customerPrice}>
                {formatMoney(income.totalPrice)}
              </Text>
            </View>

            <View style={styles.priceBlockRight}>
              <Text style={styles.priceLabel}>Thu nhập ròng</Text>
              <Text style={styles.driverIncome}>
                {formatMoney(income.driverReceive)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.incomeToggleButton}
            activeOpacity={0.85}
            onPress={() =>
              setExpandedIncomeTripId((prev) =>
                prev === trip.id ? null : trip.id,
              )
            }
          >
            <Text style={styles.incomeToggleButtonText}>
              {isExpandedIncome
                ? "Ẩn chi tiết thu nhập"
                : "Xem chi tiết thu nhập"}
            </Text>
          </TouchableOpacity>

          {isExpandedIncome ? (
            <View style={styles.incomeBreakdownCard}>
              <View style={styles.incomeBreakdownRow}>
                <Text style={styles.incomeBreakdownLabel}>Giá chuyến</Text>
                <Text style={styles.incomeBreakdownValue}>
                  {formatMoney(income.totalPrice)}
                </Text>
              </View>

              <View style={styles.incomeBreakdownRow}>
                <Text style={styles.incomeBreakdownLabel}>
                  Hoa hồng nền tảng
                </Text>
                <Text style={styles.incomeBreakdownValue}>
                  -{formatMoney(income.commissionAmount)}
                </Text>
              </View>

              <View style={styles.incomeBreakdownRow}>
                <Text style={styles.incomeBreakdownLabel}>Thuế VAT tài xế</Text>
                <Text style={styles.incomeBreakdownValue}>
                  -{formatMoney(income.driverVatAmount)}
                </Text>
              </View>

              <View style={styles.incomeBreakdownRow}>
                <Text style={styles.incomeBreakdownLabel}>
                  Thuế TNCN tài xế
                </Text>
                <Text style={styles.incomeBreakdownValue}>
                  -{formatMoney(income.driverPitAmount)}
                </Text>
              </View>

              <View style={styles.incomeBreakdownDivider} />

              <View style={styles.incomeBreakdownRow}>
                <Text style={styles.incomeBreakdownLabelStrong}>
                  Tổng khấu trừ từ ví
                </Text>
                <Text style={styles.incomeBreakdownValueStrong}>
                  -{formatMoney(income.requiredWalletAmount)}
                </Text>
              </View>

              <View style={styles.incomeBreakdownRow}>
                <Text style={styles.incomeBreakdownLabelStrong}>
                  Thu nhập ròng
                </Text>
                <Text style={styles.incomeBreakdownNetValue}>
                  {formatMoney(income.driverReceive)}
                </Text>
              </View>
            </View>
          ) : null}

          {!!trip.riderName && (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>👤</Text>
              <Text style={styles.infoText}>{trip.riderName}</Text>
            </View>
          )}

          {!!trip.riderPhone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📞</Text>
              <Text style={styles.infoText}>
                {formatVietnamesePhone(trip.riderPhone)}
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={styles.infoText}>Điểm đón: {trip.pickupAddress}</Text>
          </View>

          {routeDisplay.destinations.map((destination) => (
            <View key={destination.key} style={styles.infoRow}>
              <Text style={styles.infoIcon}>▸</Text>
              <Text style={styles.infoText}>
                {destination.label}: {destination.address}
              </Text>
            </View>
          ))}

          {!!trip.note && (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📝</Text>
              <Text style={styles.infoText}>{trip.note}</Text>
            </View>
          )}

          <View style={styles.metaGroup}>
            <View style={styles.tripStatusRow}>
              <Text style={styles.metaText}>Trạng thái:</Text>

              <View
                style={[
                  styles.tripStatusBadge,
                  trip.status === "ACCEPTED" && styles.tripStatusBadgeAccepted,
                  trip.status === "CONTACTED" &&
                    styles.tripStatusBadgeContacted,
                  trip.status === "IN_PROGRESS" &&
                    styles.tripStatusBadgeInProgress,
                  trip.status === "COMPLETED" &&
                    styles.tripStatusBadgeCompleted,
                  trip.status === "CANCELLED" &&
                    styles.tripStatusBadgeCancelled,
                ]}
              >
                <Text
                  style={[
                    styles.tripStatusBadgeText,
                    trip.status === "ACCEPTED" &&
                      styles.tripStatusBadgeTextAccepted,
                    trip.status === "CONTACTED" &&
                      styles.tripStatusBadgeTextContacted,
                    trip.status === "IN_PROGRESS" &&
                      styles.tripStatusBadgeTextInProgress,
                    trip.status === "COMPLETED" &&
                      styles.tripStatusBadgeTextCompleted,
                    trip.status === "CANCELLED" &&
                      styles.tripStatusBadgeTextCancelled,
                  ]}
                >
                  {getStatusLabel(trip.status)}
                </Text>
              </View>
            </View>

            <Text style={styles.metaText}>
              Ngày giờ đón khách: {formatDateTime(trip.pickupTime)}
            </Text>

            {trip.direction === "ROUND_TRIP" && !!trip.returnTime && (
              <Text style={styles.metaText}>
                Ngày giờ quay về: {formatDateTime(trip.returnTime)}
              </Text>
            )}

            {!!trip.acceptedAt && (
              <Text style={styles.metaText}>
                Nhận chuyến lúc: {formatDateTime(trip.acceptedAt)}
              </Text>
            )}
          </View>

          <View
            style={[
              styles.cardFooterRow,
              trip.status !== "ACCEPTED" && styles.cardFooterRowRightOnly,
            ]}
          >
            {trip.status === "ACCEPTED" ? (
              <TouchableOpacity
                style={[
                  styles.leftActionButton,
                  (isChanging || isCanceling) && styles.acceptButtonDisabled,
                ]}
                onPress={() => handleMarkContacted(trip.id)}
                activeOpacity={0.85}
                disabled={isChanging || isCanceling}
              >
                <Text style={styles.acceptButtonText}>
                  {isChanging ? "Đang cập nhật..." : "Đã liên hệ khách"}
                </Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}

            <TouchableOpacity
              style={[
                styles.cancelButton,
                (isChanging || isCanceling) && styles.cancelButtonDisabled,
              ]}
              onPress={() => handlePressCancel(trip)}
              activeOpacity={0.85}
              disabled={isChanging || isCanceling}
            >
              <Text style={styles.cancelButtonText}>
                {isCanceling ? "Đang huỷ..." : "Huỷ chuyến"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    });
  };

  const renderNotificationContent = () => {
    if (loadingNotifications) {
      return (
        <View style={styles.notificationLoadingWrap}>
          <ActivityIndicator size="small" color="#F97316" />
          <Text style={styles.notificationLoadingText}>
            Đang tải thông báo...
          </Text>
        </View>
      );
    }

    if (!notifications.length) {
      return (
        <View style={styles.notificationEmptyWrap}>
          <Text style={styles.notificationEmptyTitle}>Chưa có thông báo</Text>
          <Text style={styles.notificationEmptyText}>
            Khi admin gửi thông báo hệ thống, nội dung sẽ hiển thị tại đây.
          </Text>
        </View>
      );
    }

    return notifications.map((item) => (
      <View key={item.id} style={styles.notificationCard}>
        <View style={styles.notificationCardTop}>
          <Text style={styles.notificationBadge}>
            {item.isRead ? "ĐÃ ĐỌC" : "THÔNG BÁO"}
          </Text>
          <Text style={styles.notificationTime}>
            {formatDateTime(item.createdAt)}
          </Text>
        </View>

        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationMessage}>{item.message}</Text>
      </View>
    ));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View
          style={[
            styles.header,
            {
              paddingTop: topInset + 4,
              paddingBottom: 4,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.headerIconButton}
            activeOpacity={0.8}
            onPress={handleOpenMenu}
          >
            <Text style={styles.headerIcon}>☰</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            {brandLogoUrl ? (
              <Image
                source={{ uri: brandLogoUrl }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  marginRight: 8,
                }}
                resizeMode="contain"
              />
            ) : null}

            <Text style={styles.headerTitle} numberOfLines={1}>
              {brandName || "GoViet247"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.headerIconButton}
            activeOpacity={0.8}
            onPress={() => void handleOpenNotifications()}
          >
            <Text style={styles.headerIcon}>🔔</Text>
            {unreadCount > 0 ? <View style={styles.headerBadgeDot} /> : null}
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={styles.tabButton}
            activeOpacity={0.8}
            onPress={() => setActiveTab("AVAILABLE")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "AVAILABLE" && styles.tabTextActive,
              ]}
            >
              Chuyến đang chờ ({availableCount})
            </Text>
            <View
              style={[
                styles.tabUnderline,
                activeTab === "AVAILABLE" && styles.tabUnderlineActive,
              ]}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabButton}
            activeOpacity={0.8}
            onPress={() => setActiveTab("MY_TRIPS")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "MY_TRIPS" && styles.tabTextActiveMuted,
              ]}
            >
              Đơn của tôi ({myTripsCount})
            </Text>
            <View
              style={[
                styles.tabUnderline,
                activeTab === "MY_TRIPS" && styles.tabUnderlineActive,
              ]}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: bottomInset + (activeTab === "MY_TRIPS" ? 96 : 72),
            },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {activeTab === "AVAILABLE"
            ? renderAvailableContent()
            : renderMyTripsContent()}

          <View
            style={
              activeTab === "MY_TRIPS"
                ? styles.scrollBottomSpacerMyTrips
                : styles.scrollBottomSpacerAvailable
            }
          />
        </ScrollView>

        <Modal
          transparent
          visible={menuVisible}
          animationType="fade"
          onRequestClose={handleCloseMenu}
        >
          <View style={styles.menuOverlay}>
            <View
              style={[
                styles.menuPanel,
                {
                  paddingTop: topInset + 12,
                  paddingBottom: Math.max(bottomInset, 16),
                },
              ]}
            >
              <View style={styles.menuProfileSection}>
                {driverMenuAvatar ? (
                  <Image
                    source={{ uri: driverMenuAvatar }}
                    style={styles.menuAvatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.menuAvatarFallback}>
                    <Text style={styles.menuAvatarFallbackText}>👨‍✈️</Text>
                  </View>
                )}

                <Text style={styles.menuProfileName} numberOfLines={2}>
                  {driverMenuName}
                </Text>

                <Text style={styles.menuProfilePhone} numberOfLines={1}>
                  {formatVietnamesePhone(driverMenuPhone)}
                </Text>
              </View>

              <ScrollView
                style={styles.menuScroll}
                contentContainerStyle={styles.menuScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.menuItemsGroup}>
                  <TouchableOpacity
                    style={styles.menuItem}
                    activeOpacity={0.85}
                    onPress={() => void handleMenuPress("HOME")}
                  >
                    <Text style={styles.menuItemIcon}>🏠</Text>
                    <Text style={styles.menuItemText}>Trang chủ</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    activeOpacity={0.85}
                    onPress={() => void handleMenuPress("PROFILE")}
                  >
                    <Text style={styles.menuItemIcon}>👤</Text>
                    <Text style={styles.menuItemText}>Hồ sơ tài xế</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    activeOpacity={0.85}
                    onPress={() => void handleMenuPress("HISTORY")}
                  >
                    <Text style={styles.menuItemIcon}>🧾</Text>
                    <Text style={styles.menuItemText}>Lịch sử chuyến</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    activeOpacity={0.85}
                    onPress={() => void handleMenuPress("WALLET")}
                  >
                    <Text style={styles.menuItemIcon}>💳</Text>
                    <Text style={styles.menuItemText}>Ví tài xế</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    activeOpacity={0.85}
                    onPress={() => void handleMenuPress("NOTIFICATIONS")}
                  >
                    <Text style={styles.menuItemIcon}>🔔</Text>
                    <Text style={styles.menuItemText}>Thông báo</Text>
                    {unreadCount > 0 ? (
                      <View style={styles.menuNotificationBadge}>
                        <Text style={styles.menuNotificationBadgeText}>
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    activeOpacity={0.85}
                    onPress={() => void handleMenuPress("BOOKING")}
                  >
                    <Text style={styles.menuItemIcon}>🚕</Text>
                    <Text style={styles.menuItemText}>Đặt xe</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    activeOpacity={0.85}
                    onPress={() => void handleMenuPress("RULES")}
                  >
                    <Text style={styles.menuItemIcon}>📘</Text>
                    <Text style={styles.menuItemText}>Quy định & quy tắc</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    activeOpacity={0.85}
                    onPress={() => void handleMenuPress("SUPPORT")}
                  >
                    <Text style={styles.menuItemIcon}>☎️</Text>
                    <Text style={styles.menuItemText}>Hỗ trợ</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuItem}
                    activeOpacity={0.85}
                    onPress={() => void handleMenuPress("FEEDBACK")}
                  >
                    <Text style={styles.menuItemIcon}>💬</Text>
                    <Text style={styles.menuItemText}>Góp ý</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.menuBottomGroup}>
                  <TouchableOpacity
                    style={[styles.menuItem, styles.menuLogoutItem]}
                    activeOpacity={0.85}
                    onPress={() => void handleMenuPress("LOGOUT")}
                  >
                    <Text style={styles.menuItemIcon}>🚪</Text>
                    <Text style={styles.menuLogoutText}>Đăng xuất</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>

            <TouchableOpacity
              style={styles.menuBackdrop}
              activeOpacity={1}
              onPress={handleCloseMenu}
            />
          </View>
        </Modal>

        <Modal
          transparent
          visible={notificationModalVisible}
          animationType="fade"
          onRequestClose={handleCloseNotifications}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.notificationModalCard}>
              <View style={styles.notificationModalHeader}>
                <Text style={styles.notificationModalTitle}>Thông báo</Text>

                <TouchableOpacity
                  style={styles.notificationCloseButton}
                  activeOpacity={0.85}
                  onPress={handleCloseNotifications}
                >
                  <Text style={styles.notificationCloseButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.notificationListScroll}
                contentContainerStyle={styles.notificationListContent}
                showsVerticalScrollIndicator={false}
              >
                {renderNotificationContent()}
              </ScrollView>

              <View style={styles.singleModalActionRow}>
                <TouchableOpacity
                  style={styles.modalPrimaryButton}
                  activeOpacity={0.85}
                  onPress={handleCloseNotifications}
                >
                  <Text style={styles.modalPrimaryButtonText}>Đóng</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          transparent
          visible={!!cancelTrip}
          animationType="fade"
          onRequestClose={() => {
            if (!cancelingTripId) {
              setCancelTripId(null);
            }
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Cảnh báo huỷ chuyến</Text>

              <Text style={styles.modalText}>
                Bạn không nên huỷ chuyến vì nếu huỷ, hệ thống sẽ giữ lại{" "}
                {formatMoney(cancelPenaltyPreview)} đã trừ trước đó và tính là
                phí huỷ chuyến cho đơn này.
              </Text>

              <Text style={styles.modalTextBold}>
                Bạn có chắc bạn vẫn huỷ chuyến không?
              </Text>

              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={styles.modalSecondaryButton}
                  activeOpacity={0.85}
                  disabled={!!cancelingTripId}
                  onPress={() => setCancelTripId(null)}
                >
                  <Text style={styles.modalSecondaryButtonText}>Quay lại</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalDangerButton,
                    !!cancelingTripId && styles.modalDangerButtonDisabled,
                  ]}
                  activeOpacity={0.85}
                  disabled={!!cancelingTripId}
                  onPress={handleConfirmCancel}
                >
                  <Text style={styles.modalDangerButtonText}>
                    {!!cancelingTripId ? "Đang xử lý..." : "Vẫn huỷ chuyến"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          transparent
          visible={!!inProgressBlockedTripId}
          animationType="fade"
          onRequestClose={() => setInProgressBlockedTripId(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Không thể huỷ chuyến</Text>

              <Text style={styles.modalText}>
                Bạn không được huỷ chuyến khi đang trên hành trình.
              </Text>

              <Text style={styles.modalTextBold}>
                Vui lòng liên hệ admin qua số {supportPhone} để được hỗ trợ.
              </Text>

              <View style={styles.singleModalActionRow}>
                <TouchableOpacity
                  style={styles.modalPrimaryButton}
                  activeOpacity={0.85}
                  onPress={() => setInProgressBlockedTripId(null)}
                >
                  <Text style={styles.modalPrimaryButtonText}>Đã hiểu</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: "#FFFFFF",
  },
  headerIconButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  headerIcon: {
    fontSize: 24,
    color: "#374151",
  },
  headerBadgeDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#DC2626",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  headerTitle: {
    flex: 1,
    marginLeft: 10,
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingTop: 10,
  },
  tabText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#9CA3AF",
    marginBottom: 12,
  },
  tabTextActive: {
    color: "#F97316",
  },
  tabTextActiveMuted: {
    color: "#6B7280",
  },
  tabUnderline: {
    height: 3,
    width: "100%",
    backgroundColor: "transparent",
    borderRadius: 999,
  },
  tabUnderlineActive: {
    backgroundColor: "#F97316",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 14,
  },
  scrollBottomSpacerAvailable: {
    height: 12,
  },
  scrollBottomSpacerMyTrips: {
    height: 12,
  },
  loadingWrap: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
  },
  tripCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  tripTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
  },
  tripIdBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#374151",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    overflow: "hidden",
  },
  tripTime: {
    flex: 1,
    textAlign: "right",
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    lineHeight: 22,
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 14,
    lineHeight: 26,
  },
  fuelBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF7ED",
    borderColor: "#F97316",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: -6,
    marginBottom: 14,
  },
  fuelBadgeText: {
    color: "#C2410C",
    fontSize: 13,
    fontWeight: "800",
  },
  noticeBox: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
  },
  noticeWarningBox: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FDBA74",
  },
  noticeInfoBox: {
    backgroundColor: "#EFF6FF",
    borderColor: "#93C5FD",
  },
  noticeText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
  },
  noticeWarningText: {
    color: "#C2410C",
  },
  noticeInfoText: {
    color: "#1D4ED8",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  priceBlock: {
    flex: 1,
  },
  priceBlockRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9CA3AF",
    marginBottom: 2,
  },
  priceSubLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    marginBottom: 4,
  },
  customerPrice: {
    fontSize: 16,
    fontWeight: "800",
    color: "#4B5563",
  },
  driverIncome: {
    fontSize: 16,
    fontWeight: "800",
    color: "#F97316",
  },
  requiredWalletHint: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#9CA3AF",
    textAlign: "right",
  },
  incomeToggleButton: {
    alignSelf: "flex-start",
    marginTop: -2,
    marginBottom: 14,
    paddingVertical: 6,
  },
  incomeToggleButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#F97316",
  },
  incomeBreakdownCard: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  incomeBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  incomeBreakdownLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
    color: "#6B7280",
  },
  incomeBreakdownValue: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
    color: "#374151",
    textAlign: "right",
  },
  incomeBreakdownDivider: {
    height: 1,
    backgroundColor: "#FED7AA",
    marginVertical: 2,
  },
  incomeBreakdownLabelStrong: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "800",
    color: "#111827",
  },
  incomeBreakdownValueStrong: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "800",
    color: "#111827",
    textAlign: "right",
  },
  incomeBreakdownNetValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: "#F97316",
    textAlign: "right",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
    paddingRight: 6,
  },
  infoIcon: {
    width: 24,
    fontSize: 16,
    color: "#6B7280",
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: "#6B7280",
  },
  metaGroup: {
    marginTop: 2,
    gap: 6,
  },
  tripStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tripStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  tripStatusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },

  tripStatusBadgeAccepted: {
    backgroundColor: "#F3F4F6",
    borderColor: "#D1D5DB",
  },
  tripStatusBadgeTextAccepted: {
    color: "#374151",
  },

  tripStatusBadgeContacted: {
    backgroundColor: "#DBEAFE",
    borderColor: "#93C5FD",
  },
  tripStatusBadgeTextContacted: {
    color: "#1D4ED8",
  },

  tripStatusBadgeInProgress: {
    backgroundColor: "#FFEDD5",
    borderColor: "#FDBA74",
  },
  tripStatusBadgeTextInProgress: {
    color: "#C2410C",
  },

  tripStatusBadgeCompleted: {
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC",
  },
  tripStatusBadgeTextCompleted: {
    color: "#15803D",
  },

  tripStatusBadgeCancelled: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  tripStatusBadgeTextCancelled: {
    color: "#DC2626",
  },
  metaText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  cardFooter: {
    marginTop: 14,
    alignItems: "flex-end",
  },
  acceptLockHint: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  cardFooterRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  cardFooterRowRightOnly: {
    justifyContent: "flex-end",
  },
  leftActionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  acceptButton: {
    minWidth: 160,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  acceptButtonLocked: {
    backgroundColor: "#9CA3AF",
  },
  acceptButtonDisabled: {
    opacity: 0.7,
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  cancelButton: {
    minWidth: 130,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  cancelButtonDisabled: {
    opacity: 0.7,
  },
  cancelButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#6B7280",
  },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: 14,
    minWidth: 110,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  menuOverlay: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(17, 24, 39, 0.32)",
  },
  menuPanel: {
    width: 290,
    maxWidth: "86%",
    maxHeight: "100%",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 2, height: 0 },
    elevation: 10,
  },
  menuBackdrop: {
    flex: 1,
  },
  menuScroll: {
    flex: 1,
  },

  menuScrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 40,
  },
  menuProfileSection: {
    alignItems: "center",
    paddingBottom: 20,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  menuAvatarImage: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  menuAvatarFallback: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  menuAvatarFallbackText: {
    fontSize: 46,
  },
  menuProfileName: {
    marginTop: 14,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  menuProfilePhone: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
  },
  menuContent: {
    flex: 1,
    justifyContent: "space-between",
    paddingTop: 8,
  },
  menuItemsGroup: {
    gap: 4,
  },
  menuBottomGroup: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginTop: 20,
    marginBottom: 24,
  },
  menuItem: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  menuItemIcon: {
    width: 26,
    fontSize: 17,
  },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
  },
  menuNotificationBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  menuNotificationBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  menuLogoutItem: {
    backgroundColor: "#FEF2F2",
  },
  menuLogoutText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: "#DC2626",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
  },
  notificationModalCard: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "80%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
  },
  notificationModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  notificationModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  notificationCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationCloseButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#374151",
  },
  notificationListScroll: {
    maxHeight: 430,
  },
  notificationListContent: {
    paddingBottom: 6,
    gap: 12,
  },
  notificationLoadingWrap: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationLoadingText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  notificationEmptyWrap: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationEmptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },
  notificationEmptyText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#6B7280",
    textAlign: "center",
  },
  notificationCard: {
    backgroundColor: "#FFF7ED",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  notificationCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },
  notificationBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F97316",
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  notificationTime: {
    flex: 1,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
    lineHeight: 22,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 22,
    color: "#4B5563",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#DC2626",
  },
  modalText: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: "#4B5563",
  },
  modalTextBold: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: "#111827",
    fontWeight: "800",
  },
  modalActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  singleModalActionRow: {
    marginTop: 18,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#374151",
  },
  modalDangerButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  modalDangerButtonDisabled: {
    opacity: 0.7,
  },
  modalDangerButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalPrimaryButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
