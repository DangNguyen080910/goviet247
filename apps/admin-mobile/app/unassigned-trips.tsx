// Path: admin-mobile/app/unassigned-trips.tsx
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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
  cancelUnassignedTrip,
  fetchUnassignedCancelledTrips,
  fetchUnassignedTripDetail,
  fetchUnassignedTrips,
  UnassignedTripDetail,
  UnassignedTripItem,
} from "../services/unassignedTripsApi";

type TabKey = "ACTIVE" | "CANCELLED";

function formatMoney(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function getTripPrice(item: {
  totalPrice?: number | string | null;
  fareEstimate?: number | string | null;
  finalPrice?: number | string | null;
  price?: number | string | null;
  totalFare?: number | string | null;
  fare?: number | string | null;
  fareAmount?: number | string | null;
  estimatedFare?: number | string | null;
  quotePrice?: number | string | null;
}) {
  const rawValue =
    item.totalPrice ??
    item.finalPrice ??
    item.price ??
    item.totalFare ??
    item.fareEstimate ??
    item.estimatedFare ??
    item.fareAmount ??
    item.fare ??
    item.quotePrice ??
    0;

  const numericValue =
    typeof rawValue === "string"
      ? Number(rawValue.replace(/[^\d.-]/g, ""))
      : Number(rawValue);

  return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("vi-VN");
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

function buildSearchText(item: UnassignedTripItem) {
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

function getUnassignedTripOriginLabel(cancelReason?: string | null) {
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
  highlight = false,
}: {
  label: string;
  value: string;
  valueStyle?: any;
  copyValue?: string | null;
  highlight?: boolean;
}) {
  const canCopy = Boolean(String(copyValue || "").trim());

  return (
    <View style={[styles.detailRow, highlight && styles.highlightDetailRow]}>
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

export default function UnassignedTripsScreen() {
  const [tab, setTab] = useState<TabKey>("ACTIVE");
  const [searchText, setSearchText] = useState("");
  const [items, setItems] = useState<UnassignedTripItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState("");

  const [selectedTripId, setSelectedTripId] = useState("");
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<UnassignedTripDetail | null>(null);
  const [actionLoading, setActionLoading] = useState<"" | "CANCEL">("");
  const [cancelReason, setCancelReason] = useState("");

  const filteredItems = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return items;

    return items.filter((item) => buildSearchText(item).includes(keyword));
  }, [items, searchText]);

  const loadData = useCallback(
    async (showRefreshSpinner = false) => {
      try {
        setErrorText("");

        if (showRefreshSpinner) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const data =
          tab === "ACTIVE"
            ? await fetchUnassignedTrips()
            : await fetchUnassignedCancelledTrips();

        setItems(data);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Tải danh sách chuyến chưa có tài xế thất bại";

        setErrorText(message);
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
      void loadData(false);
    }, [loadData]),
  );

  const closeDetail = useCallback(() => {
    setDetailVisible(false);
    setSelectedTripId("");
    setDetail(null);
    setDetailLoading(false);
    setActionLoading("");
    setCancelReason("");
  }, []);

  const openTripDetail = useCallback(async (tripId: string) => {
    try {
      setSelectedTripId(tripId);
      setDetailVisible(true);
      setDetailLoading(true);
      setDetail(null);
      setCancelReason("");
      setActionLoading("");

      const data = await fetchUnassignedTripDetail(tripId);
      setDetail(data);
    } catch (error: any) {
      console.error("fetch unassigned trip detail error:", error);
      Alert.alert("Lỗi", error?.message || "Không tải được chi tiết chuyến.");
      setDetailVisible(false);
      setSelectedTripId("");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleCancelTrip = useCallback(async () => {
    if (!selectedTripId) return;

    const reason = cancelReason.trim();
    if (!reason) {
      Alert.alert("Thiếu lý do", "Vui lòng nhập lý do huỷ chuyến.");
      return;
    }

    try {
      setActionLoading("CANCEL");
      await cancelUnassignedTrip(selectedTripId, reason);

      const completedTripId = selectedTripId;
      setItems((current) => current.filter((item) => item.id !== completedTripId));
      closeDetail();
      Alert.alert("Thành công", "Đã huỷ chuyến.");
      void loadData(false);
    } catch (error: any) {
      console.error("cancel unassigned trip error:", error);
      Alert.alert("Lỗi", error?.message || "Không thể huỷ chuyến.");
    } finally {
      setActionLoading("");
    }
  }, [cancelReason, closeDetail, loadData, selectedTripId]);

  const renderItem = useCallback(
    ({ item }: { item: UnassignedTripItem }) => {
      const destinations = buildDestinationList(
        item.dropoffAddress,
        item.stops,
      );

      return (
        <Pressable
          style={styles.tripCard}
          onPress={() => {
            void openTripDetail(item.id);
          }}
        >
          <View style={styles.tripHeader}>
            <Text style={styles.tripId} numberOfLines={1}>
              {item.id}
            </Text>

            <View
              style={
                tab === "ACTIVE" ? styles.activeBadge : styles.cancelledBadge
              }
            >
              <Text
                style={
                  tab === "ACTIVE"
                    ? styles.activeBadgeText
                    : styles.cancelledBadgeText
                }
              >
                {tab === "ACTIVE" ? "CHƯA CÓ TÀI XẾ" : "ĐÃ HUỶ"}
              </Text>
            </View>
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

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.label}>Giờ đón</Text>
              <Text style={styles.value}>{formatDateTime(item.pickupTime)}</Text>
            </View>

            <View style={styles.metaItemRight}>
              <Text style={styles.label}>Giá</Text>
              <Text style={styles.priceValue}>
                {formatMoney(getTripPrice(item))}đ
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.label}>Tạo lúc</Text>
              <Text style={styles.value}>{formatDateTime(item.createdAt)}</Text>
            </View>

            {tab === "ACTIVE" ? (
              <View style={styles.metaItemRight}>
                <Text style={styles.label}>Chờ (phút)</Text>
                <Text style={styles.waitValue}>{item.pendingMinutes}</Text>
              </View>
            ) : (
              <View style={styles.metaItemRight}>
                <Text style={styles.label}>Huỷ lúc</Text>
                <Text style={styles.value}>
                  {formatDateTime(item.cancelledAt)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.label}>Cảnh báo</Text>
              <Text style={styles.value}>{item.alertCount} lần</Text>
            </View>
          </View>

          {item.lastAlertAt ? (
            <Text style={styles.lastAlertText}>
              Lần cuối: {formatDateTime(item.lastAlertAt)}
            </Text>
          ) : null}

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

        <Text style={styles.title}>Chuyến Chưa Có Tài Xế</Text>
        <Text style={styles.subtitle}>
          {tab === "ACTIVE"
            ? "Danh sách chuyến PENDING đã duyệt, đang chờ tài xế nhận."
            : "Danh sách chuyến đã huỷ để tiện rà soát lại với khách."}
        </Text>

        <View style={styles.tabRow}>
          <Pressable
            style={[
              styles.tabButton,
              tab === "ACTIVE" && styles.tabButtonActive,
            ]}
            onPress={() => setTab("ACTIVE")}
          >
            <Text
              style={[
                styles.tabButtonText,
                tab === "ACTIVE" && styles.tabButtonTextActive,
              ]}
            >
              Chưa có tài xế
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabButton,
              tab === "CANCELLED" && styles.tabButtonActive,
            ]}
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
          style={styles.searchInput}
          placeholder="Tìm mã chuyến, khách hàng, số điện thoại..."
          value={searchText}
          onChangeText={setSearchText}
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Đang tải danh sách chuyến...</Text>
          </View>
        ) : errorText ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Tải dữ liệu chưa ổn</Text>
            <Text style={styles.emptyText}>{errorText}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => {
                void loadData(false);
              }}
            >
              <Text style={styles.retryButtonText}>Tải lại</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  void loadData(true);
                }}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Không có dữ liệu phù hợp</Text>
                <Text style={styles.emptyText}>
                  {searchText.trim()
                    ? "Thử đổi từ khoá tìm kiếm nhé."
                    : tab === "ACTIVE"
                      ? "Hiện chưa có chuyến nào đang chờ tài xế."
                      : "Hiện chưa có chuyến nào đã huỷ."}
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
        onRequestClose={closeDetail}
      >
        <SafeAreaView style={styles.modalContainer} edges={["top", "bottom"]}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardView}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={styles.modalHeader}>
              <Pressable style={styles.modalCloseButton} onPress={closeDetail}>
                <Text style={styles.modalCloseText}>Đóng</Text>
              </Pressable>

              <Text style={styles.modalTitle}>Chi tiết chuyến</Text>

              <View style={styles.modalClosePlaceholder} />
            </View>

            {detailLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.loadingText}>Đang tải chi tiết...</Text>
              </View>
            ) : detail ? (
              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={styles.modalBodyContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={
                  Platform.OS === "ios" ? "interactive" : "on-drag"
                }
              >
                <View style={styles.detailCard}>
                  <Text style={styles.detailCardTitle}>Thông tin chuyến</Text>

                  <DetailRow
                    label="Mã chuyến"
                    value={detail.id || selectedTripId}
                  />
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
                    value={getUnassignedTripOriginLabel(detail.cancelReason)}
                  />
                  <DetailRow label="Trạng thái" value={detail.status || "-"} />
                  <DetailRow
                    label="Điểm đón"
                    value={detail.pickupAddress || "-"}
                    highlight
                  />

                  <View style={[styles.stopsBox, styles.highlightDetailRow]}>
                    <Text style={styles.stopsTitle}>Điểm đến</Text>

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
                      <Text style={styles.stopItem}>-</Text>
                    )}
                  </View>

                  <DetailRow
                    label="Giờ đón"
                    value={formatDateTime(detail.pickupTime)}
                    highlight
                  />
                  <DetailRow
                    label="Giờ về"
                    value={formatDateTime(detail.returnTime)}
                    highlight
                  />
                  <DetailRow
                    label="Tạo lúc"
                    value={formatDateTime(detail.createdAt)}
                  />
                  <DetailRow
                    label="Giá"
                    value={`${formatMoney(getTripPrice(detail))}đ`}
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
                    label="Cảnh báo"
                    value={`${detail.alertCount || 0} lần`}
                  />
                  <DetailRow
                    label="Lần cuối cảnh báo"
                    value={formatDateTime(detail.lastAlertAt)}
                  />
                  <DetailRow label="Ghi chú" value={detail.note || "-"} highlight />

                  {Array.isArray(detail.alertLogs) &&
                  detail.alertLogs.length > 0 ? (
                    <View style={styles.alertLogsBox}>
                      <Text style={styles.stopsTitle}>Lịch sử cảnh báo</Text>

                      {detail.alertLogs.map(
                        (
                          log: {
                            id: string;
                            sentAt: string | null;
                            type: string | null;
                            level: number | null;
                            channel: string | null;
                            note: string | null;
                          },
                          index: number,
                        ) => (
                          <View
                            key={`${log.id || index}-${index}`}
                            style={styles.alertLogItem}
                          >
                            <Text style={styles.alertLogText}>
                              {index + 1}. {formatDateTime(log.sentAt)}
                            </Text>

                            <Text style={styles.alertLogSubtext}>
                              {log.type || "ALERT"}
                              {log.level ? ` • level ${log.level}` : ""}
                              {log.channel ? ` • ${log.channel}` : ""}
                            </Text>

                            {log.note ? (
                              <Text style={styles.alertLogSubtext}>
                                {log.note}
                              </Text>
                            ) : null}
                          </View>
                        ),
                      )}
                    </View>
                  ) : null}
                </View>

                {tab === "ACTIVE" ? (
                  <View style={styles.actionCard}>
                    <Text style={styles.detailCardTitle}>Xử lý chuyến</Text>

                    <TextInput
                      value={cancelReason}
                      onChangeText={setCancelReason}
                      placeholder="Nhập lý do huỷ chuyến..."
                      placeholderTextColor="#98a2b3"
                      multiline
                      style={styles.cancelInput}
                    />

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
    backgroundColor: "#eef4ff",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe7ff",
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748b",
    marginTop: 6,
    marginBottom: 16,
  },
  tabRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe7ff",
    backgroundColor: "#ffffff",
    paddingVertical: 12,
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: "#dbeafe",
    borderColor: "#93c5fd",
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
  },
  tabButtonTextActive: {
    color: "#1d4ed8",
  },
  searchInput: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe7ff",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#0f172a",
    marginBottom: 16,
  },
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
  },
  loadingText: {
    marginTop: 10,
    color: "#64748b",
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 40,
    gap: 12,
  },
  tripCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#dbe7ff",
    gap: 10,
  },
  tripHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tripId: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  activeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#dbeafe",
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1d4ed8",
  },
  cancelledBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#fee2e2",
  },
  cancelledBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#dc2626",
  },
  customerName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
  },
  customerPhone: {
    fontSize: 14,
    color: "#64748b",
    marginTop: -4,
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
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
  },
  value: {
    fontSize: 15,
    lineHeight: 22,
    color: "#0f172a",
  },
  destinationItem: {
    fontSize: 15,
    lineHeight: 22,
    color: "#0f172a",
    marginBottom: 4,
  },
  operationalBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbeafe",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },

  operationalLine: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
  },
  metaItem: {
    flex: 1,
    gap: 4,
  },
  metaItemRight: {
    flex: 1,
    gap: 4,
    alignItems: "flex-end",
  },
  waitValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#dc2626",
  },
  priceValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  lastAlertText: {
    fontSize: 12,
    color: "#64748b",
  },
  detailHint: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: "#2563eb",
  },
  cancelReasonBox: {
    backgroundColor: "#fff7ed",
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  cancelReasonLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9a3412",
    textTransform: "uppercase",
  },
  cancelReasonText: {
    fontSize: 14,
    color: "#7c2d12",
    lineHeight: 20,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dbe7ff",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#64748b",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  modalKeyboardView: {
    flex: 1,
  },
  modalHeader: {
    height: 60,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
  },
  modalCloseButton: {
    minWidth: 56,
  },
  modalCloseText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2563eb",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  modalClosePlaceholder: {
    width: 56,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  detailCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dbe7ff",
    gap: 10,
  },
  detailCardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 2,
  },
  detailRow: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  highlightDetailRow: {
    backgroundColor: "#fff8df",
    borderColor: "#f3c969",
    borderLeftColor: "#e6a700",
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 12,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 15,
    lineHeight: 22,
    color: "#0f172a",
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
    fontWeight: "800",
    color: "#0f172a",
  },
  stopsBox: {
    backgroundColor: "#eff6ff",
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  stopsTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1e3a8a",
  },
  stopItem: {
    fontSize: 14,
    lineHeight: 20,
    color: "#1e293b",
  },
  alertLogsBox: {
    backgroundColor: "#fff7ed",
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  alertLogItem: {
    gap: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#fed7aa",
    paddingBottom: 8,
  },
  alertLogText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#7c2d12",
  },
  alertLogSubtext: {
    fontSize: 13,
    lineHeight: 18,
    color: "#9a3412",
  },
  actionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
    gap: 12,
  },
  cancelInput: {
    minHeight: 96,
    maxHeight: 180,
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 14,
    backgroundColor: "#fff7ed",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
    color: "#0f172a",
    textAlignVertical: "top",
  },
  cancelButton: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc2626",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
