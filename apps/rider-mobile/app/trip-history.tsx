// Path: goviet247/apps/rider-mobile/app/trip-history.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AppBrandHeader from "../components/AppBrandHeader";
import { cancelTripByRider, getMyTrips } from "../services/tripApi";
import { onRiderSocketEvent } from "../services/riderSocket";
import { useTripActivity } from "../context/TripActivityContext";

type TripItem = {
  id: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupTime: string;
  returnTime?: string | null;
  createdAt: string;
  updatedAt?: string;
  totalPrice?: number | string | null;
  fareEstimate?: number | string | null;
  status: string;
  isVerified?: boolean;
  verifiedAt?: string | null;
  direction?: "ONE_WAY" | "ROUND_TRIP" | string | null;
  carType?: string | null;
  riderName?: string | null;
  riderPhone?: string | null;
  note?: string | null;
  stops?: Array<{
    id: string;
    seq: number;
    address: string;
  }>;
};

function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "Chưa có giá";
  }

  return `${amount.toLocaleString("vi-VN")}đ`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Chưa có thời gian";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Chưa có thời gian";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getTripStatusMeta(item: TripItem) {
  const status = String(item?.status || "")
    .trim()
    .toUpperCase();

  const isVerified = Boolean(item?.isVerified);
  const hasVerifiedAt = Boolean(item?.verifiedAt);

  if (status === "PENDING" && (isVerified || hasVerifiedAt)) {
    return {
      label: "Đã duyệt - chờ tài xế",
      bg: "#DBEAFE",
      text: "#1D4ED8",
    };
  }

  switch (status) {
    case "PENDING":
      return {
        label: "Chờ duyệt",
        bg: "#FEF3C7",
        text: "#92400E",
      };
    case "ACCEPTED":
      return {
        label: "Tài xế đã nhận",
        bg: "#DBEAFE",
        text: "#1D4ED8",
      };
    case "CONTACTED":
      return {
        label: "Đã liên hệ",
        bg: "#E0E7FF",
        text: "#4338CA",
      };
    case "IN_PROGRESS":
      return {
        label: "Đang đi",
        bg: "#DCFCE7",
        text: "#166534",
      };
    case "COMPLETED":
      return {
        label: "Hoàn thành",
        bg: "#ECFCCB",
        text: "#3F6212",
      };
    case "CANCELLED":
      return {
        label: "Đã huỷ",
        bg: "#FEE2E2",
        text: "#B91C1C",
      };
    default:
      return {
        label: status || "Không rõ",
        bg: "#E5E7EB",
        text: "#374151",
      };
  }
}

function getDirectionLabel(directionRaw: string | null | undefined) {
  const direction = String(directionRaw || "")
    .trim()
    .toUpperCase();

  if (direction === "ROUND_TRIP") {
    return "Khứ hồi";
  }

  return "Một chiều";
}

function getCarTypeLabel(carTypeRaw: string | null | undefined) {
  const carType = String(carTypeRaw || "").trim().toUpperCase();

  if (carType === "CAR_5") return "Xe 5 chỗ";
  if (carType === "CAR_7") return "Xe 7 chỗ";
  if (carType === "CAR_16") return "Xe 16 chỗ";

  return carTypeRaw || "Chưa xác định";
}

function normalizeAddress(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getShortTripId(id: string | null | undefined) {
  const raw = String(id || "").trim();

  if (!raw) return "---";

  if (raw.length <= 8) return raw.toUpperCase();

  return raw.slice(raw.length - 8).toUpperCase();
}

function getRouteText(item: TripItem) {
  const pickup = String(item?.pickupAddress || "").trim();
  const dropoff = String(item?.dropoffAddress || "").trim();
  const stops = Array.isArray(item?.stops)
    ? item.stops
        .map((stop) => String(stop?.address || "").trim())
        .filter(Boolean)
    : [];

  const parts: string[] = [];

  [pickup, ...stops, dropoff].filter(Boolean).forEach((address) => {
    const previous = parts[parts.length - 1];
    if (!previous || normalizeAddress(previous) !== normalizeAddress(address)) {
      parts.push(address);
    }
  });

  return parts.join(" → ");
}

export default function RiderTripHistoryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    focusTripId?: string;
    justCreated?: string;
  }>();

  const focusTripId = String(params?.focusTripId || "").trim();
  const justCreated = String(params?.justCreated || "").trim() === "1";

  const { markAllAsSeen } = useTripActivity();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<TripItem[]>([]);
  const [errorText, setErrorText] = useState("");
  const [cancellingTripId, setCancellingTripId] = useState("");

  const scrollViewRef = useRef<ScrollView | null>(null);
  const [focusCardY, setFocusCardY] = useState(0);
  const [didAutoFocus, setDidAutoFocus] = useState(false);

  async function loadTrips(options?: { silent?: boolean }) {
    const silent = Boolean(options?.silent);

    try {
      setErrorText("");

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const trips = await getMyTrips();
      setItems(Array.isArray(trips) ? trips : []);
    } catch (error: any) {
      console.error("load rider trips error:", error);
      setErrorText(error?.message || "Không tải được hoạt động.");
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }

  async function doCancelTrip(item: TripItem) {
    try {
      setCancellingTripId(item.id);

      await cancelTripByRider(item.id, {
        cancelReason: "Khách hàng tự huỷ trên app rider",
      });

      await loadTrips({ silent: true });

      Alert.alert("Thành công", "Đã huỷ chuyến thành công.");
    } catch (error: any) {
      console.error("cancel trip by rider error:", error);
      Alert.alert("Lỗi", error?.message || "Không thể huỷ chuyến lúc này.");
    } finally {
      setCancellingTripId("");
    }
  }

  function handleCancelTrip(item: TripItem) {
    const message =
      "Bạn chỉ có thể tự huỷ chuyến khi chuyến đang ở trạng thái Chờ duyệt.";

    if (Platform.OS === "web") {
      const confirmed =
        typeof window !== "undefined"
          ? window.confirm(
              `${message}\n\nBạn có chắc muốn huỷ chuyến này không?`,
            )
          : false;

      if (!confirmed) {
        return;
      }

      void doCancelTrip(item);
      return;
    }

    Alert.alert("Huỷ chuyến?", message, [
      {
        text: "Không",
        style: "cancel",
      },
      {
        text: "Huỷ chuyến",
        style: "destructive",
        onPress: () => {
          void doCancelTrip(item);
        },
      },
    ]);
  }

  useEffect(() => {
    loadTrips();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTrips({ silent: true });
      void markAllAsSeen();
    }, [markAllAsSeen]),
  );

  useEffect(() => {
    const offTripChanged = onRiderSocketEvent("rider:trip_changed", () => {
      void loadTrips({ silent: true });
    });

    return () => {
      offTripChanged?.();
    };
  }, []);

  useEffect(() => {
    if (!focusTripId) return;
    setDidAutoFocus(false);
  }, [focusTripId]);

  useEffect(() => {
    if (!focusTripId || !items.length || didAutoFocus) return;

    const hasFocusedTrip = items.some((item) => item.id === focusTripId);
    if (!hasFocusedTrip) return;

    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, focusCardY - 12),
        animated: true,
      });
      setDidAutoFocus(true);
    }, 250);

    return () => clearTimeout(timer);
  }, [focusTripId, items, focusCardY, didAutoFocus]);

  const sortedItems = useMemo(() => {
    const next = [...items];

    next.sort((a, b) => {
      const aTime = new Date(a?.createdAt || 0).getTime();
      const bTime = new Date(b?.createdAt || 0).getTime();
      return bTime - aTime;
    });

    return next;
  }, [items]);

  const hasTrips = useMemo(() => sortedItems.length > 0, [sortedItems]);

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.flex}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: Math.max(insets.top, 10),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AppBrandHeader title="Hoạt động" />

        {justCreated ? (
          <View style={styles.successBox}>
            <Text style={styles.successBoxText}>Đặt chuyến thành công.</Text>
            <Text style={styles.successBoxText}>
              Nhân viên sẽ xác nhận và Tài xế sẽ liên hệ bạn trong ít phút tới.
              Vui lòng để ý điện thoại.
            </Text>
          </View>
        ) : null}

        <View style={styles.topActions}>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              loadTrips({ silent: true });
            }}
            disabled={refreshing}
          >
            <Text style={styles.secondaryButtonText}>
              {refreshing ? "Đang tải..." : "Làm mới"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              router.navigate("/booking");
            }}
          >
            <Text style={styles.primaryButtonText}>🚗 Đặt chuyến mới</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Đang tải hoạt động...</Text>
          </View>
        ) : errorText ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Không tải được hoạt động</Text>
            <Text style={styles.cardText}>{errorText}</Text>

            <Pressable
              style={styles.retryButton}
              onPress={() => {
                loadTrips();
              }}
            >
              <Text style={styles.retryButtonText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : !hasTrips ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Chưa có chuyến nào</Text>
            <Text style={styles.cardText}>
              Khi rider đặt chuyến thành công, danh sách chuyến sẽ hiện tại đây
              và chuyến mới nhất sẽ nằm ở trên cùng.
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {sortedItems.map((item) => {
              const statusMeta = getTripStatusMeta(item);
              const displayPrice =
                item?.totalPrice ?? item?.fareEstimate ?? null;

              return (
                <View
                  key={item.id}
                  style={[
                    styles.tripCard,
                    item.id === focusTripId ? styles.tripCardFocused : null,
                  ]}
                  onLayout={(event) => {
                    if (item.id === focusTripId) {
                      setFocusCardY(event.nativeEvent.layout.y);
                    }
                  }}
                >
                  <View style={styles.tripCardHeader}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusMeta.bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: statusMeta.text },
                        ]}
                      >
                        {statusMeta.label}
                      </Text>
                    </View>

                    <Text style={styles.tripIdText}>
                      #{getShortTripId(item.id)}
                    </Text>
                  </View>

                  <Text style={styles.routeText}>{getRouteText(item)}</Text>

                  <View style={styles.metaGroup}>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Loại chuyến</Text>
                      <Text style={styles.metaValue}>
                        {getDirectionLabel(item?.direction)}
                      </Text>
                    </View>

                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Loại xe</Text>
                      <Text style={styles.metaValue}>
                        {getCarTypeLabel(item?.carType)}
                      </Text>
                    </View>

                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Giờ đón</Text>
                      <Text style={styles.metaValue}>
                        {formatDateTime(item?.pickupTime)}
                      </Text>
                    </View>

                    {String(item?.direction || "").toUpperCase() ===
                    "ROUND_TRIP" ? (
                      <View style={styles.metaRow}>
                        <Text style={styles.metaLabel}>Giờ về</Text>
                        <Text style={styles.metaValue}>
                          {formatDateTime(item?.returnTime)}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Giá chuyến</Text>
                      <Text style={styles.priceValue}>
                        {formatMoney(displayPrice)}
                      </Text>
                    </View>
                  </View>

                  {item?.note ? (
                    <View style={styles.noteBox}>
                      <Text style={styles.noteLabel}>Ghi chú</Text>
                      <Text style={styles.noteValue}>{item.note}</Text>
                    </View>
                  ) : null}

                  {String(item?.status || "")
                    .trim()
                    .toUpperCase() === "PENDING" ? (
                    <Pressable
                      style={[
                        styles.cancelButton,
                        cancellingTripId === item.id
                          ? styles.cancelButtonDisabled
                          : null,
                      ]}
                      onPress={() => {
                        if (cancellingTripId) return;
                        handleCancelTrip(item);
                      }}
                      disabled={Boolean(cancellingTripId)}
                    >
                      <Text style={styles.cancelButtonText}>
                        {cancellingTripId === item.id
                          ? "Đang huỷ..."
                          : "Huỷ chuyến"}
                      </Text>
                    </Pressable>
                  ) : null}

                  {String(item?.status || "")
                    .trim()
                    .toUpperCase() === "COMPLETED" ? (
                    <Pressable
                      style={styles.feedbackButton}
                      onPress={() => {
                        router.push(`/feedback?tripId=${item.id}`);
                      }}
                    >
                      <Text style={styles.feedbackButtonText}>Góp ý</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  topActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  successBox: {
    marginBottom: 16,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  successBoxText: {
    color: "#C2410C",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
  },
  secondaryButton: {
    minHeight: 50,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#374151",
  },
  primaryButton: {
    flex: 1,
    minHeight: 50,
    backgroundColor: "#F97316",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  loadingCard: {
    minHeight: 220,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#6B7280",
  },
  retryButton: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  listWrap: {
    gap: 12,
  },
  tripCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tripCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 10,
  },
  tripCardFocused: {
    borderColor: "#F97316",
    borderWidth: 2,
    backgroundColor: "#FFF7ED",
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  tripIdText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7280",
  },
  routeText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    lineHeight: 24,
    marginBottom: 14,
  },
  metaGroup: {
    gap: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  metaLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
  },
  metaValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    textAlign: "right",
  },
  priceValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: "#F97316",
    textAlign: "right",
  },
  noteBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7280",
    marginBottom: 4,
  },
  noteValue: {
    fontSize: 14,
    lineHeight: 22,
    color: "#374151",
  },
  cancelButton: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  feedbackButton: {
    marginTop: 12,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#93C5FD",
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  feedbackButtonText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "800",
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "800",
  },
});
