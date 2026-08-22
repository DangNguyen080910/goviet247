// Path: goviet247/apps/admin-mobile/app/drivers.tsx
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Linking,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { API_BASE_URL } from "../constants/api";
import { formatVietnamesePhone } from "../utils/phone";
import {
  DriverListItem,
  fetchDriverDetail,
  fetchDriverLogs,
  fetchDrivers,
  patchDriverAccount,
  patchDriverKyc,
} from "../services/adminDriversApi";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { label: "Tất cả", value: "ALL" },
  { label: "Chờ duyệt", value: "PENDING" },
  { label: "Đã duyệt", value: "VERIFIED" },
  { label: "Từ chối", value: "REJECTED" },
  { label: "Tạm khoá", value: "SUSPENDED" },
] as const;

const PHONE_VERIFIED_OPTIONS = [
  { label: "Tất cả", value: "ALL" },
  { label: "Đã xác thực", value: "true" },
  { label: "Chưa xác thực", value: "false" },
] as const;

const SORT_OPTIONS = [
  { label: "Mới nhất", value: "newest" },
  { label: "Cũ nhất", value: "oldest" },
  { label: "Tên A-Z", value: "name_asc" },
  { label: "Tên Z-A", value: "name_desc" },
] as const;

function formatDateTime(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleString("vi-VN", {
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function getStatusLabel(status?: string | null) {
  switch ((status || "").toUpperCase()) {
    case "PENDING":
      return "PENDING";
    case "VERIFIED":
      return "VERIFIED";
    case "REJECTED":
      return "REJECTED";
    case "SUSPENDED":
      return "SUSPENDED";
    default:
      return status || "--";
  }
}

function getStatusTone(status?: string | null) {
  switch ((status || "").toUpperCase()) {
    case "VERIFIED":
      return {
        bg: "#e7f6ec",
        border: "#b7dfc0",
        text: "#1f7a35",
      };
    case "PENDING":
      return {
        bg: "#fff4e8",
        border: "#ffd3a6",
        text: "#c96a00",
      };
    case "REJECTED":
      return {
        bg: "#fdecec",
        border: "#f7c2c2",
        text: "#c62828",
      };
    case "SUSPENDED":
      return {
        bg: "#f3f4f6",
        border: "#d1d5db",
        text: "#4b5563",
      };
    default:
      return {
        bg: "#f3f4f6",
        border: "#e5e7eb",
        text: "#374151",
      };
  }
}

function getPhoneVerifiedText(value: boolean) {
  return value ? "Đã xác thực" : "Chưa xác thực";
}

function getVehicleTypeLabel(value?: string | null) {
  const normalized = String(value || "").trim().toUpperCase();

  if (["CAR_4", "4", "4_SEATS"].includes(normalized)) return "Xe 4 chỗ";
  if (["CAR_5", "5", "5_SEATS"].includes(normalized)) return "Xe 5 chỗ";
  if (["CAR_7", "7", "7_SEATS"].includes(normalized)) return "Xe 7 chỗ";
  if (["CAR_16", "16", "16_SEATS"].includes(normalized)) return "Xe 16 chỗ";

  return value || "--";
}

function getDocumentTypeLabel(type?: string | null) {
  switch ((type || "").toUpperCase()) {
    case "CCCD_FRONT":
      return "CCCD mặt trước";
    case "CCCD_BACK":
      return "CCCD mặt sau";
    case "DRIVER_LICENSE":
    case "LICENSE":
      return "Bằng lái";
    case "VEHICLE_REGISTRATION":
      return "Cà vẹt xe";
    case "PORTRAIT":
      return "Ảnh chân dung";
    default:
      return type || "Giấy tờ";
  }
}

function normalizeFileUrl(url?: string | null) {
  const raw = String(url || "").trim();

  if (!raw) return "";

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  const base = API_BASE_URL.replace(/\/$/, "");
  const path = raw.startsWith("/") ? raw : `/${raw}`;

  return `${base}${path}`;
}

function getActionTitle(type: string) {
  switch (type) {
    case "APPROVE":
      return "Duyệt tài xế";
    case "REJECT":
      return "Từ chối tài xế";
    case "SUSPEND":
      return "Khoá tài xế";
    case "UNSUSPEND":
      return "Mở khoá tài xế";
    default:
      return "Cập nhật tài xế";
  }
}

function getActionPlaceholder(type: string) {
  switch (type) {
    case "REJECT":
      return "Nhập lý do từ chối";
    case "SUSPEND":
      return "Nhập lý do khoá";
    case "UNSUSPEND":
      return "Nhập ghi chú mở khoá (không bắt buộc)";
    case "APPROVE":
      return "Nhập ghi chú duyệt (không bắt buộc)";
    default:
      return "Hoàn tiền phạt huỷ chuyến - TripID: XXXXX";
  }
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

async function copyPhoneToClipboard(phone?: string | null) {
  const value = String(phone || "").trim();

  if (!value || value === "--") {
    Alert.alert("Không có số điện thoại", "Không có số điện thoại để copy.");
    return;
  }

  await Clipboard.setStringAsync(value);
  Alert.alert("Đã copy", `Đã copy số điện thoại: ${value}`);
}

function InfoRow({
  label,
  value,
  copyValue,
}: {
  label: string;
  value?: string | number | null;
  copyValue?: string | null;
}) {
  const canCopy = Boolean(String(copyValue || "").trim());

  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>

      <View style={styles.infoValueRow}>
        <Text style={styles.infoValue}>{value || "--"}</Text>

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

function DriverCard({
  item,
  onPress,
}: {
  item: DriverListItem;
  onPress: () => void;
}) {
  const tone = getStatusTone(item.status);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardTopLeft}>
          <Text style={styles.driverName}>
            {item.displayName?.trim() || "Chưa có tên"}
          </Text>
          <Text style={styles.driverPhone}>
            {formatVietnamesePhone(item.phone)}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: tone.bg,
              borderColor: tone.border,
            },
          ]}
        >
          <Text style={[styles.statusBadgeText, { color: tone.text }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>

      <View style={styles.infoGrid}>
        <InfoRow
          label="Loại xe"
          value={getVehicleTypeLabel(item.vehicleType)}
        />
        <InfoRow
          label="SĐT xác thực"
          value={getPhoneVerifiedText(item.isPhoneVerified)}
        />
        <InfoRow label="Hãng xe" value={item.brand} />
        <InfoRow label="Model xe" value={item.model} />
        <InfoRow
          label="Đời xe"
          value={item.vehicleYear ? String(item.vehicleYear) : "--"}
        />
        <InfoRow label="Biển số" value={item.licensePlate} />
        <InfoRow label="Ngày tạo" value={formatDateTime(item.createdAt)} />
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.cardFooterText}>Chạm để xem chi tiết</Text>
      </View>
    </Pressable>
  );
}

export default function DriversScreen() {
  const [items, setItems] = useState<DriverListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("ALL");
  const [phoneVerified, setPhoneVerified] = useState("ALL");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailTab, setDetailTab] = useState<"INFO" | "DOCS" | "LOGS">("INFO");
  const [detailLoading, setDetailLoading] = useState(false);
  const [driverDetail, setDriverDetail] = useState<any | null>(null);
  const [driverLogs, setDriverLogs] = useState<any[]>([]);

  const [actionExpanded, setActionExpanded] = useState(false);
  const [actionType, setActionType] = useState<
    "APPROVE" | "REJECT" | "SUSPEND" | "UNSUSPEND" | ""
  >("");
  const [actionReason, setActionReason] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  const queryParams = useMemo(() => {
    return {
      q: keyword,
      status,
      phoneVerified,
      sort,
      page,
      pageSize: PAGE_SIZE,
    };
  }, [keyword, status, phoneVerified, sort, page]);

  const loadDrivers = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const data = await fetchDrivers(queryParams);
        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotal(Number(data?.meta?.total || 0));
        setTotalPages(Math.max(1, Number(data?.meta?.totalPages || 1)));
      } catch (error: any) {
        console.error("load drivers error:", error);
        setItems([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [queryParams],
  );

  const loadDriverDetail = useCallback(async (driverId: string) => {
    try {
      setDetailLoading(true);
      const [detail, logs] = await Promise.all([
        fetchDriverDetail(driverId),
        fetchDriverLogs(driverId),
      ]);
      setDriverDetail(detail);
      setDriverLogs(Array.isArray(logs) ? logs : []);
    } catch (error) {
      console.error("load driver detail error:", error);
      setDriverDetail(null);
      setDriverLogs([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrivers(false);
  }, [loadDrivers]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;

      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (detailVisible) {
          setDetailVisible(false);
          return true;
        }

        router.replace("/home");
        return true;
      });

      return () => sub.remove();
    }, [detailVisible]),
  );

  function handleApplySearch() {
    setPage(1);

    setKeyword(keywordInput.trim());
  }

  function handleClearSearch() {
    setKeywordInput("");
    setKeyword("");
    setPage(1);
  }

  function handleChangeStatus(value: string) {
    setStatus(value);
    setPage(1);
  }

  function handleChangePhoneVerified(value: string) {
    setPhoneVerified(value);
    setPage(1);
  }

  function handleChangeSort(value: string) {
    setSort(value);
    setPage(1);
  }

  async function handleOpenDetail(item: DriverListItem) {
    setSelectedDriverId(item.id);
    setDetailVisible(true);
    setDetailTab("INFO");
    await loadDriverDetail(item.id);
  }

  function handleCloseDetail() {
    setDetailVisible(false);
    setSelectedDriverId("");
    setDriverDetail(null);
    setDriverLogs([]);
    setDetailTab("INFO");
  }

  function openActionModal(
    type: "APPROVE" | "REJECT" | "SUSPEND" | "UNSUSPEND",
  ) {
    if (type === "APPROVE") {
      handleSubmitApprove();
      return;
    }

    setActionType(type);
    setActionReason("");
    setActionExpanded(true);
  }

  function closeActionModal() {
    if (actionSubmitting) return;
    setActionExpanded(false);
    setActionType("");
    setActionReason("");
  }

  async function reloadCurrentDriverDetail() {
    if (!selectedDriverId) return;
    await loadDriverDetail(selectedDriverId);
  }

  async function handleSubmitApprove() {
    if (!selectedDriverId) return;

    try {
      setActionSubmitting(true);

      await patchDriverKyc(selectedDriverId, {
        action: "APPROVE",
      });

      await reloadCurrentDriverDetail();
      await loadDrivers(false);

      Alert.alert("Thành công", "Đã duyệt tài xế.");
    } catch (error: any) {
      console.error("approve driver error:", error);

      Alert.alert("Có lỗi xảy ra", error?.message || "Không thể duyệt tài xế.");
    } finally {
      setActionSubmitting(false);
    }
  }

  async function handleSubmitDriverAction() {
    if (!selectedDriverId || !actionType) return;

    const trimmedReason = actionReason.trim();

    if (
      (actionType === "REJECT" || actionType === "SUSPEND") &&
      !trimmedReason
    ) {
      Alert.alert("Thiếu lý do", "Vui lòng nhập lý do trước khi tiếp tục.");
      return;
    }

    try {
      setActionSubmitting(true);

      if (actionType === "APPROVE") {
        await patchDriverKyc(selectedDriverId, {
          action: "APPROVE",
          note: trimmedReason || undefined,
        });
      }

      if (actionType === "REJECT") {
        await patchDriverKyc(selectedDriverId, {
          action: "REJECT",
          reason: trimmedReason,
          note: trimmedReason,
        });
      }

      if (actionType === "SUSPEND") {
        await patchDriverAccount(selectedDriverId, {
          action: "SUSPEND" as any,
          reason: trimmedReason,
          note: trimmedReason,
        });
      }

      if (actionType === "UNSUSPEND") {
        await patchDriverAccount(selectedDriverId, {
          action: "UNSUSPEND" as any,
          reason: trimmedReason || "Admin mở khoá tài xế",
          note: trimmedReason || "Admin mở khoá tài xế",
        });
      }

      closeActionModal();
      await reloadCurrentDriverDetail();
      await loadDrivers(false);

      Alert.alert("Thành công", "Đã cập nhật trạng thái tài xế.");
    } catch (error: any) {
      console.error("submit driver action error:", error);
      Alert.alert(
        "Có lỗi xảy ra",
        error?.message || "Không thể cập nhật tài xế.",
      );
    } finally {
      setActionSubmitting(false);
    }
  }

  async function handleOpenFile(url?: string | null) {
    if (!url) return;

    try {
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error("open file error:", error);
    }
  }

  const detailTone = getStatusTone(driverDetail?.status);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.headerWrap}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.replace("/home")}
        >
          <Text style={styles.backButtonText}>← Về trang chủ</Text>
        </Pressable>

        <Text style={styles.pageTitle}>Quản lý tài xế</Text>
        <Text style={styles.pageSubtitle}>Tổng: {total}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDrivers(true)}
          />
        }
      >
        <View style={styles.filterCard}>
          <SectionTitle>Tìm kiếm</SectionTitle>

          <TextInput
            value={keywordInput}
            onChangeText={setKeywordInput}
            placeholder="Tên, số điện thoại, biển số..."
            placeholderTextColor="#9ca3af"
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={handleApplySearch}
          />

          <View style={styles.searchActions}>
            <Pressable style={styles.primaryButton} onPress={handleApplySearch}>
              <Text style={styles.primaryButtonText}>Tìm</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={handleClearSearch}
            >
              <Text style={styles.secondaryButtonText}>Xoá</Text>
            </Pressable>
          </View>

          <SectionTitle>Trạng thái</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {STATUS_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  active={status === option.value}
                  onPress={() => handleChangeStatus(option.value)}
                />
              ))}
            </View>
          </ScrollView>

          <SectionTitle>SĐT xác thực</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {PHONE_VERIFIED_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  active={phoneVerified === option.value}
                  onPress={() => handleChangePhoneVerified(option.value)}
                />
              ))}
            </View>
          </ScrollView>

          <SectionTitle>Sắp xếp</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {SORT_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  active={sort === option.value}
                  onPress={() => handleChangeSort(option.value)}
                />
              ))}
            </View>
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#f97316" />
            <Text style={styles.loadingText}>Đang tải danh sách tài xế...</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Chưa có tài xế phù hợp</Text>
            <Text style={styles.emptySubtitle}>
              Thử đổi bộ lọc hoặc từ khoá tìm kiếm.
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {items.map((item) => (
              <DriverCard
                key={item.id}
                item={item}
                onPress={() => handleOpenDetail(item)}
              />
            ))}
          </View>
        )}

        <View style={styles.paginationCard}>
          <Text style={styles.paginationText}>
            Trang {page} / {totalPages}
          </Text>

          <View style={styles.paginationActions}>
            <Pressable
              disabled={!canGoPrev}
              onPress={() => setPage((prev) => Math.max(1, prev - 1))}
              style={[
                styles.secondaryButton,
                !canGoPrev && styles.buttonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  !canGoPrev && styles.buttonDisabledText,
                ]}
              >
                Trang trước
              </Text>
            </Pressable>

            <Pressable
              disabled={!canGoNext}
              onPress={() => setPage((prev) => prev + 1)}
              style={[
                styles.primaryButton,
                !canGoNext && styles.buttonDisabledPrimary,
              ]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  !canGoNext && styles.buttonDisabledPrimaryText,
                ]}
              >
                Trang sau
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={detailVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseDetail}
      >
        <SafeAreaView
          style={styles.modalContainer}
          edges={["left", "right", "bottom"]}
        >
          <View style={styles.modalHeader}>
            <Pressable
              style={styles.modalBackButton}
              onPress={handleCloseDetail}
            >
              <Text style={styles.modalBackButtonText}>← Đóng</Text>
            </Pressable>

            <View style={styles.modalHeaderTextWrap}>
              <Text style={styles.modalTitle}>Chi tiết tài xế</Text>
              <Text style={styles.modalSubtitle}>
                {driverDetail?.displayName || selectedDriverId || "--"}
              </Text>
            </View>
          </View>

          {detailLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#f97316" />
              <Text style={styles.loadingText}>
                Đang tải chi tiết tài xế...
              </Text>
            </View>
          ) : !driverDetail ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Không tải được chi tiết</Text>
              <Text style={styles.emptySubtitle}>
                Vui lòng đóng lại và thử lại.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.detailSummaryCard}>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardTopLeft}>
                    <Text style={styles.driverName}>
                      {driverDetail?.displayName || "Chưa có tên"}
                    </Text>
                    <Text style={styles.driverPhone}>
                      {formatVietnamesePhone(driverDetail?.phone)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: detailTone.bg,
                        borderColor: detailTone.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: detailTone.text },
                      ]}
                    >
                      {getStatusLabel(driverDetail?.status)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.detailSummaryHint}>
                  SĐT xác thực:{" "}
                  {getPhoneVerifiedText(Boolean(driverDetail?.isPhoneVerified))}
                </Text>
              </View>

              <View style={styles.tabRow}>
                <Pressable
                  style={[
                    styles.tabButton,
                    detailTab === "INFO" && styles.tabButtonActive,
                  ]}
                  onPress={() => setDetailTab("INFO")}
                >
                  <Text
                    style={[
                      styles.tabButtonText,
                      detailTab === "INFO" && styles.tabButtonTextActive,
                    ]}
                  >
                    Thông tin
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.tabButton,
                    detailTab === "DOCS" && styles.tabButtonActive,
                  ]}
                  onPress={() => setDetailTab("DOCS")}
                >
                  <Text
                    style={[
                      styles.tabButtonText,
                      detailTab === "DOCS" && styles.tabButtonTextActive,
                    ]}
                  >
                    Giấy tờ
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.tabButton,
                    detailTab === "LOGS" && styles.tabButtonActive,
                  ]}
                  onPress={() => setDetailTab("LOGS")}
                >
                  <Text
                    style={[
                      styles.tabButtonText,
                      detailTab === "LOGS" && styles.tabButtonTextActive,
                    ]}
                  >
                    Lịch sử
                  </Text>
                </Pressable>
              </View>

              <View style={styles.actionRowWrap}>
                {String(driverDetail?.status || "").toUpperCase() ===
                "PENDING" ? (
                  <>
                    <Pressable
                      style={styles.approveButton}
                      onPress={() => openActionModal("APPROVE")}
                    >
                      <Text style={styles.approveButtonText}>Duyệt</Text>
                    </Pressable>

                    <Pressable
                      style={styles.rejectButton}
                      onPress={() => openActionModal("REJECT")}
                    >
                      <Text style={styles.rejectButtonText}>Từ chối</Text>
                    </Pressable>
                  </>
                ) : null}

                {String(driverDetail?.status || "").toUpperCase() ===
                "REJECTED" ? (
                  <>
                    <Pressable
                      style={styles.approveButton}
                      onPress={() => openActionModal("APPROVE")}
                    >
                      <Text style={styles.approveButtonText}>Duyệt lại</Text>
                    </Pressable>

                    <Pressable
                      style={styles.rejectButton}
                      onPress={() => openActionModal("REJECT")}
                    >
                      <Text style={styles.rejectButtonText}>Từ chối lại</Text>
                    </Pressable>
                  </>
                ) : null}

                {String(driverDetail?.status || "").toUpperCase() ===
                "VERIFIED" ? (
                  <Pressable
                    style={styles.rejectButton}
                    onPress={() => openActionModal("SUSPEND")}
                  >
                    <Text style={styles.rejectButtonText}>Khoá tài xế</Text>
                  </Pressable>
                ) : null}

                {String(driverDetail?.status || "").toUpperCase() ===
                "SUSPENDED" ? (
                  <Pressable
                    style={styles.approveButton}
                    onPress={() => openActionModal("UNSUSPEND")}
                  >
                    <Text style={styles.approveButtonText}>Mở khoá tài xế</Text>
                  </Pressable>
                ) : null}
              </View>

              {actionExpanded ? (
                <View style={styles.detailCard}>
                  <Text style={styles.sectionTitle}>
                    {getActionTitle(actionType)}
                  </Text>

                  <TextInput
                    value={actionReason}
                    onChangeText={setActionReason}
                    placeholder={getActionPlaceholder(actionType)}
                    placeholderTextColor="#98a2b3"
                    multiline
                    textAlignVertical="top"
                    style={styles.actionReasonInput}
                    editable={!actionSubmitting}
                  />

                  <View style={styles.actionModalButtons}>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={closeActionModal}
                      disabled={actionSubmitting}
                    >
                      <Text style={styles.secondaryButtonText}>Huỷ</Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.primaryButton,
                        actionSubmitting && styles.buttonDisabledPrimary,
                      ]}
                      onPress={handleSubmitDriverAction}
                      disabled={actionSubmitting}
                    >
                      <Text
                        style={[
                          styles.primaryButtonText,
                          actionSubmitting && styles.buttonDisabledPrimaryText,
                        ]}
                      >
                        {actionSubmitting ? "Đang xử lý..." : "Xác nhận"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalContent}
              >
                {detailTab === "INFO" ? (
                  <View style={styles.detailCard}>
                    <InfoRow label="Họ tên" value={driverDetail?.displayName} />
                    <InfoRow
                      label="Số điện thoại"
                      value={formatVietnamesePhone(driverDetail?.phone)}
                      copyValue={formatVietnamesePhone(driverDetail?.phone)}
                    />
                    <InfoRow
                      label="SĐT xác thực"
                      value={getPhoneVerifiedText(
                        Boolean(driverDetail?.isPhoneVerified),
                      )}
                    />
                    <InfoRow
                      label="Loại xe"
                      value={getVehicleTypeLabel(driverDetail?.vehicleType)}
                    />
                    <InfoRow label="Hãng xe" value={driverDetail?.brand} />
                    <InfoRow label="Model xe" value={driverDetail?.model} />
                    <InfoRow
                      label="Đời xe"
                      value={
                        driverDetail?.vehicleYear
                          ? String(driverDetail.vehicleYear)
                          : "--"
                      }
                    />
                    <InfoRow
                      label="Biển số"
                      value={driverDetail?.licensePlate}
                    />
                    <InfoRow
                      label="Tổng chuyến đã hoàn thành"
                      value={String(driverDetail?.completedTripCount ?? 0)}
                    />
                    <InfoRow
                      label="Tổng chuyến đã huỷ"
                      value={String(driverDetail?.cancelledTripCount ?? 0)}
                    />
                    <InfoRow
                      label="Ngày tạo"
                      value={formatDateTime(driverDetail?.createdAt)}
                    />
                  </View>
                ) : null}

                {detailTab === "DOCS" ? (
                  <View style={styles.detailCard}>
                    {Array.isArray(driverDetail?.documents) &&
                    driverDetail.documents.length > 0 ? (
                      driverDetail.documents.map((doc: any) => {
                        const docTone = getStatusTone(doc?.status);
                        const docTitle = getDocumentTypeLabel(doc?.type);
                        const rawFileUrl = doc?.viewUrl || doc?.fileUrl;

                        const docFileUrl = normalizeFileUrl(rawFileUrl);

                        return (
                          <View key={doc.id} style={styles.documentCard}>
                            <View style={styles.cardTopRow}>
                              <View style={styles.cardTopLeft}>
                                <Text style={styles.documentTitle}>
                                  {docTitle}
                                </Text>
                                <Text style={styles.documentMeta}>
                                  {formatDateTime(doc?.createdAt)}
                                </Text>
                              </View>

                              <View
                                style={[
                                  styles.statusBadge,
                                  {
                                    backgroundColor: docTone.bg,
                                    borderColor: docTone.border,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.statusBadgeText,
                                    { color: docTone.text },
                                  ]}
                                >
                                  {getStatusLabel(doc?.status)}
                                </Text>
                              </View>
                            </View>

                            <InfoRow label="Ghi chú" value={doc?.note} />

                            {docFileUrl ? (
                              <View style={styles.documentPreviewWrap}>
                                <Image
                                  source={{ uri: docFileUrl }}
                                  style={styles.documentPreviewImage}
                                  resizeMode="cover"
                                />
                              </View>
                            ) : (
                              <View style={styles.documentImageEmpty}>
                                <Text style={styles.documentImageEmptyText}>
                                  Không có ảnh để hiển thị
                                </Text>
                              </View>
                            )}

                            <Pressable
                              style={styles.secondaryButton}
                              onPress={() => handleOpenFile(docFileUrl)}
                            >
                              <Text style={styles.secondaryButtonText}>
                                Mở ảnh bằng trình duyệt
                              </Text>
                            </Pressable>
                          </View>
                        );
                      })
                    ) : (
                      <View style={styles.emptyInnerCard}>
                        <Text style={styles.emptyTitle}>Chưa có giấy tờ</Text>
                        <Text style={styles.emptySubtitle}>
                          Tài xế này chưa có dữ liệu giấy tờ để hiển thị.
                        </Text>
                      </View>
                    )}
                  </View>
                ) : null}

                {detailTab === "LOGS" ? (
                  <View style={styles.detailCard}>
                    {driverLogs.length > 0 ? (
                      driverLogs.map((log) => (
                        <View key={log.id} style={styles.logCard}>
                          <Text style={styles.logAction}>
                            {log.action || "LOG"}
                          </Text>
                          <Text style={styles.logMeta}>
                            {formatDateTime(log.createdAt)}
                          </Text>
                          <Text style={styles.logMeta}>
                            Người thao tác: {log.actorUsername || "--"}
                          </Text>
                          <Text style={styles.logNote}>{log.note || "--"}</Text>
                        </View>
                      ))
                    ) : (
                      <View style={styles.emptyInnerCard}>
                        <Text style={styles.emptyTitle}>Chưa có lịch sử</Text>
                        <Text style={styles.emptySubtitle}>
                          Chưa có log thao tác cho tài xế này.
                        </Text>
                      </View>
                    )}
                  </View>
                ) : null}
              </ScrollView>
            </>
          )}
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
  headerWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: "#f7f8fa",
  },
  backButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },
  pageSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#667085",
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 44,
    gap: 14,
  },
  filterCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#344054",
    marginBottom: 8,
    marginTop: 10,
  },
  searchInput: {
    height: 46,
    borderWidth: 1,
    borderColor: "#d0d5dd",
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  searchActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#d0d5dd",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#93c5fd",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475467",
  },
  chipTextActive: {
    color: "#1d4ed8",
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#667085",
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 20,
    alignItems: "center",
    margin: 16,
  },
  emptyInnerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 18,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    color: "#667085",
    textAlign: "center",
  },
  listWrap: {
    gap: 12,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
  },
  cardTopLeft: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  driverPhone: {
    marginTop: 4,
    fontSize: 14,
    color: "#667085",
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  infoGrid: {
    marginTop: 14,
    gap: 10,
  },
  infoItem: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f4f7",
  },
  infoLabel: {
    fontSize: 12,
    color: "#667085",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  infoValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  cardFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f2f4f7",
  },
  cardFooterText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563eb",
  },
  paginationCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    marginTop: 2,
  },
  paginationText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#344054",
  },
  paginationActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  primaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
  },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d0d5dd",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#344054",
  },
  buttonDisabled: {
    backgroundColor: "#f9fafb",
    borderColor: "#eaecf0",
  },
  buttonDisabledText: {
    color: "#98a2b3",
  },
  buttonDisabledPrimary: {
    backgroundColor: "#cbd5e1",
  },
  buttonDisabledPrimaryText: {
    color: "#f8fafc",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#f7f8fa",
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 52 : 10,
    paddingBottom: 12,
    minHeight: Platform.OS === "ios" ? 96 : undefined,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#eaecf0",
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  modalBackButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginTop: Platform.OS === "ios" ? 2 : 0,
  },
  modalBackButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
  modalHeaderTextWrap: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#667085",
  },
  detailSummaryCard: {
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
  },
  detailSummaryHint: {
    marginTop: 10,
    fontSize: 13,
    color: "#667085",
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  tabButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d0d5dd",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  tabButtonActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#93c5fd",
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#475467",
  },
  tabButtonTextActive: {
    color: "#1d4ed8",
  },
  actionRowWrap: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  approveButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  approveButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
  },
  rejectButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
  },
  modalScroll: {
    flex: 1,
    marginTop: 12,
  },
  modalContent: {
    paddingHorizontal: 16,
    paddingBottom: 44,
  },
  detailCard: {
    gap: 12,
  },
  documentCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    gap: 10,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  documentMeta: {
    marginTop: 4,
    fontSize: 13,
    color: "#667085",
  },
  documentPreviewWrap: {
    marginTop: 4,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    position: "relative",
  },
  documentPreviewImage: {
    width: "100%",
    height: 220,
    backgroundColor: "#f3f4f6",
  },
  documentPreviewOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(17,24,39,0.45)",
  },
  documentPreviewOverlayText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
  },
  documentImageEmpty: {
    minHeight: 180,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  documentImageEmptyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#667085",
    textAlign: "center",
  },
  logCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
  },
  logAction: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  logMeta: {
    marginTop: 6,
    fontSize: 13,
    color: "#667085",
  },
  logNote: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: "#344054",
  },
  imagePreviewModalContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  imagePreviewHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: "#111827",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  imagePreviewBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "#000000",
  },
  imagePreviewFull: {
    width: "100%",
    height: "100%",
  },
  actionModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  actionModalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  actionModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  actionModalSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#667085",
  },
  actionReasonInput: {
    minHeight: 120,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#d0d5dd",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  actionModalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
});
