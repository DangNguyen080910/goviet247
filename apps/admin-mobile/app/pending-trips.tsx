// Path: goviet247/apps/admin-mobile/app/pending-trips.tsx
import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import {
  cancelPendingTrip,
  fetchPendingTripDetail,
  fetchPendingVerifyCancelledTrips,
  fetchPendingVerifyTrips,
  manualAdjustPendingTrip,
  PendingTripDetail,
  PendingTripItem,
  verifyPendingTrip,
} from "../services/pendingTripsApi";

type TabKey = "PENDING" | "CANCELLED";

function formatMoney(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("vi-VN");
}

function buildSearchText(item: PendingTripItem) {
  return [
    item.id,
    item.riderName,
    item.riderPhone,
    item.pickupAddress,
    item.dropoffAddress,
    ...(item.stops || []).map((stop) => stop?.address || ""),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildDestinationList(
  dropoffAddress: string | null | undefined,
  stops:
    | Array<{ address?: string | null } | null | undefined>
    | null
    | undefined,
) {
  const stopAddresses = (stops || [])
    .map((stop) => String(stop?.address || "").trim())
    .filter(Boolean);

  const finalDropoff = String(dropoffAddress || "").trim();

  const destinations = [...stopAddresses, finalDropoff].filter(Boolean);

  return destinations.filter((address, index, array) => {
    return array.findIndex((item) => item === address) === index;
  });
}

function getTripTypeLabel(
  tripType: string | null | undefined,
  returnTime?: string | null,
) {
  const type = String(tripType || "").toUpperCase();

  if (type === "ROUND_TRIP") return "Khứ hồi";
  if (type === "ONE_WAY") return "Một chiều";

  return returnTime ? "Khứ hồi" : "Một chiều";
}

function formatCarType(carType?: string | null) {
  const value = String(carType || "").toUpperCase();

  if (value === "CAR_4") return "4 chỗ";
  if (value === "CAR_5") return "5 chỗ";
  if (value === "CAR_7") return "7 chỗ";
  if (value === "CAR_16") return "16 chỗ";

  return carType || "-";
}

function formatDistanceKm(distanceKm?: number | null) {
  const value = Number(distanceKm || 0);

  if (!value) return "-";

  return `${value.toFixed(1)} km`;
}

function formatMinutes(minutes?: number | null) {
  const totalMinutes = Number(minutes || 0);

  if (!totalMinutes) return "-";

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours > 0 && mins > 0) {
    return `${hours} giờ ${mins} phút`;
  }

  if (hours > 0) {
    return `${hours} giờ`;
  }

  return `${mins} phút`;
}

function calculateWaitingMinutes(
  estimatedDurationMinutes?: number | null,
  totalDriveMinutes?: number | null,
) {
  const total = Number(estimatedDurationMinutes || 0);
  const drive = Number(totalDriveMinutes || 0);

  const waiting = total - drive;

  return waiting > 0 ? waiting : 0;
}

function getPendingTripOriginLabel(cancelReason?: string | null) {
  const reason = String(cancelReason || "")
    .trim()
    .toLowerCase();

  if (reason.includes("driver") || reason.includes("tài xế")) {
    return "Tài xế huỷ";
  }

  return "Mới";
}
async function copyPhoneToClipboard(phone?: string | null) {
  const value = String(phone || "").trim();

  if (!value || value === "-") {
    Alert.alert("Không có số điện thoại", "Không có số điện thoại để copy.");
    return;
  }

  await Clipboard.setStringAsync(value);
  Alert.alert("Đã copy", `Đã copy số điện thoại: ${value}`);
}

function DetailRow({
  label,
  value,
  valueStyle,
  copyValue,
}: {
  label: string;
  value: string;
  valueStyle?: any;
  copyValue?: string | null;
}) {
  const canCopy = Boolean(String(copyValue || "").trim());

  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>

      <View style={styles.detailValueRow}>
        <Text style={[styles.detailValue, styles.detailValueText, valueStyle]}>
          {value || "-"}
        </Text>

        {canCopy ? (
          <Pressable
            style={styles.copyPhoneButton}
            onPress={() => copyPhoneToClipboard(copyValue)}
          >
            <Text style={styles.copyPhoneButtonText}>Copy</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function PendingTripsScreen() {
  const [tab, setTab] = useState<TabKey>("PENDING");
  const [searchText, setSearchText] = useState("");
  const [items, setItems] = useState<PendingTripItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedTripId, setSelectedTripId] = useState("");
  const [detail, setDetail] = useState<PendingTripDetail | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<"VERIFY" | "CANCEL" | "">(
    "",
  );
  const [cancelReason, setCancelReason] = useState("");

  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    pickupAddress: "",
    note: "",
    stops: [{ address: "" }],
    carType: "CAR_5",
    direction: "ONE_WAY",
    pickupTime: "",
    returnTime: "",
    distanceKm: "",
    fareEstimate: "",
    totalPrice: "",
    estimatedDurationMinutes: "",
    outboundDriveMinutes: "",
    returnDriveMinutes: "",
    totalDriveMinutes: "",
    verifiedNote:
      "Admin đã xác nhận lại địa chỉ chi tiết và giá cuối với khách.",
  });

  const filteredItems = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return items;

    return items.filter((item) => buildSearchText(item).includes(keyword));
  }, [items, searchText]);

  const loadData = useCallback(
    async (showRefreshSpinner = false) => {
      try {
        if (showRefreshSpinner) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const data =
          tab === "PENDING"
            ? await fetchPendingVerifyTrips()
            : await fetchPendingVerifyCancelledTrips();

        setItems(data);
      } catch (error) {
        console.error("load pending trips error:", error);
        setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [tab],
  );

  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [loadData]),
  );

  const closeDetailModal = useCallback(() => {
    setDetailVisible(false);
    setDetail(null);
    setSelectedTripId("");
    setCancelReason("");
    setDetailLoading(false);
    setActionLoading("");
    setIsAdjusting(false);
    setAdjustLoading(false);
  }, []);

  const openTripDetail = useCallback(async (tripId: string) => {
    try {
      setSelectedTripId(tripId);
      setDetailVisible(true);
      setDetailLoading(true);
      setCancelReason("");

      const data = await fetchPendingTripDetail(tripId);
      setDetail(data);
    } catch (error: any) {
      console.error("fetch trip detail error:", error);
      Alert.alert("Lỗi", error?.message || "Không tải được chi tiết chuyến.");
      setDetailVisible(false);
      setSelectedTripId("");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openAdjustForm = useCallback(() => {
    if (!detail) return;

    const currentStops =
      Array.isArray(detail.stops) && detail.stops.length > 0
        ? detail.stops
            .slice()
            .sort((a, b) => Number(a?.seq || 0) - Number(b?.seq || 0))
            .map((stop) => ({
              address: String(stop?.address || ""),
            }))
        : [{ address: detail.dropoffAddress || "" }];

    const currentDirection =
      detail.direction || (detail.returnTime ? "ROUND_TRIP" : "ONE_WAY");

    setAdjustForm({
      pickupAddress: detail.pickupAddress || "",
      note: detail.note || "",
      stops: currentStops.length > 0 ? currentStops : [{ address: "" }],
      carType: detail.carType || "CAR_5",
      direction: currentDirection,
      pickupTime: detail.pickupTime || "",
      returnTime:
        currentDirection === "ROUND_TRIP" ? detail.returnTime || "" : "",
      distanceKm: String(detail.distanceKm ?? ""),
      fareEstimate: String(detail.totalPrice ?? ""),
      totalPrice: String(detail.totalPrice ?? ""),
      estimatedDurationMinutes: String(detail.estimatedDurationMinutes ?? ""),
      outboundDriveMinutes: String(detail.totalDriveMinutes ?? ""),
      returnDriveMinutes:
        currentDirection === "ROUND_TRIP"
          ? String(Math.max(0, Number(detail.totalDriveMinutes || 0)))
          : "0",
      totalDriveMinutes: String(detail.totalDriveMinutes ?? ""),
      verifiedNote:
        "Admin đã xác nhận lại địa chỉ chi tiết và giá cuối với khách.",
    });

    setIsAdjusting(true);
  }, [detail]);

  const updateAdjustField = useCallback((field: string, value: string) => {
    setAdjustForm((prev) => {
      if (field === "direction" && value === "ONE_WAY") {
        return {
          ...prev,
          direction: value,
          returnTime: "",
          returnDriveMinutes: "0",
        };
      }

      return {
        ...prev,
        [field]: value,
      };
    });
  }, []);

  const updateAdjustStop = useCallback((index: number, value: string) => {
    setAdjustForm((prev) => {
      const nextStops = [...prev.stops];
      nextStops[index] = { address: value };

      return {
        ...prev,
        stops: nextStops,
      };
    });
  }, []);

  const addAdjustStop = useCallback(() => {
    setAdjustForm((prev) => ({
      ...prev,
      stops: [...prev.stops, { address: "" }],
    }));
  }, []);

  const removeAdjustStop = useCallback((index: number) => {
    setAdjustForm((prev) => {
      const nextStops = [...prev.stops];
      nextStops.splice(index, 1);

      return {
        ...prev,
        stops: nextStops.length > 0 ? nextStops : [{ address: "" }],
      };
    });
  }, []);

  const handleManualAdjustTrip = useCallback(async () => {
    if (!selectedTripId) return;

    const cleanStops = adjustForm.stops
      .map((stop, index) => ({
        seq: index + 1,
        address: stop.address.trim(),
      }))
      .filter((stop) => stop.address);

    if (!adjustForm.pickupAddress.trim()) {
      Alert.alert("Thiếu điểm đón", "Vui lòng nhập điểm đón.");
      return;
    }

    if (cleanStops.length === 0) {
      Alert.alert("Thiếu điểm đến", "Vui lòng nhập ít nhất một điểm đến.");
      return;
    }

    if (!adjustForm.pickupTime) {
      Alert.alert("Thiếu giờ đón", "Vui lòng nhập giờ đón.");
      return;
    }

    if (adjustForm.direction === "ROUND_TRIP" && !adjustForm.returnTime) {
      Alert.alert("Thiếu giờ về", "Vui lòng nhập giờ về cho chuyến khứ hồi.");
      return;
    }

    if (
      adjustForm.direction === "ROUND_TRIP" &&
      new Date(adjustForm.returnTime).getTime() <=
        new Date(adjustForm.pickupTime).getTime()
    ) {
      Alert.alert("Giờ về không hợp lệ", "Giờ về phải sau giờ đón.");
      return;
    }

    try {
      setAdjustLoading(true);

      await manualAdjustPendingTrip(selectedTripId, {
        pickupAddress: adjustForm.pickupAddress.trim(),
        note: adjustForm.note.trim(),
        dropoffAddress: cleanStops[cleanStops.length - 1].address,
        stops: cleanStops,
        carType: adjustForm.carType,
        direction: adjustForm.direction,
        pickupTime: adjustForm.pickupTime,
        returnTime:
          adjustForm.direction === "ROUND_TRIP" ? adjustForm.returnTime : null,
        distanceKm: Number(adjustForm.distanceKm),
        fareEstimate: Number(adjustForm.fareEstimate),
        totalPrice: Number(adjustForm.totalPrice),
        estimatedDurationMinutes: Number(adjustForm.estimatedDurationMinutes),
        outboundDriveMinutes: Number(adjustForm.outboundDriveMinutes),
        returnDriveMinutes: Number(adjustForm.returnDriveMinutes || 0),
        totalDriveMinutes: Number(adjustForm.totalDriveMinutes),
        verifiedNote: adjustForm.verifiedNote.trim(),
      });

      const updatedDetail = await fetchPendingTripDetail(selectedTripId);
      setDetail(updatedDetail);
      setIsAdjusting(false);

      Alert.alert("Thành công", "Đã cập nhật thông tin chuyến.");
      await loadData(false);
    } catch (error: any) {
      console.error("manual adjust trip error:", error);
      Alert.alert("Lỗi", error?.message || "Không thể cập nhật chuyến.");
    } finally {
      setAdjustLoading(false);
    }
  }, [adjustForm, loadData, selectedTripId]);

  const handleVerifyTrip = useCallback(async () => {
    if (!selectedTripId) return;

    try {
      setActionLoading("VERIFY");
      await verifyPendingTrip(selectedTripId);

      Alert.alert("Thành công", "Đã duyệt chuyến.");
      closeDetailModal();
      await loadData(false);
    } catch (error: any) {
      console.error("verify trip error:", error);
      Alert.alert("Lỗi", error?.message || "Không thể duyệt chuyến.");
    } finally {
      setActionLoading("");
    }
  }, [closeDetailModal, loadData, selectedTripId]);

  const handleCancelTrip = useCallback(async () => {
    if (!selectedTripId) return;

    const reason = cancelReason.trim();
    if (!reason) {
      Alert.alert("Thiếu lý do", "Vui lòng nhập lý do huỷ chuyến.");
      return;
    }

    try {
      setActionLoading("CANCEL");
      await cancelPendingTrip(selectedTripId, reason);

      Alert.alert("Thành công", "Đã huỷ chuyến.");
      closeDetailModal();
      await loadData(false);
    } catch (error: any) {
      console.error("cancel trip error:", error);
      Alert.alert("Lỗi", error?.message || "Không thể huỷ chuyến.");
    } finally {
      setActionLoading("");
    }
  }, [cancelReason, closeDetailModal, loadData, selectedTripId]);

  const renderItem = useCallback(
    ({ item }: { item: PendingTripItem }) => {
      const destinations = buildDestinationList(
        item.dropoffAddress,
        item.stops,
      );

      return (
        <Pressable
          style={styles.tripCard}
          onPress={() => openTripDetail(item.id)}
        >
          <View style={styles.tripCardHeader}>
            <Text style={styles.tripId} numberOfLines={1}>
              {item.id}
            </Text>

            {tab === "PENDING" ? (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>CHỜ DUYỆT</Text>
              </View>
            ) : (
              <View style={styles.cancelledBadge}>
                <Text style={styles.cancelledBadgeText}>ĐÃ HUỶ</Text>
              </View>
            )}
          </View>

          <View style={styles.identityBlock}>
            <Text style={styles.identityLabel}>👤 Người đặt</Text>

            <View style={styles.identityRow}>
              <View style={styles.identityInfo}>
                <Text style={styles.customerName}>
                  {item.creatorName || "Chưa có người đặt"}
                </Text>

                <Text style={styles.customerPhone}>
                  {item.creatorPhone || "-"}
                </Text>
              </View>

              {item.creatorPhone ? (
                <Pressable
                  style={styles.copyMiniButton}
                  onPress={() => copyPhoneToClipboard(item.creatorPhone)}
                >
                  <Text style={styles.copyMiniButtonText}>Copy</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View
            style={[
              styles.identityBlock,
              {
                marginTop: 10,
              },
            ]}
          >
            <Text style={styles.identityLabel}>🚖 Hành khách</Text>

            <View style={styles.identityRow}>
              <View style={styles.identityInfo}>
                <Text style={styles.customerName}>
                  {item.riderName || "Chưa có tên khách"}
                </Text>

                <Text style={styles.customerPhone}>
                  {item.riderPhone || "-"}
                </Text>
              </View>

              {item.riderPhone ? (
                <Pressable
                  style={styles.copyMiniButton}
                  onPress={() => copyPhoneToClipboard(item.riderPhone)}
                >
                  <Text style={styles.copyMiniButtonText}>Copy</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.label}>Điểm đón</Text>
            <Text style={styles.value}>{item.pickupAddress || "-"}</Text>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.label}>Điểm đến</Text>

            {destinations.length > 0 ? (
              destinations.map((address, index) => (
                <Text
                  key={`${index}-${address}`}
                  style={styles.destinationItem}
                >
                  Điểm đến {index + 1}: {address}
                </Text>
              ))
            ) : (
              <Text style={styles.value}>-</Text>
            )}
          </View>
          <View style={styles.operationalBox}>
            <Text style={styles.operationalLine}>
              🚗 {formatCarType(item.carType)} • 📏{" "}
              {formatDistanceKm(item.distanceKm)}
            </Text>

            <Text style={styles.operationalLine}>
              🚘 {formatMinutes(item.totalDriveMinutes)}
            </Text>

            <Text style={styles.operationalLine}>
              🕓 {formatMinutes(item.estimatedDurationMinutes)}
            </Text>
          </View>
          <View style={styles.bottomRow}>
            <View style={styles.pickupTimeBox}>
              <Text style={styles.label}>Giờ đón</Text>
              <Text style={styles.value}>
                {formatDateTime(item.pickupTime)}
              </Text>

              <Text
                style={[
                  styles.label,
                  {
                    marginTop: 10,
                  },
                ]}
              >
                Tạo lúc
              </Text>

              <Text style={styles.value}>{formatDateTime(item.createdAt)}</Text>
            </View>

            <View style={styles.priceBox}>
              <Text style={styles.label}>Giá</Text>

              <Text style={styles.priceValue}>
                {formatMoney(item.totalPrice)}đ
              </Text>
            </View>
          </View>

          {tab === "CANCELLED" ? (
            <View style={styles.cancelReasonBox}>
              <Text style={styles.cancelReasonLabel}>Lý do huỷ</Text>
              <Text style={styles.cancelReasonText}>
                {item.cancelReason || "-"}
              </Text>
            </View>
          ) : null}

          <Text style={styles.detailHint}>Chạm để xem chi tiết</Text>
        </Pressable>
      );
    },
    [openTripDetail, tab],
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Quay lại</Text>
        </Pressable>

        <Text style={styles.title}>Chuyến (Chờ Duyệt)</Text>
        <Text style={styles.subtitle}>
          Xem danh sách chuyến chờ duyệt và chuyến đã huỷ chưa duyệt.
        </Text>

        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabButton, tab === "PENDING" && styles.tabActive]}
            onPress={() => setTab("PENDING")}
          >
            <Text
              style={[
                styles.tabButtonText,
                tab === "PENDING" && styles.tabButtonTextActive,
              ]}
            >
              Chờ duyệt
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabButton, tab === "CANCELLED" && styles.tabActive]}
            onPress={() => setTab("CANCELLED")}
          >
            <Text
              style={[
                styles.tabButtonText,
                tab === "CANCELLED" && styles.tabButtonTextActive,
              ]}
            >
              Đã huỷ
            </Text>
          </Pressable>
        </View>

        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Tìm mã chuyến, tên khách, số điện thoại..."
          placeholderTextColor="#98a2b3"
          style={styles.searchInput}
        />

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#1565c0" />
            <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadData(true)}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Chưa có dữ liệu</Text>
                <Text style={styles.emptyText}>
                  Không có chuyến phù hợp với bộ lọc hiện tại.
                </Text>
              </View>
            }
          />
        )}
      </View>

      <Modal
        visible={detailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeDetailModal}
      >
        <SafeAreaView style={styles.modalContainer} edges={["top", "bottom"]}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardView}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={styles.modalHeader}>
              <Pressable
                style={styles.modalCloseButton}
                onPress={closeDetailModal}
              >
                <Text style={styles.modalCloseText}>Đóng</Text>
              </Pressable>

              <Text style={styles.modalTitle}>Chi tiết chuyến</Text>

              <View style={styles.modalClosePlaceholder} />
            </View>

            {detailLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color="#1565c0" />
                <Text style={styles.loadingText}>Đang tải chi tiết...</Text>
              </View>
            ) : detail ? (
              <ScrollView
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={
                  Platform.OS === "ios" ? "interactive" : "on-drag"
                }
              >
                <View style={styles.detailCard}>
                  <Text style={styles.detailCardTitle}>Thông tin chuyến</Text>

                  <DetailRow label="Mã chuyến" value={detail.id || "-"} />
                  <DetailRow
                    label="👤 Người đặt"
                    value={detail.creatorName || "Chưa có người đặt"}
                  />

                  <DetailRow
                    label="SĐT người đặt"
                    value={detail.creatorPhone || "-"}
                    copyValue={detail.creatorPhone}
                  />

                  <DetailRow
                    label="🚖 Hành khách"
                    value={detail.riderName || "Chưa có tên khách"}
                  />

                  <DetailRow
                    label="SĐT hành khách"
                    value={detail.riderPhone || "-"}
                    copyValue={detail.riderPhone}
                  />
                  <DetailRow
                    label="Loại chuyến"
                    value={getTripTypeLabel(detail.tripType, detail.returnTime)}
                  />
                  <DetailRow
                    label="Loại"
                    value={getPendingTripOriginLabel(detail.cancelReason)}
                  />
                  <DetailRow label="Trạng thái" value={detail.status || "-"} />
                  <DetailRow
                    label="Giờ đón"
                    value={formatDateTime(detail.pickupTime)}
                  />
                  <DetailRow
                    label="Giờ về"
                    value={formatDateTime(detail.returnTime)}
                  />
                  <DetailRow
                    label="Tạo lúc"
                    value={formatDateTime(detail.createdAt)}
                  />
                  <DetailRow
                    label="Giá"
                    value={`${formatMoney(detail.totalPrice)}đ`}
                    valueStyle={styles.detailPrice}
                  />
                  <DetailRow
                    label="Loại xe"
                    value={formatCarType(detail.carType)}
                  />

                  <DetailRow
                    label="Quãng đường dự kiến"
                    value={formatDistanceKm(detail.distanceKm)}
                  />

                  <DetailRow
                    label="Thời gian tài xế lái"
                    value={formatMinutes(detail.totalDriveMinutes)}
                  />

                  <DetailRow
                    label="Giờ chờ"
                    value={formatMinutes(
                      calculateWaitingMinutes(
                        detail.estimatedDurationMinutes,
                        detail.totalDriveMinutes,
                      ),
                    )}
                  />

                  <DetailRow
                    label="Tổng thời gian chuyến dự kiến"
                    value={formatMinutes(detail.estimatedDurationMinutes)}
                  />
                  <DetailRow
                    label="Điểm đón"
                    value={detail.pickupAddress || "-"}
                  />
                  <View style={styles.stopListWrap}>
                    <Text style={styles.detailLabel}>Điểm đến</Text>

                    {buildDestinationList(detail.dropoffAddress, detail.stops)
                      .length > 0 ? (
                      buildDestinationList(
                        detail.dropoffAddress,
                        detail.stops,
                      ).map((address, index) => (
                        <Text
                          key={`${index}-${address}`}
                          style={styles.stopItem}
                        >
                          Điểm đến {index + 1}: {address}
                        </Text>
                      ))
                    ) : (
                      <Text style={styles.detailValue}>-</Text>
                    )}
                  </View>
                  <DetailRow label="Ghi chú" value={detail.note || "-"} />
                </View>

                {isAdjusting ? (
                  <View style={styles.adjustCard}>
                    <Text style={styles.detailCardTitle}>
                      Cập nhật thông tin chuyến
                    </Text>
                    <Text style={styles.inputLabel}>Loại xe</Text>
                    <View style={styles.choiceRow}>
                      {[
                        { label: "5 chỗ", value: "CAR_5" },
                        { label: "7 chỗ", value: "CAR_7" },
                        { label: "16 chỗ", value: "CAR_16" },
                      ].map((option) => (
                        <Pressable
                          key={option.value}
                          style={[
                            styles.choiceButton,
                            adjustForm.carType === option.value &&
                              styles.choiceButtonActive,
                          ]}
                          onPress={() =>
                            updateAdjustField("carType", option.value)
                          }
                        >
                          <Text
                            style={[
                              styles.choiceButtonText,
                              adjustForm.carType === option.value &&
                                styles.choiceButtonTextActive,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={styles.inputLabel}>Loại chuyến</Text>
                    <View style={styles.choiceRow}>
                      {[
                        { label: "Một chiều", value: "ONE_WAY" },
                        { label: "Khứ hồi", value: "ROUND_TRIP" },
                      ].map((option) => (
                        <Pressable
                          key={option.value}
                          style={[
                            styles.choiceButton,
                            adjustForm.direction === option.value &&
                              styles.choiceButtonActive,
                          ]}
                          onPress={() =>
                            updateAdjustField("direction", option.value)
                          }
                        >
                          <Text
                            style={[
                              styles.choiceButtonText,
                              adjustForm.direction === option.value &&
                                styles.choiceButtonTextActive,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={styles.inputLabel}>Giờ đón</Text>
                    <TextInput
                      value={adjustForm.pickupTime}
                      onChangeText={(text) =>
                        updateAdjustField("pickupTime", text)
                      }
                      style={styles.adjustInput}
                      placeholder="VD: 2026-05-25T07:00:00.000+07:00"
                      placeholderTextColor="#98a2b3"
                    />

                    {adjustForm.direction === "ROUND_TRIP" ? (
                      <>
                        <Text style={styles.inputLabel}>Giờ về</Text>
                        <TextInput
                          value={adjustForm.returnTime}
                          onChangeText={(text) =>
                            updateAdjustField("returnTime", text)
                          }
                          style={styles.adjustInput}
                          placeholder="VD: 2026-05-26T18:00:00.000+07:00"
                          placeholderTextColor="#98a2b3"
                        />
                      </>
                    ) : null}
                    <Text style={styles.inputLabel}>Điểm đón</Text>
                    <TextInput
                      value={adjustForm.pickupAddress}
                      onChangeText={(text) =>
                        updateAdjustField("pickupAddress", text)
                      }
                      style={styles.adjustInput}
                      placeholder="Nhập điểm đón"
                      placeholderTextColor="#98a2b3"
                    />

                    <Text style={styles.inputLabel}>Các điểm đến</Text>

                    {adjustForm.stops.map((stop, index) => (
                      <View
                        key={`adjust-stop-${index}`}
                        style={styles.adjustStopRow}
                      >
                        <TextInput
                          value={stop.address}
                          onChangeText={(text) => updateAdjustStop(index, text)}
                          style={[styles.adjustInput, styles.adjustStopInput]}
                          placeholder={`Điểm đến ${index + 1}`}
                          placeholderTextColor="#98a2b3"
                        />

                        {adjustForm.stops.length > 1 ? (
                          <Pressable
                            style={styles.removeStopButton}
                            onPress={() => removeAdjustStop(index)}
                          >
                            <Text style={styles.removeStopButtonText}>Xoá</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ))}

                    <Pressable
                      style={styles.addStopButton}
                      onPress={addAdjustStop}
                    >
                      <Text style={styles.addStopButtonText}>
                        + Thêm điểm đến
                      </Text>
                    </Pressable>

                    <Text style={styles.inputLabel}>
                      Ghi chú của khách hàng
                    </Text>
                    <TextInput
                      value={adjustForm.note}
                      onChangeText={(text) => updateAdjustField("note", text)}
                      style={[styles.adjustInput, styles.adjustTextarea]}
                      multiline
                      placeholder="Nhập ghi chú của khách hàng"
                      placeholderTextColor="#98a2b3"
                    />

                    <Text style={styles.inputLabel}>Số km</Text>
                    <TextInput
                      value={adjustForm.distanceKm}
                      onChangeText={(text) =>
                        updateAdjustField("distanceKm", text)
                      }
                      style={styles.adjustInput}
                      keyboardType="numeric"
                      placeholder="VD: 100"
                      placeholderTextColor="#98a2b3"
                    />

                    <Text style={styles.inputLabel}>Giá ước tính</Text>
                    <TextInput
                      value={adjustForm.fareEstimate}
                      onChangeText={(text) =>
                        updateAdjustField("fareEstimate", text)
                      }
                      style={styles.adjustInput}
                      keyboardType="numeric"
                      placeholder="VD: 1480000"
                      placeholderTextColor="#98a2b3"
                    />

                    <Text style={styles.inputLabel}>Giá cuối</Text>
                    <TextInput
                      value={adjustForm.totalPrice}
                      onChangeText={(text) =>
                        updateAdjustField("totalPrice", text)
                      }
                      style={styles.adjustInput}
                      keyboardType="numeric"
                      placeholder="VD: 1480000"
                      placeholderTextColor="#98a2b3"
                    />

                    <Text style={styles.inputLabel}>
                      Tổng thời gian dự kiến (phút)
                    </Text>
                    <TextInput
                      value={adjustForm.estimatedDurationMinutes}
                      onChangeText={(text) =>
                        updateAdjustField("estimatedDurationMinutes", text)
                      }
                      style={styles.adjustInput}
                      keyboardType="numeric"
                      placeholder="VD: 147"
                      placeholderTextColor="#98a2b3"
                    />

                    <Text style={styles.inputLabel}>
                      Thời gian lái chiều đi (phút)
                    </Text>
                    <TextInput
                      value={adjustForm.outboundDriveMinutes}
                      onChangeText={(text) =>
                        updateAdjustField("outboundDriveMinutes", text)
                      }
                      style={styles.adjustInput}
                      keyboardType="numeric"
                      placeholder="VD: 147"
                      placeholderTextColor="#98a2b3"
                    />

                    <Text style={styles.inputLabel}>
                      Thời gian chiều về (phút)
                    </Text>
                    <TextInput
                      value={adjustForm.returnDriveMinutes}
                      onChangeText={(text) =>
                        updateAdjustField("returnDriveMinutes", text)
                      }
                      style={styles.adjustInput}
                      keyboardType="numeric"
                      placeholder="ONE_WAY để 0"
                      placeholderTextColor="#98a2b3"
                    />

                    <Text style={styles.inputLabel}>
                      Tổng thời gian lái xe (phút)
                    </Text>
                    <TextInput
                      value={adjustForm.totalDriveMinutes}
                      onChangeText={(text) =>
                        updateAdjustField("totalDriveMinutes", text)
                      }
                      style={styles.adjustInput}
                      keyboardType="numeric"
                      placeholder="VD: 147"
                      placeholderTextColor="#98a2b3"
                    />

                    <Text style={styles.inputLabel}>
                      Ghi chú xác nhận nội bộ
                    </Text>
                    <TextInput
                      value={adjustForm.verifiedNote}
                      onChangeText={(text) =>
                        updateAdjustField("verifiedNote", text)
                      }
                      style={[styles.adjustInput, styles.adjustTextarea]}
                      multiline
                      placeholder="Nhập ghi chú xác nhận"
                      placeholderTextColor="#98a2b3"
                    />

                    <View style={styles.adjustActionRow}>
                      <Pressable
                        style={styles.adjustCancelButton}
                        onPress={() => setIsAdjusting(false)}
                        disabled={adjustLoading}
                      >
                        <Text style={styles.adjustCancelButtonText}>
                          Huỷ chỉnh
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.adjustSaveButton,
                          adjustLoading && styles.buttonDisabled,
                        ]}
                        onPress={handleManualAdjustTrip}
                        disabled={adjustLoading}
                      >
                        <Text style={styles.adjustSaveButtonText}>
                          {adjustLoading ? "Đang lưu..." : "Lưu cập nhật"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {tab === "PENDING" ? (
                  <View style={styles.actionCard}>
                    <Text style={styles.detailCardTitle}>Xử lý chuyến</Text>

                    <Pressable
                      style={[
                        styles.adjustButton,
                        actionLoading !== "" && styles.buttonDisabled,
                      ]}
                      onPress={openAdjustForm}
                      disabled={actionLoading !== ""}
                    >
                      <Text style={styles.adjustButtonText}>
                        Cập nhật thông tin chuyến
                      </Text>
                    </Pressable>

                    <TextInput
                      value={cancelReason}
                      onChangeText={setCancelReason}
                      placeholder="Nhập lý do huỷ nếu muốn huỷ chuyến..."
                      placeholderTextColor="#98a2b3"
                      multiline
                      style={styles.cancelInput}
                    />

                    <Pressable
                      style={[
                        styles.verifyButton,
                        actionLoading !== "" && styles.buttonDisabled,
                      ]}
                      onPress={handleVerifyTrip}
                      disabled={actionLoading !== ""}
                    >
                      <Text style={styles.verifyButtonText}>
                        {actionLoading === "VERIFY"
                          ? "Đang duyệt..."
                          : "Duyệt chuyến"}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.cancelButton,
                        actionLoading !== "" && styles.buttonDisabled,
                      ]}
                      onPress={handleCancelTrip}
                      disabled={actionLoading !== ""}
                    >
                      <Text style={styles.cancelButtonText}>
                        {actionLoading === "CANCEL"
                          ? "Đang huỷ..."
                          : "Huỷ chuyến"}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </ScrollView>
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Không có chi tiết</Text>
                <Text style={styles.emptyText}>
                  Không tải được dữ liệu chuyến.
                </Text>
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f8fa",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d0d5dd",
    marginBottom: 18,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1565c0",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1565c0",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#667085",
    lineHeight: 22,
    marginBottom: 18,
  },
  tabRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d0d5dd",
    paddingVertical: 13,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "#e8f1ff",
    borderColor: "#1565c0",
  },
  tabButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#667085",
  },
  tabButtonTextActive: {
    color: "#1565c0",
  },
  searchInput: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d0d5dd",
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: "#101828",
    marginBottom: 12,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: "#667085",
  },
  listContent: {
    paddingTop: 2,
    paddingBottom: 30,
    gap: 12,
  },
  tripCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
  },
  tripCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  tripId: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    color: "#344054",
  },
  pendingBadge: {
    backgroundColor: "#eff8ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#175cd3",
  },
  cancelledBadge: {
    backgroundColor: "#fef3f2",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cancelledBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#d92d20",
  },
  customerName: {
    fontSize: 17,
    fontWeight: "900",
    color: "#101828",
    marginBottom: 4,
  },
  customerPhone: {
    fontSize: 14,
    color: "#667085",
    marginBottom: 12,
  },
  identityBlock: {
    marginBottom: 2,
  },

  identityLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#667085",
    marginBottom: 6,
  },

  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  identityInfo: {
    flex: 1,
  },

  copyMiniButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },

  copyMiniButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563eb",
  },
  sectionBlock: {
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: "900",
    color: "#667085",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 15,
    color: "#101828",
    lineHeight: 22,
  },
  destinationItem: {
    fontSize: 15,
    color: "#101828",
    lineHeight: 22,
    marginBottom: 4,
  },
  operationalBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 2,
    marginBottom: 10,
    gap: 4,
  },

  operationalLine: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
    marginTop: 4,
  },
  pickupTimeBox: {
    flex: 1,
  },
  priceBox: {
    alignItems: "flex-end",
    maxWidth: 130,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1565c0",
  },
  cancelReasonBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f2f5",
  },
  cancelReasonLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#d92d20",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  cancelReasonText: {
    fontSize: 14,
    color: "#7a271a",
    lineHeight: 20,
  },
  detailHint: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "800",
    color: "#1565c0",
  },
  emptyBox: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 20,
    alignItems: "center",
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#101828",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: "#667085",
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#f7f8fa",
  },
  modalKeyboardView: {
    flex: 1,
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  modalCloseButton: {
    minWidth: 56,
  },
  modalCloseText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1565c0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#101828",
  },
  modalClosePlaceholder: {
    minWidth: 56,
  },
  modalScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 34,
    gap: 14,
  },
  detailCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
  },
  actionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    marginBottom: 20,
  },
  detailCardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#101828",
    marginBottom: 14,
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#667085",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 15,
    color: "#101828",
    lineHeight: 22,
  },
  detailValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  detailValueText: {
    flex: 1,
  },
  copyPhoneButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  copyPhoneButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563eb",
  },
  detailPrice: {
    color: "#1565c0",
    fontWeight: "900",
  },
  stopListWrap: {
    marginBottom: 12,
  },
  stopItem: {
    fontSize: 15,
    color: "#101828",
    lineHeight: 22,
    marginBottom: 4,
  },
  cancelInput: {
    minHeight: 96,
    maxHeight: 180,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d0d5dd",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#101828",
    textAlignVertical: "top",
    marginBottom: 12,
  },
  verifyButton: {
    backgroundColor: "#1565c0",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  verifyButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#ffffff",
  },
  cancelButton: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f04438",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#f04438",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  adjustButton: {
    backgroundColor: "#f97316",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },

  adjustButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },

  adjustCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#fed7aa",
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#344054",
    marginTop: 12,
    marginBottom: 6,
  },

  adjustInput: {
    borderWidth: 1,
    borderColor: "#d0d5dd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: "#101828",
    backgroundColor: "#fff",
  },

  adjustTextarea: {
    minHeight: 82,
    textAlignVertical: "top",
  },

  adjustStopRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 8,
  },

  adjustStopInput: {
    flex: 1,
  },

  removeStopButton: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },

  removeStopButtonText: {
    color: "#b91c1c",
    fontWeight: "800",
  },

  addStopButton: {
    alignSelf: "flex-start",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },

  addStopButtonText: {
    color: "#1d4ed8",
    fontWeight: "800",
  },

  adjustActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  adjustCancelButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#f2f4f7",
  },

  adjustCancelButtonText: {
    color: "#344054",
    fontWeight: "800",
  },

  adjustSaveButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#f97316",
  },

  adjustSaveButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  choiceButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#d0d5dd",
    backgroundColor: "#fff",
  },

  choiceButtonActive: {
    borderColor: "#f97316",
    backgroundColor: "#fff7ed",
  },

  choiceButtonText: {
    color: "#344054",
    fontWeight: "800",
  },

  choiceButtonTextActive: {
    color: "#c2410c",
  },
});
