// Path: goviet247/apps/admin-mobile/app/assigned-trips.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Alert,
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
  AssignedTripDetail,
  AssignedTripItem,
  AssignedTripsTabStatus,
  cancelAssignedTrip,
  changeAssignedTripStatus,
  fetchAssignedTripDetail,
  fetchAssignedTrips,
  updateAssignedTripSchedule,
} from "../services/assignedTripsApi";

type TabItem = {
  key: AssignedTripsTabStatus;
  label: string;
};

const TABS: TabItem[] = [
  { key: "ACCEPTED", label: "Chưa liên hệ khách" },
  { key: "CONTACTED", label: "Chưa đón khách" },
  { key: "IN_PROGRESS", label: "Đang trên hành trình" },
  { key: "COMPLETED", label: "Đã hoàn thành" },
  { key: "CANCELLED", label: "Đã huỷ" },
];

function formatDateTime(value?: string | null) {
  if (!value) return "--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleString("vi-VN");
}

function formatScheduleInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseScheduleInput(value: string) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, day, month, year, hour, minute] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  if (
    date.getFullYear() !== year || date.getMonth() !== month - 1 ||
    date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute
  ) return null;
  return date.toISOString();
}

function formatCarType(value?: string | null) {
  const type = String(value || "").toUpperCase();

  switch (type) {
    case "CAR_4":
      return "4 chỗ";

    case "CAR_5":
      return "5 chỗ";

    case "CAR_7":
      return "7 chỗ";

    case "CAR_16":
      return "16 chỗ";

    default:
      return value || "--";
  }
}

function formatFuelPreference(value?: string | null) {
  switch (String(value || "ANY").toUpperCase()) {
    case "ELECTRIC":
      return "Xe điện";
    case "GASOLINE":
      return "Xe xăng";
    case "ANY":
    default:
      return "Không yêu cầu";
  }
}

function formatDistanceKm(value?: number | null) {
  if (value == null) return "--";

  return `${Number(value).toLocaleString("vi-VN")} km`;
}

function formatMinutesToHours(minutes?: number | null) {
  if (minutes == null) return "--";

  const totalMinutes = Number(minutes);

  const hours = Math.floor(totalMinutes / 60);
  const remainMinutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${remainMinutes} phút`;
  }

  if (remainMinutes <= 0) {
    return `${hours} giờ`;
  }

  return `${hours} giờ ${remainMinutes} phút`;
}

function getReturnTimeStatusText(returnTime?: string | null) {
  if (!returnTime) return null;

  const returnDate = new Date(returnTime);

  if (Number.isNaN(returnDate.getTime())) {
    return null;
  }

  const now = new Date();

  const diffMs = returnDate.getTime() - now.getTime();

  const isOverdue = diffMs < 0;

  const absMinutes = Math.floor(Math.abs(diffMs) / (1000 * 60));

  const days = Math.floor(absMinutes / (60 * 24));
  const hours = Math.floor((absMinutes % (60 * 24)) / 60);
  const minutes = absMinutes % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} ngày`);
  }

  if (hours > 0) {
    parts.push(`${hours} giờ`);
  }

  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} phút`);
  }

  const timeText = parts.join(" ");

  if (isOverdue) {
    return `⚠️ Quá giờ về ${timeText}`;
  }

  return `Còn ~${timeText} tới giờ về`;
}

function getStatusLabel(status?: string | null) {
  switch (String(status || "").toUpperCase()) {
    case "ACCEPTED":
      return "CHƯA LIÊN HỆ";
    case "CONTACTED":
      return "CHƯA ĐÓN KHÁCH";
    case "IN_PROGRESS":
      return "ĐANG HÀNH TRÌNH";
    case "COMPLETED":
      return "HOÀN THÀNH";
    case "CANCELLED":
      return "ĐÃ HUỶ";
    default:
      return status || "--";
  }
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

function getAssignedTripOriginLabel(cancelReason?: string | null) {
  const reason = String(cancelReason || "")
    .trim()
    .toLowerCase();

  if (reason.includes("driver") || reason.includes("tài xế")) {
    return "Tài xế huỷ";
  }

  return "Mới";
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

function getNextActionConfig(tab: AssignedTripsTabStatus) {
  switch (tab) {
    case "ACCEPTED":
      return {
        toStatus: "CONTACTED" as const,
        buttonLabel: 'Chuyển qua "Chưa đón khách"',
        modalTitle: "Xác nhận chuyển trạng thái",
        placeholder: "Nhập ghi chú, ví dụ: tài xế đã liên hệ khách.",
      };

    case "CONTACTED":
      return {
        toStatus: "IN_PROGRESS" as const,
        buttonLabel: 'Chuyển qua "Đang trên hành trình"',
        modalTitle: "Xác nhận chuyển trạng thái",
        placeholder: "Nhập ghi chú, ví dụ: đã đón khách và bắt đầu đi.",
      };

    case "IN_PROGRESS":
      return {
        toStatus: "COMPLETED" as const,
        buttonLabel: 'Chuyển qua "Đã hoàn thành"',
        modalTitle: "Xác nhận hoàn thành chuyến",
        placeholder: "Nhập ghi chú, ví dụ: đã trả khách thành công.",
      };

    default:
      return null;
  }
}

function canCancelTrip(tab: AssignedTripsTabStatus) {
  return tab === "ACCEPTED" || tab === "CONTACTED" || tab === "IN_PROGRESS";
}

function removeTripFromList(
  list: AssignedTripItem[],
  tripId: string,
): AssignedTripItem[] {
  return list.filter((item) => item.id !== tripId);
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

export default function AssignedTripsScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const requestedTab = String(params.tab || "").toUpperCase();
  const initialTab = TABS.some((item) => item.key === requestedTab)
    ? (requestedTab as AssignedTripsTabStatus)
    : "ACCEPTED";
  const [tab, setTab] = useState<AssignedTripsTabStatus>(initialTab);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [items, setItems] = useState<AssignedTripItem[]>([]);
  const [errorText, setErrorText] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [selectedTripDetail, setSelectedTripDetail] =
    useState<AssignedTripDetail | null>(null);

  const [changeStatusSubmitting, setChangeStatusSubmitting] = useState(false);
  const [statusNote, setStatusNote] = useState("");

  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [scheduleEditing, setScheduleEditing] = useState(false);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [pickupTimeInput, setPickupTimeInput] = useState("");
  const [returnTimeInput, setReturnTimeInput] = useState("");

  const loadData = useCallback(
    async (status: AssignedTripsTabStatus, isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorText("");
        const data = await fetchAssignedTrips(status);
        setItems(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("fetchAssignedTrips error:", error);
        setItems([]);
        setErrorText(
          error instanceof Error
            ? error.message
            : "Không tải được danh sách chuyến.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadData(tab);
  }, [tab, loadData]);

  useEffect(() => {
    if (TABS.some((item) => item.key === requestedTab)) {
      setTab(requestedTab as AssignedTripsTabStatus);
    }
  }, [requestedTab]);

  async function openTripDetail(tripId: string) {
    try {
      setSelectedTripId(tripId);
      setDetailOpen(true);
      setDetailLoading(true);
      setSelectedTripDetail(null);

      const detail = await fetchAssignedTripDetail(tripId);
      setSelectedTripDetail(detail);
      setScheduleEditing(false);
      setPickupTimeInput(formatScheduleInput(detail.pickupTime));
      setReturnTimeInput(formatScheduleInput(detail.returnTime));
    } catch (error) {
      console.error("fetchAssignedTripDetail error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Không tải được chi tiết chuyến.";

      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(message);
      } else {
        Alert.alert("Lỗi", message);
      }
    } finally {
      setDetailLoading(false);
    }
  }

  async function submitScheduleUpdate() {
    const pickupTime = parseScheduleInput(pickupTimeInput);
    const isRoundTrip = getTripTypeLabel(
      selectedTripDetail?.tripType,
      selectedTripDetail?.returnTime,
    ) === "Khứ hồi";
    const returnTime = returnTimeInput.trim()
      ? parseScheduleInput(returnTimeInput)
      : null;

    if (!pickupTime) {
      Alert.alert("Giờ đón không hợp lệ", "Nhập theo định dạng DD/MM/YYYY HH:mm.");
      return;
    }
    if (isRoundTrip && !returnTime) {
      Alert.alert("Giờ về không hợp lệ", "Chuyến khứ hồi cần giờ về theo định dạng DD/MM/YYYY HH:mm.");
      return;
    }
    if (returnTime && new Date(returnTime) <= new Date(pickupTime)) {
      Alert.alert("Giờ về không hợp lệ", "Giờ về phải sau giờ đón.");
      return;
    }

    try {
      setScheduleSubmitting(true);
      await updateAssignedTripSchedule(selectedTripId, pickupTime, returnTime);
      setSelectedTripDetail((current) =>
        current
          ? { ...current, pickupTime, returnTime, updatedAt: new Date().toISOString() }
          : current,
      );
      setScheduleEditing(false);
      Alert.alert("Thành công", "Đã cập nhật giờ đón, giờ về.");
      void loadData(tab, true);
    } catch (error) {
      Alert.alert(
        "Lỗi",
        error instanceof Error ? error.message : "Không thể cập nhật giờ chuyến.",
      );
    } finally {
      setScheduleSubmitting(false);
    }
  }

  function closeTripDetail() {
    setDetailOpen(false);
    setDetailLoading(false);
    setSelectedTripId("");
    setSelectedTripDetail(null);
  }

  async function submitChangeStatus() {
    const action = getNextActionConfig(tab);
    if (!action) return;

    const trimmedNote = statusNote.trim();
    if (!trimmedNote) {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert("Vui lòng nhập ghi chú.");
      } else {
        Alert.alert("Thiếu ghi chú", "Vui lòng nhập ghi chú.");
      }
      return;
    }

    try {
      setChangeStatusSubmitting(true);

      const currentTripId = selectedTripId;

      await changeAssignedTripStatus(
        currentTripId,
        action.toStatus,
        trimmedNote,
      );

      setItems((prev) => removeTripFromList(prev, currentTripId));

      setSelectedTripId("");
      setStatusNote("");

      if (detailOpen && currentTripId) {
        closeTripDetail();
      }

      loadData(tab, true).catch((error) => {
        console.error(
          "reload assigned trips after change status error:",
          error,
        );
      });

      const successMessage = "Cập nhật trạng thái chuyến thành công.";

      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(successMessage);
      } else {
        Alert.alert("Thành công", successMessage);
      }
    } catch (error) {
      console.error("changeAssignedTripStatus error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Không thể cập nhật trạng thái chuyến.";

      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(message);
      } else {
        Alert.alert("Lỗi", message);
      }
    } finally {
      setChangeStatusSubmitting(false);
    }
  }

  async function submitCancelTrip() {
    const trimmedReason = cancelReason.trim();

    if (!trimmedReason) {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert("Vui lòng nhập lý do huỷ chuyến.");
      } else {
        Alert.alert("Thiếu lý do", "Vui lòng nhập lý do huỷ chuyến.");
      }
      return;
    }

    try {
      setCancelSubmitting(true);

      const currentTripId = selectedTripId;

      await cancelAssignedTrip(currentTripId, trimmedReason);

      setItems((prev) => removeTripFromList(prev, currentTripId));

      setSelectedTripId("");
      setCancelReason("");

      if (detailOpen && currentTripId) {
        closeTripDetail();
      }

      loadData(tab, true).catch((error) => {
        console.error("reload assigned trips after cancel trip error:", error);
      });

      const successMessage = "Huỷ chuyến thành công.";

      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(successMessage);
      } else {
        Alert.alert("Thành công", successMessage);
      }
    } catch (error) {
      console.error("cancelAssignedTrip error:", error);

      const message =
        error instanceof Error ? error.message : "Không thể huỷ chuyến.";

      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(message);
      } else {
        Alert.alert("Lỗi", message);
      }
    } finally {
      setCancelSubmitting(false);
    }
  }

  const actionConfig = useMemo(() => getNextActionConfig(tab), [tab]);

  const filteredItems = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return items;

    return items.filter((item) => {
      const haystack = [
        item.id,
        item.riderName,
        item.riderPhone,
        item.driverName,
        item.driverPhone,
        item.pickupAddress,
        item.dropoffAddress,
        ...(item.stops || []).map((stop) => stop?.address || ""),
        item.cancelReason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [items, searchText]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.replace("/home")}
          >
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>

          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Chuyến Tài Xế Đã Nhận</Text>
            <Text style={styles.subtitle}>
              Quản lý các chuyến theo trạng thái
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          style={styles.tabsScroll}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {TABS.map((item) => {
            const active = item.key === tab;

            return (
              <Pressable
                key={item.key}
                style={[styles.tabButton, active && styles.tabButtonActive]}
                onPress={() => setTab(item.key)}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    active && styles.tabButtonTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.searchWrap}>
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Tìm mã chuyến, khách hàng, tài xế..."
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
          />
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#f97316" />
            <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadData(tab, true)}
              />
            }
          >
            {errorText ? (
              <View style={styles.messageCard}>
                <Text style={styles.errorText}>{errorText}</Text>
              </View>
            ) : null}

            {!errorText && filteredItems.length === 0 ? (
              <View style={styles.messageCard}>
                <Text style={styles.emptyText}>Không có chuyến nào.</Text>
              </View>
            ) : null}

            {filteredItems.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.tripId}>{item.id}</Text>
                  <View style={styles.statusChip}>
                    <Text style={styles.statusChipText}>
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoBlock}>
                  <Text style={styles.label}>Khách hàng</Text>
                  <View style={styles.phoneValueRow}>
                    <Text style={[styles.value, styles.phoneValueText]}>
                      {item.riderName || "--"}
                      {item.riderPhone ? ` • ${item.riderPhone}` : ""}
                    </Text>

                    {item.riderPhone ? (
                      <Pressable
                        style={styles.copyPhoneButton}
                        onPress={() => copyPhoneToClipboard(item.riderPhone)}
                      >
                        <Text style={styles.copyPhoneButtonText}>Copy</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <View style={styles.infoBlock}>
                  <Text style={styles.label}>Tài xế</Text>
                  <View style={styles.phoneValueRow}>
                    <Text style={[styles.value, styles.phoneValueText]}>
                      {item.driverName || "--"}
                      {item.driverPhone ? ` • ${item.driverPhone}` : ""}
                    </Text>

                    {item.driverPhone ? (
                      <Pressable
                        style={styles.copyPhoneButton}
                        onPress={() => copyPhoneToClipboard(item.driverPhone)}
                      >
                        <Text style={styles.copyPhoneButtonText}>Copy</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <View style={styles.infoBlock}>
                  <Text style={styles.label}>Điểm đón</Text>
                  <Text style={styles.value}>{item.pickupAddress || "--"}</Text>
                </View>

                <View style={styles.infoBlock}>
                  <Text style={styles.label}>Điểm đến</Text>

                  {buildDestinationList(item.dropoffAddress, item.stops)
                    .length > 0 ? (
                    buildDestinationList(item.dropoffAddress, item.stops).map(
                      (address, index) => (
                        <Text
                          key={`${index}-${address}`}
                          style={styles.destinationItem}
                        >
                          Điểm đến {index + 1}: {address}
                        </Text>
                      ),
                    )
                  ) : (
                    <Text style={styles.value}>--</Text>
                  )}
                </View>

                <View style={styles.tripMetaGrid}>
                  <View style={styles.tripMetaCard}>
                    <Text style={styles.tripMetaLabel}>Loại xe</Text>

                    <Text style={styles.tripMetaValue}>
                      {formatCarType(item.carType)}
                    </Text>
                  </View>

                  <View style={styles.tripMetaCard}>
                    <Text style={styles.tripMetaLabel}>Loại nhiên liệu</Text>
                    <Text style={styles.tripMetaValue}>
                      {formatFuelPreference(item.fuelPreference)}
                    </Text>
                  </View>

                  <View style={styles.tripMetaCard}>
                    <Text style={styles.tripMetaLabel}>Quãng đường</Text>

                    <Text style={styles.tripMetaValue}>
                      {formatDistanceKm(item.distanceKm)}
                    </Text>
                  </View>

                  <View style={styles.tripMetaCard}>
                    <Text style={styles.tripMetaLabel}>TG tài xế lái</Text>

                    <Text style={styles.tripMetaValue}>
                      {formatMinutesToHours(item.totalDriveMinutes)}
                    </Text>
                  </View>

                  <View style={styles.tripMetaCard}>
                    <Text style={styles.tripMetaLabel}>Tổng TG chuyến</Text>

                    <Text style={styles.tripMetaValue}>
                      {formatMinutesToHours(item.estimatedDurationMinutes)}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoColumn}>
                    <Text style={styles.label}>Giờ đón</Text>
                    <Text style={styles.value}>
                      {formatDateTime(item.pickupTime)}
                    </Text>
                  </View>

                  <View style={styles.infoColumn}>
                    <Text style={styles.label}>Giá chuyến</Text>
                    <Text style={styles.value}>
                      {item.totalPrice != null
                        ? `${Number(item.totalPrice).toLocaleString("vi-VN")}đ`
                        : "--"}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoColumn}>
                    <Text style={styles.label}>Giờ về</Text>

                    <Text style={styles.value}>
                      {formatDateTime(item.returnTime)}
                    </Text>

                    {item.returnTime ? (
                      <Text style={styles.returnTimeHint}>
                        {getReturnTimeStatusText(item.returnTime)}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.infoColumn}>
                    <Text style={styles.label}>Cập nhật</Text>

                    <Text style={styles.value}>
                      {formatDateTime(item.updatedAt)}
                    </Text>
                  </View>

                  {tab === "CANCELLED" ? (
                    <View style={styles.infoColumn}>
                      <Text style={styles.label}>Lý do huỷ</Text>

                      <Text style={styles.value}>
                        {item.cancelReason || "--"}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.cardActions}>
                  <Pressable
                    style={styles.detailButton}
                    onPress={() => openTripDetail(item.id)}
                  >
                    <Text style={styles.detailButtonText}>Xem chi tiết</Text>
                  </Pressable>

                  {actionConfig ? (
                    <Pressable
                      style={styles.primaryActionButton}
                      onPress={() => {
                        setSelectedTripId(item.id);
                        setDetailOpen(true);
                        void openTripDetail(item.id);
                      }}
                    >
                      <Text style={styles.primaryActionButtonText}>
                        {actionConfig.buttonLabel}
                      </Text>
                    </Pressable>
                  ) : null}

                  {canCancelTrip(tab) ? (
                    <Pressable
                      style={styles.dangerActionButton}
                      onPress={() => {
                        setSelectedTripId(item.id);
                        setDetailOpen(true);
                        void openTripDetail(item.id);
                      }}
                    >
                      <Text style={styles.dangerActionButtonText}>
                        Huỷ chuyến
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
      <Modal
        visible={detailOpen}
        transparent
        animationType="fade"
        onRequestClose={closeTripDetail}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlayCenter}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalSheetCentered}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết chuyến</Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={closeTripDetail}
              >
                <Text style={styles.modalCloseButtonText}>Đóng</Text>
              </Pressable>
            </View>

            {detailLoading ? (
              <View style={styles.modalLoadingBox}>
                <ActivityIndicator size="large" color="#f97316" />
                <Text style={styles.loadingText}>Đang tải chi tiết...</Text>
              </View>
            ) : (
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
              >
                <View style={styles.modalInfoBlock}>
                  <Text style={styles.label}>Mã chuyến</Text>
                  <Text style={styles.value}>
                    {selectedTripDetail?.id || selectedTripId || "--"}
                  </Text>
                </View>

                <View style={styles.modalInfoBlock}>
                  <Text style={styles.label}>Trạng thái</Text>
                  <Text style={styles.value}>
                    {getStatusLabel(selectedTripDetail?.status)}
                  </Text>
                </View>

                <View style={styles.modalInfoBlock}>
                  <Text style={styles.label}>Khách hàng</Text>
                  <View style={styles.phoneValueRow}>
                    <Text style={[styles.value, styles.phoneValueText]}>
                      {selectedTripDetail?.riderName || "--"}
                      {selectedTripDetail?.riderPhone
                        ? ` • ${selectedTripDetail.riderPhone}`
                        : ""}
                    </Text>

                    {selectedTripDetail?.riderPhone ? (
                      <Pressable
                        style={styles.copyPhoneButton}
                        onPress={() =>
                          copyPhoneToClipboard(selectedTripDetail.riderPhone)
                        }
                      >
                        <Text style={styles.copyPhoneButtonText}>Copy</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <View style={styles.modalInfoBlock}>
                  <Text style={styles.label}>Tài xế</Text>
                  <View style={styles.phoneValueRow}>
                    <Text style={[styles.value, styles.phoneValueText]}>
                      {selectedTripDetail?.driverName || "--"}
                      {selectedTripDetail?.driverPhone
                        ? ` • ${selectedTripDetail.driverPhone}`
                        : ""}
                    </Text>

                    {selectedTripDetail?.driverPhone ? (
                      <Pressable
                        style={styles.copyPhoneButton}
                        onPress={() =>
                          copyPhoneToClipboard(selectedTripDetail.driverPhone)
                        }
                      >
                        <Text style={styles.copyPhoneButtonText}>Copy</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <View style={[styles.modalInfoBlock, styles.highlightInfoBlock]}>
                  <Text style={styles.label}>Điểm đón</Text>
                  <Text style={styles.value}>
                    {selectedTripDetail?.pickupAddress || "--"}
                  </Text>
                </View>

                <View style={[styles.modalInfoBlock, styles.highlightInfoBlock]}>
                  <Text style={styles.label}>Điểm đến</Text>

                  {buildDestinationList(
                    selectedTripDetail?.dropoffAddress,
                    selectedTripDetail?.stops,
                  ).length > 0 ? (
                    buildDestinationList(
                      selectedTripDetail?.dropoffAddress,
                      selectedTripDetail?.stops,
                    ).map((address, index) => (
                      <Text
                        key={`${index}-${address}`}
                        style={styles.destinationItem}
                      >
                        Điểm đến {index + 1}: {address}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.value}>--</Text>
                  )}
                </View>
                <View style={styles.tripMetaGrid}>
                  <View style={styles.tripMetaCard}>
                    <Text style={styles.tripMetaLabel}>Loại xe</Text>

                    <Text style={styles.tripMetaValue}>
                      {formatCarType(selectedTripDetail?.carType)}
                    </Text>
                  </View>

                  <View style={styles.tripMetaCard}>
                    <Text style={styles.tripMetaLabel}>Loại nhiên liệu</Text>
                    <Text style={styles.tripMetaValue}>
                      {formatFuelPreference(selectedTripDetail?.fuelPreference)}
                    </Text>
                  </View>

                  <View style={styles.tripMetaCard}>
                    <Text style={styles.tripMetaLabel}>Quãng đường</Text>

                    <Text style={styles.tripMetaValue}>
                      {formatDistanceKm(selectedTripDetail?.distanceKm)}
                    </Text>
                  </View>

                  <View style={styles.tripMetaCard}>
                    <Text style={styles.tripMetaLabel}>TG tài xế lái</Text>

                    <Text style={styles.tripMetaValue}>
                      {formatMinutesToHours(
                        selectedTripDetail?.totalDriveMinutes,
                      )}
                    </Text>
                  </View>

                  <View style={styles.tripMetaCard}>
                    <Text style={styles.tripMetaLabel}>Tổng TG chuyến</Text>

                    <Text style={styles.tripMetaValue}>
                      {formatMinutesToHours(
                        selectedTripDetail?.estimatedDurationMinutes,
                      )}
                    </Text>
                  </View>
                </View>
                <View style={styles.modalInfoBlock}>
                  <Text style={styles.label}>Loại chuyến</Text>
                  <Text style={styles.value}>
                    {getTripTypeLabel(
                      selectedTripDetail?.tripType,
                      selectedTripDetail?.returnTime,
                    )}
                  </Text>
                </View>

                {["ACCEPTED", "CONTACTED"].includes(
                  String(selectedTripDetail?.status || ""),
                ) ? (
                  <View style={styles.actionInlineCard}>
                    <Text style={styles.inlineCardTitle}>Cập nhật giờ đón, giờ về</Text>
                    {scheduleEditing ? (
                      <>
                        <Text style={styles.scheduleHint}>Định dạng: DD/MM/YYYY HH:mm</Text>
                        <Text style={styles.label}>Giờ đón</Text>
                        <TextInput
                          value={pickupTimeInput}
                          onChangeText={setPickupTimeInput}
                          placeholder="29/08/2026 08:00"
                          placeholderTextColor="#94a3b8"
                          style={styles.scheduleInput}
                          editable={!scheduleSubmitting}
                        />
                        {getTripTypeLabel(
                          selectedTripDetail?.tripType,
                          selectedTripDetail?.returnTime,
                        ) === "Khứ hồi" ? (
                          <>
                            <Text style={styles.label}>Giờ về</Text>
                            <TextInput
                              value={returnTimeInput}
                              onChangeText={setReturnTimeInput}
                              placeholder="30/08/2026 17:00"
                              placeholderTextColor="#94a3b8"
                              style={styles.scheduleInput}
                              editable={!scheduleSubmitting}
                            />
                          </>
                        ) : null}
                        <View style={styles.confirmActions}>
                          <Pressable
                            style={styles.cancelButton}
                            onPress={() => setScheduleEditing(false)}
                            disabled={scheduleSubmitting}
                          >
                            <Text style={styles.cancelButtonText}>Huỷ</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.submitButton, scheduleSubmitting && styles.submitButtonDisabled]}
                            onPress={submitScheduleUpdate}
                            disabled={scheduleSubmitting}
                          >
                            <Text style={styles.submitButtonText}>
                              {scheduleSubmitting ? "Đang lưu..." : "Lưu giờ mới"}
                            </Text>
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <Pressable style={styles.submitButton} onPress={() => setScheduleEditing(true)}>
                        <Text style={styles.submitButtonText}>Sửa giờ chuyến</Text>
                      </Pressable>
                    )}
                  </View>
                ) : null}

                <View style={styles.modalInfoBlock}>
                  <Text style={styles.label}>Loại</Text>
                  <Text style={styles.value}>
                    {getAssignedTripOriginLabel(
                      selectedTripDetail?.cancelReason,
                    )}
                  </Text>
                </View>

                <View style={[styles.modalInfoBlock, styles.highlightInfoBlock]}>
                  <Text style={styles.label}>Giờ đón</Text>
                  <Text style={styles.value}>
                    {formatDateTime(selectedTripDetail?.pickupTime)}
                  </Text>
                </View>

                <View style={[styles.modalInfoBlock, styles.highlightInfoBlock]}>
                  <Text style={styles.label}>Giờ về</Text>

                  <Text style={styles.value}>
                    {formatDateTime(selectedTripDetail?.returnTime)}
                  </Text>

                  {selectedTripDetail?.returnTime ? (
                    <Text style={styles.returnTimeHint}>
                      {getReturnTimeStatusText(selectedTripDetail.returnTime)}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.modalInfoBlock}>
                  <Text style={styles.label}>Cập nhật</Text>
                  <Text style={styles.value}>
                    {formatDateTime(selectedTripDetail?.updatedAt)}
                  </Text>
                </View>

                <View style={styles.modalInfoBlock}>
                  <Text style={styles.label}>Giá chuyến</Text>
                  <Text style={styles.value}>
                    {selectedTripDetail?.totalPrice != null
                      ? `${Number(selectedTripDetail.totalPrice).toLocaleString("vi-VN")}đ`
                      : "--"}
                  </Text>
                </View>

                <View style={[styles.modalInfoBlock, styles.highlightInfoBlock]}>
                  <Text style={styles.label}>Ghi chú</Text>
                  <Text style={styles.value}>
                    {selectedTripDetail?.note || "--"}
                  </Text>
                </View>
                {actionConfig ? (
                  <View style={styles.actionInlineCard}>
                    <Text style={styles.inlineCardTitle}>
                      Chuyển trạng thái chuyến
                    </Text>

                    <TextInput
                      value={statusNote}
                      onChangeText={setStatusNote}
                      placeholder={actionConfig.placeholder}
                      placeholderTextColor="#94a3b8"
                      multiline
                      textAlignVertical="top"
                      style={styles.noteInput}
                      editable={!changeStatusSubmitting}
                    />

                    <Pressable
                      style={[
                        styles.submitButton,
                        changeStatusSubmitting && styles.submitButtonDisabled,
                      ]}
                      onPress={submitChangeStatus}
                      disabled={changeStatusSubmitting}
                    >
                      <Text style={styles.submitButtonText}>
                        {changeStatusSubmitting
                          ? "Đang xử lý..."
                          : actionConfig.buttonLabel}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                {canCancelTrip(tab) ? (
                  <View style={styles.actionInlineCard}>
                    <Text style={styles.inlineCardTitle}>Huỷ chuyến</Text>

                    <TextInput
                      value={cancelReason}
                      onChangeText={setCancelReason}
                      placeholder="Ví dụ: khách đổi kế hoạch..."
                      placeholderTextColor="#94a3b8"
                      multiline
                      textAlignVertical="top"
                      style={styles.noteInput}
                      editable={!cancelSubmitting}
                    />

                    <Pressable
                      style={[
                        styles.dangerSubmitButton,
                        cancelSubmitting && styles.submitButtonDisabled,
                      ]}
                      onPress={submitCancelTrip}
                      disabled={cancelSubmitting}
                    >
                      <Text style={styles.submitButtonText}>
                        {cancelSubmitting ? "Đang xử lý..." : "Xác nhận huỷ"}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginRight: 10,
  },
  backButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748b",
  },
  tabsScroll: {
    maxHeight: 52,
    flexGrow: 0,
  },

  tabsContainer: {
    paddingBottom: 4,
    gap: 8,
    alignItems: "center",
  },

  tabButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tabButtonActive: {
    backgroundColor: "#fff7ed",
    borderColor: "#f97316",
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  tabButtonTextActive: {
    color: "#ea580c",
  },
  searchWrap: {
    marginTop: 12,
    marginBottom: 12,
  },
  searchInput: {
    height: 46,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#0f172a",
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: "#64748b",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 34,
    gap: 12,
  },
  messageCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
  },
  errorText: {
    fontSize: 14,
    color: "#dc2626",
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  tripId: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    alignSelf: "flex-start",
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#334155",
    textAlign: "center",
  },
  infoBlock: {
    gap: 4,
  },
  infoRow: {
    flexDirection: "row",
    gap: 12,
  },
  infoColumn: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
  },
  value: {
    fontSize: 14,
    lineHeight: 20,
    color: "#0f172a",
    fontWeight: "600",
  },
  returnTimeHint: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#ea580c",
  },
  tripMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  tripMetaCard: {
    width: "47%",
    backgroundColor: "#eff6ff",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  tripMetaLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    marginBottom: 4,
    textTransform: "uppercase",
  },

  tripMetaValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
    lineHeight: 20,
  },
  destinationItem: {
    fontSize: 14,
    lineHeight: 20,
    color: "#0f172a",
    fontWeight: "600",
    marginBottom: 4,
  },
  detailButton: {
    marginTop: 2,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  cardActions: {
    marginTop: 2,
    gap: 10,
  },

  primaryActionButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  primaryActionButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
    textAlign: "center",
  },

  dangerActionButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fca5a5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  dangerActionButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#dc2626",
    textAlign: "center",
  },

  dangerSubmitButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },

  modalOverlayCenter: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },

  modalSheet: {
    maxHeight: "84%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },

  modalSheetCentered: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "92%",
    backgroundColor: "#ffffff",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
  },

  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },

  modalCloseButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  modalCloseButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },

  modalLoadingBox: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  modalScroll: {
    flexGrow: 0,
  },

  modalScrollContent: {
    paddingBottom: 120,
    gap: 12,
  },

  modalInfoBlock: {
    gap: 4,
  },
  highlightInfoBlock: {
    backgroundColor: "#fff8df",
    borderColor: "#f3c969",
    borderLeftColor: "#e6a700",
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 12,
  },

  phoneValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  phoneValueText: {
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

  confirmModalCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  confirmModalSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "#64748b",
  },

  noteInput: {
    marginTop: 14,
    minHeight: 110,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0f172a",
  },

  confirmActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },

  cancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },

  submitButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },

  submitButtonDisabled: {
    opacity: 0.7,
  },

  submitButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
  },
  detailButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#2563eb",
  },
  actionInlineCard: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 12,
  },

  inlineCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  scheduleHint: {
    fontSize: 12,
    color: "#64748b",
  },
  scheduleInput: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#0f172a",
  },
});
