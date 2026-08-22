// Path: goviet247/apps/driver-mobile/app/trip-history.tsx
import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Platform,
} from "react-native";

import {
  getDriverTripHistory,
  getDriverCancelHistory,
  type MyTripItem,
  type DriverCancelledTripItem,
} from "../services/tripApi";
import { showError, showSuccess } from "../services/toast";

export default function TripHistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trips, setTrips] = useState<MyTripItem[]>([]);
  const [cancelledTrips, setCancelledTrips] = useState<
    DriverCancelledTripItem[]
  >([]);
  const [tab, setTab] = useState<"ALL" | "COMPLETED" | "CANCELLED">("ALL");

  const topInset =
    Platform.OS === "android"
      ? Math.max((StatusBar.currentHeight ?? 0) - 6, 8)
      : 0;

  const loadTrips = useCallback(async () => {
    try {
      const [historyData, cancelData] = await Promise.all([
        getDriverTripHistory("COMPLETED"),
        getDriverCancelHistory(),
      ]);

      setTrips(historyData || []);
      setCancelledTrips(cancelData || []);
    } catch (err) {
      console.error("load history trips error", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTrips();
  };

  const filteredCompletedTrips = trips.filter((trip) => {
    const normalizedStatus = String(trip.status || "")
      .trim()
      .toUpperCase();
    return normalizedStatus === "COMPLETED";
  });

  const filteredCancelledTrips = cancelledTrips;

  const filteredItems =
    tab === "COMPLETED"
      ? filteredCompletedTrips
      : tab === "CANCELLED"
        ? filteredCancelledTrips
        : [...filteredCancelledTrips, ...filteredCompletedTrips].sort(
            (a: any, b: any) => {
              const aTime = new Date(
                a.cancelledAt || a.createdAt || a.pickupTime || 0,
              ).getTime();
              const bTime = new Date(
                b.cancelledAt || b.createdAt || b.pickupTime || 0,
              ).getTime();

              return bTime - aTime;
            },
          );

  const formatDateTime = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("vi-VN");
  };

  const getCarTypeLabel = (carType: MyTripItem["carType"]) => {
    if (carType === "CAR_5") return "5 chỗ";
    if (carType === "CAR_7") return "7 chỗ";
    return "16 chỗ";
  };

  const getStatusLabel = (status?: string | null) => {
    const normalizedStatus = String(status || "")
      .trim()
      .toUpperCase();

    if (normalizedStatus === "COMPLETED") return "Đã hoàn thành";
    if (
      normalizedStatus === "CANCELLED" ||
      normalizedStatus === "CANCELED" ||
      normalizedStatus === "APPROVED" ||
      normalizedStatus === "PENDING"
    ) {
      return "Đã huỷ";
    }

    return status || "";
  };

  const handleGoBack = () => {
    router.replace("/dashboard");
  };

  const copyTripId = async (id: string) => {
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        await navigator.clipboard.writeText(id);
      }
      showSuccess("Đã copy mã chuyến");
    } catch (err) {
      console.error("Copy error", err);
      showError("Không thể copy");
    }
  };

  const renderCancelledTripCard = (trip: DriverCancelledTripItem) => {
    return (
      <View key={`cancel-${trip.id}`} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.tripIdWrap}>
            <Text style={styles.tripIdLabel}>Mã chuyến</Text>

            <View style={styles.tripIdRow}>
              <Text selectable style={styles.tripId}>
                {trip.tripId}
              </Text>

              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => copyTripId(trip.tripId)}
                activeOpacity={0.8}
              >
                <Text style={styles.copyText}>📑</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.time}>
            {formatDateTime(trip.cancelledAt || trip.createdAt || null)}
          </Text>
        </View>

        <Text style={styles.title}>
          Bao chuyến{" "}
          {trip.carType === "CAR_5"
            ? "5 chỗ"
            : trip.carType === "CAR_7"
              ? "7 chỗ"
              : "16 chỗ"}{" "}
          {trip.direction === "ROUND_TRIP" ? "(khứ hồi)" : "(1 chiều)"}
        </Text>

        <View style={styles.row}>
          <Text style={styles.label}>Điểm đón:</Text>
          <Text style={styles.value}>{trip.pickupAddress}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Điểm trả:</Text>
          <Text style={styles.value}>{trip.dropoffAddress}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Khách trả:</Text>
          <Text style={styles.value}>
            {Number(trip.totalPrice || 0).toLocaleString("vi-VN")}đ
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Tiền phạt:</Text>
          <Text style={[styles.value, styles.statusCancelledText]}>
            {Number(trip.penaltyAmount || 0).toLocaleString("vi-VN")}đ
          </Text>
        </View>

        {!!trip.cancelReason && (
          <View style={styles.row}>
            <Text style={styles.label}>Lý do:</Text>
            <Text style={styles.value}>{trip.cancelReason}</Text>
          </View>
        )}

        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, styles.statusCancelledBadge]}>
            <Text style={[styles.statusText, styles.statusCancelledText]}>
              {getStatusLabel(trip.status)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderHistoryItem = (item: MyTripItem | DriverCancelledTripItem) => {
    const normalizedStatus = String((item as any)?.status || "")
      .trim()
      .toUpperCase();

    if (normalizedStatus === "COMPLETED") {
      return renderTripCard(item as MyTripItem);
    }

    return renderCancelledTripCard(item as DriverCancelledTripItem);
  };

  const renderTripCard = (trip: MyTripItem) => {
    const isCompleted = trip.status === "COMPLETED";

    return (
      <View key={trip.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.tripIdWrap}>
            <Text style={styles.tripIdLabel}>Mã chuyến</Text>

            <View style={styles.tripIdRow}>
              <Text selectable style={styles.tripId}>
                {trip.id}
              </Text>

              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => copyTripId(trip.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.copyText}>📑</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.time}>{formatDateTime(trip.pickupTime)}</Text>
        </View>

        <Text style={styles.title}>
          Bao chuyến {getCarTypeLabel(trip.carType)}{" "}
          {trip.direction === "ROUND_TRIP" ? "(khứ hồi)" : "(1 chiều)"}
        </Text>

        <View style={styles.row}>
          <Text style={styles.label}>Điểm đón:</Text>
          <Text style={styles.value}>
            {trip.pickupAddressMasked || trip.pickupAddress}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Điểm trả:</Text>
          <Text style={styles.value}>
            {trip.dropoffAddressMasked || trip.dropoffAddress}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Khách trả:</Text>
          <Text style={styles.value}>
            {Number(trip.totalPrice || 0).toLocaleString("vi-VN")}đ
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Tài xế nhận:</Text>
          <Text style={[styles.value, styles.driverPrice]}>
            {Number(trip.driverReceiveSnapshot || 0).toLocaleString("vi-VN")}đ
          </Text>
        </View>

        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusBadge,
              isCompleted
                ? styles.statusCompletedBadge
                : styles.statusCancelledBadge,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isCompleted
                  ? styles.statusCompletedText
                  : styles.statusCancelledText,
              ]}
            >
              {getStatusLabel(trip.status)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ff6b00" />
          <Text style={styles.loadingText}>Đang tải lịch sử chuyến...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View
        style={[
          styles.header,
          {
            height: 68 + topInset,
            paddingTop: topInset,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.headerIconButton}
          activeOpacity={0.8}
          onPress={handleGoBack}
        >
          <Text style={styles.headerIcon}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Lịch sử chuyến</Text>

        <View style={styles.headerIconButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tabs}>
          <TabButton
            label="Tất cả"
            active={tab === "ALL"}
            onPress={() => setTab("ALL")}
          />
          <TabButton
            label="Đã hoàn thành"
            active={tab === "COMPLETED"}
            onPress={() => setTab("COMPLETED")}
          />
          <TabButton
            label="Đã huỷ"
            active={tab === "CANCELLED"}
            onPress={() => setTab("CANCELLED")}
          />
        </View>

        {filteredItems.length === 0 ? (
          <Text style={styles.empty}>Chưa có chuyến nào</Text>
        ) : (
          filteredItems.map(renderHistoryItem)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }: any) {
  return (
    <TouchableOpacity
      style={[styles.tabButton, active && styles.tabActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F7FB" },

  statusCompletedBadge: {
    backgroundColor: "#DCFCE7",
  },

  statusCancelledBadge: {
    backgroundColor: "#FEE2E2",
  },

  statusCompletedText: {
    color: "#16A34A",
  },

  statusCancelledText: {
    color: "#DC2626",
  },

  header: {
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  headerIconButton: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },

  headerIcon: {
    fontSize: 24,
    color: "#374151",
    fontWeight: "700",
    marginTop: -2,
  },

  headerTitle: {
    flex: 1,
    marginLeft: 8,
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 92,
  },

  tabs: {
    flexDirection: "row",
    marginBottom: 16,
  },

  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
    borderRadius: 18,
    backgroundColor: "#E5E7EB",
  },

  tabActive: {
    backgroundColor: "#ff6b00",
  },

  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#444",
  },

  tabTextActive: {
    color: "#fff",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  tripIdWrap: {
    flex: 1,
  },

  tripIdLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
  },

  tripIdRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  tripId: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: "#374151",
  },

  copyButton: {
    marginLeft: 8,
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },

  copyText: {
    fontSize: 14,
  },

  time: {
    fontSize: 12,
    color: "#6B7280",
  },

  title: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
    color: "#111827",
  },

  row: {
    flexDirection: "row",
    marginBottom: 6,
  },

  label: {
    width: 86,
    fontSize: 15,
    color: "#6B7280",
  },

  value: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },

  driverPrice: {
    color: "#ff6b00",
    fontWeight: "800",
  },

  statusRow: {
    marginTop: 10,
  },

  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#DCFCE7",
  },

  statusText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#16A34A",
  },

  empty: {
    textAlign: "center",
    marginTop: 60,
    color: "#6B7280",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: 10,
    color: "#6B7280",
  },
});
