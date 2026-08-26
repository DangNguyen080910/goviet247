// Path: goviet247/apps/admin-mobile/app/customers.tsx
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
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
  CustomerListItem,
  fetchCustomerDetail,
  fetchCustomerLogs,
  fetchCustomers,
  patchCustomerAccount,
} from "../services/adminCustomersApi";
import { getAdminUser } from "../services/storage";
import { formatVietnamesePhone } from "../utils/phone";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { label: "Tất cả", value: "ALL" },
  { label: "Đang hoạt động", value: "ACTIVE" },
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
    case "ACTIVE":
      return "ACTIVE";
    case "SUSPENDED":
      return "SUSPENDED";
    default:
      return status || "--";
  }
}

function getStatusTone(status?: string | null) {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
      return {
        bg: "#e7f6ec",
        border: "#b7dfc0",
        text: "#1f7a35",
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

function isBadDefaultName(value?: string | null) {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  return !text || text === "user" || text === "khách hàng";
}

function getCustomerDisplayName(item: any) {
  const displayName = String(item?.displayName || "").trim();
  const fullName = String(item?.fullName || "").trim();
  const name = String(item?.name || "").trim();

  if (!isBadDefaultName(fullName)) return fullName;
  if (!isBadDefaultName(name)) return name;
  if (!isBadDefaultName(displayName)) return displayName;

  return item?.phone || "Chưa có tên";
}

function getActionTitle(type: "SUSPEND" | "UNSUSPEND") {
  return type === "SUSPEND" ? "Khoá khách hàng" : "Mở khoá khách hàng";
}

function getActionPlaceholder(type: "SUSPEND" | "UNSUSPEND") {
  return type === "SUSPEND"
    ? "Nhập lý do khoá khách hàng"
    : "Nhập ghi chú mở khoá (không bắt buộc)";
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

function CustomerCard({
  item,
  onPress,
}: {
  item: CustomerListItem;
  onPress: () => void;
}) {
  const tone = getStatusTone(item.status);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardTopLeft}>
          <Text style={styles.customerName}>
            {getCustomerDisplayName(item)}
          </Text>
          <Text style={styles.customerPhone}>
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
          label="SĐT xác thực"
          value={getPhoneVerifiedText(item.isPhoneVerified)}
        />
        <InfoRow label="Tổng chuyến" value={String(item.totalTrips || 0)} />
        <InfoRow label="Ngày tạo" value={formatDateTime(item.createdAt)} />
        <InfoRow
          label="Cập nhật gần nhất"
          value={formatDateTime(item.updatedAt)}
        />
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.cardFooterText}>Chạm để xem chi tiết</Text>
      </View>
    </Pressable>
  );
}

export default function CustomersScreen() {
  const [adminRole, setAdminRole] = useState("");

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");

  const [status, setStatus] =
    useState<(typeof STATUS_OPTIONS)[number]["value"]>("ALL");
  const [phoneVerified, setPhoneVerified] =
    useState<(typeof PHONE_VERIFIED_OPTIONS)[number]["value"]>("ALL");
  const [sort, setSort] =
    useState<(typeof SORT_OPTIONS)[number]["value"]>("newest");

  const [items, setItems] = useState<CustomerListItem[]>([]);
  const [meta, setMeta] = useState<{
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  } | null>(null);

  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<any | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"INFO" | "LOGS">("INFO");

  const [actionExpanded, setActionExpanded] = useState(false);
  const [actionType, setActionType] = useState<"SUSPEND" | "UNSUSPEND">(
    "SUSPEND",
  );
  const [actionReason, setActionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setQDebounced(q.trim());
    }, 350);

    return () => clearTimeout(t);
  }, [q]);

  const params = useMemo(() => {
    return {
      q: qDebounced,
      status,
      phoneVerified,
      sort,
      page,
      pageSize: PAGE_SIZE,
    };
  }, [page, phoneVerified, qDebounced, sort, status]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function bootstrap() {
        try {
          const admin = await getAdminUser();

          if (!active) return;
          setAdminRole(String(admin?.role || "").toUpperCase());

          if (page === 1) {
            await loadCustomers(false);
          } else {
            setPage(1);
          }

          if (detailVisible && selectedId) {
            try {
              const [detailData, logData] = await Promise.all([
                fetchCustomerDetail(selectedId),
                fetchCustomerLogs(selectedId),
              ]);

              if (!active) return;

              setDetail(detailData || null);
              setLogs(logData?.logs || []);
            } catch (error) {
              console.error("refresh selected customer on focus error:", error);
            }
          }
        } catch {
          if (!active) return;
          setAdminRole("");
        }
      }

      bootstrap();

      return () => {
        active = false;
      };
    }, [detailVisible, page, selectedId]),
  );

  useEffect(() => {
    loadCustomers(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (actionExpanded) {
          setActionExpanded(false);
          return true;
        }

        if (detailVisible) {
          closeDetail();
          return true;
        }

        router.replace("/home");
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );

      return () => subscription.remove();
    }, [actionExpanded, detailVisible]),
  );

  async function loadCustomers(showRefreshSpinner = false) {
    try {
      if (showRefreshSpinner) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data = await fetchCustomers(params);
      setItems(data?.items || []);
      setMeta(data?.meta || null);
    } catch (error: any) {
      console.error("load customers error:", error);
      Alert.alert(
        "Lỗi",
        error?.message || "Không tải được danh sách khách hàng.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadMoreCustomers() {
    try {
      setLoadingMore(true);

      const data = await fetchCustomers(params);
      setItems((prev) => {
        const merged = [...prev, ...(data?.items || [])];
        const map = new Map(merged.map((item) => [item.id, item]));
        return Array.from(map.values());
      });
      setMeta(data?.meta || null);
    } catch (error: any) {
      console.error("load more customers error:", error);
      Alert.alert(
        "Lỗi",
        error?.message || "Không tải thêm được danh sách khách hàng.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleRefresh() {
    setPage(1);
    await loadCustomers(true);
  }

  function handleChangeSearch(text: string) {
    setQ(text);
    if (page !== 1) setPage(1);
  }

  function handleSelectStatus(value: (typeof STATUS_OPTIONS)[number]["value"]) {
    setStatus(value);
    setPage(1);
  }

  function handleSelectPhoneVerified(
    value: (typeof PHONE_VERIFIED_OPTIONS)[number]["value"],
  ) {
    setPhoneVerified(value);
    setPage(1);
  }

  function handleSelectSort(value: (typeof SORT_OPTIONS)[number]["value"]) {
    setSort(value);
    setPage(1);
  }

  function canLoadMore() {
    if (!meta) return false;
    return Number(meta.page || 1) < Number(meta.totalPages || 1);
  }

  async function openDetail(userId: string) {
    try {
      setSelectedId(userId);
      setDetailVisible(true);
      setDetailLoading(true);
      setDetailTab("INFO");
      setDetail(null);
      setLogs([]);

      const [detailData, logData] = await Promise.all([
        fetchCustomerDetail(userId),
        fetchCustomerLogs(userId),
      ]);

      setDetail(detailData || null);
      setLogs(logData?.logs || []);
    } catch (error: any) {
      console.error("open customer detail error:", error);
      Alert.alert(
        "Lỗi",
        error?.message || "Không tải được chi tiết khách hàng.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetailVisible(false);
    setDetailLoading(false);
    setDetailTab("INFO");
    setSelectedId("");
    setDetail(null);
    setLogs([]);
  }

  function openActionModal(type: "SUSPEND" | "UNSUSPEND") {
    if (adminRole === "STAFF") {
      Alert.alert("Thông báo", "STAFF không được phép thao tác khách hàng.");
      return;
    }

    setActionType(type);
    setActionReason("");
    setActionExpanded(true);
  }

  function closeActionModal() {
    if (actionLoading) return;

    setActionExpanded(false);
    setActionReason("");
  }

  async function handleConfirmAction() {
    try {
      if (!selectedId) return;

      if (actionType === "SUSPEND" && !actionReason.trim()) {
        Alert.alert("Thiếu lý do", "Vui lòng nhập lý do khoá khách hàng.");
        return;
      }

      setActionLoading(true);

      await patchCustomerAccount(selectedId, {
        action: actionType,
        reason: actionReason.trim(),
      });

      setActionExpanded(false);
      setActionReason("");
      Alert.alert(
        "Thành công",
        actionType === "SUSPEND"
          ? "Đã khoá khách hàng."
          : "Đã mở khoá khách hàng.",
      );
      void Promise.allSettled([
        fetchCustomerDetail(selectedId).then((detailData) => setDetail(detailData || null)),
        fetchCustomerLogs(selectedId).then((logData) => setLogs(logData?.logs || [])),
        page === 1 ? loadCustomers() : Promise.resolve(setPage(1)),
      ]);
    } catch (error: any) {
      console.error("customer action error:", error);
      Alert.alert("Lỗi", error?.message || "Thao tác thất bại.");
    } finally {
      setActionLoading(false);
    }
  }

  const selectedStatusTone = getStatusTone(detail?.status);
  const totalPages = Math.max(1, Number(meta?.totalPages || 1));
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.replace("/home")}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>‹</Text>
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Khách hàng</Text>
            <Text style={styles.headerSubtitle}>
              Tổng: {meta?.total ?? items.length ?? 0}
            </Text>
          </View>

          <View style={styles.headerRight} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <View style={styles.searchBox}>
            <Text style={styles.inputLabel}>Tìm kiếm</Text>
            <TextInput
              value={q}
              onChangeText={handleChangeSearch}
              placeholder="Nhập tên hoặc số điện thoại"
              placeholderTextColor="#9ca3af"
              style={styles.textInput}
            />
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.inputLabel}>Trạng thái</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {STATUS_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.value}
                    label={option.label}
                    active={status === option.value}
                    onPress={() => handleSelectStatus(option.value)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.inputLabel}>SĐT xác thực</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {PHONE_VERIFIED_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.value}
                    label={option.label}
                    active={phoneVerified === option.value}
                    onPress={() => handleSelectPhoneVerified(option.value)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.inputLabel}>Sắp xếp</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {SORT_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.value}
                    label={option.label}
                    active={sort === option.value}
                    onPress={() => handleSelectSort(option.value)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" />
              <Text style={styles.loadingText}>
                Đang tải danh sách khách hàng...
              </Text>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Chưa có khách hàng phù hợp</Text>
              <Text style={styles.emptyText}>
                Hãy thử đổi bộ lọc hoặc từ khoá tìm kiếm.
              </Text>
            </View>
          ) : (
            <View style={styles.listWrap}>
              {items.map((item) => (
                <CustomerCard
                  key={item.id}
                  item={item}
                  onPress={() => openDetail(item.id)}
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
                  styles.secondaryBtn,
                  !canGoPrev && styles.buttonDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.secondaryBtnText,
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
                  styles.primaryBtn,
                  !canGoNext && styles.buttonDisabledPrimary,
                ]}
              >
                <Text
                  style={[
                    styles.primaryBtnText,
                    !canGoNext && styles.buttonDisabledPrimaryText,
                  ]}
                >
                  Trang sau
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={detailVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeDetail}
      >
        <SafeAreaView style={styles.modalContainer} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Pressable style={styles.modalBackButton} onPress={closeDetail}>
              <Text style={styles.modalBackButtonText}>← Đóng</Text>
            </Pressable>

            <View style={styles.modalHeaderTextWrap}>
              <Text style={styles.modalTitle}>Chi tiết khách hàng</Text>
              <Text style={styles.modalSubtitle}>
                {getCustomerDisplayName(detail)}
              </Text>
            </View>
          </View>

          {detailLoading ? (
            <View style={styles.sheetLoadingBox}>
              <ActivityIndicator size="large" />
              <Text style={styles.loadingText}>Đang tải chi tiết...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.tabRow}>
                <Pressable
                  style={[
                    styles.tabBtn,
                    detailTab === "INFO" && styles.tabBtnActive,
                  ]}
                  onPress={() => setDetailTab("INFO")}
                >
                  <Text
                    style={[
                      styles.tabBtnText,
                      detailTab === "INFO" && styles.tabBtnTextActive,
                    ]}
                  >
                    Thông tin
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.tabBtn,
                    detailTab === "LOGS" && styles.tabBtnActive,
                  ]}
                  onPress={() => setDetailTab("LOGS")}
                >
                  <Text
                    style={[
                      styles.tabBtnText,
                      detailTab === "LOGS" && styles.tabBtnTextActive,
                    ]}
                  >
                    Lịch sử
                  </Text>
                </Pressable>
              </View>

              {detailTab === "INFO" ? (
                <>
                  <View style={styles.detailCard}>
                    <View style={styles.detailTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailName}>
                          {getCustomerDisplayName(detail)}
                        </Text>
                        <Text style={styles.detailPhone}>
                          {formatVietnamesePhone(detail?.phone)}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: selectedStatusTone.bg,
                            borderColor: selectedStatusTone.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: selectedStatusTone.text },
                          ]}
                        >
                          {getStatusLabel(detail?.status)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.infoGrid}>
                      <InfoRow
                        label="Số điện thoại"
                        value={formatVietnamesePhone(detail?.phone)}
                        copyValue={formatVietnamesePhone(detail?.phone)}
                      />
                      <InfoRow
                        label="SĐT xác thực"
                        value={getPhoneVerifiedText(
                          Boolean(detail?.isPhoneVerified),
                        )}
                      />
                      <InfoRow
                        label="Tổng chuyến"
                        value={String(detail?.totalTrips || 0)}
                      />
                      <InfoRow
                        label="Ngày tạo"
                        value={formatDateTime(detail?.createdAt)}
                      />
                      <InfoRow
                        label="Cập nhật"
                        value={formatDateTime(detail?.updatedAt)}
                      />
                      <InfoRow
                        label="Ngày khoá"
                        value={formatDateTime(detail?.suspendedAt)}
                      />
                      <InfoRow
                        label="Lý do khoá"
                        value={detail?.suspendReason || "--"}
                      />
                    </View>
                  </View>

                  <SectionTitle>Thao tác</SectionTitle>

                  <View style={styles.actionPanel}>
                    {detail?.status === "SUSPENDED" ? (
                      <Pressable
                        style={styles.primaryBtn}
                        onPress={() => openActionModal("UNSUSPEND")}
                      >
                        <Text style={styles.primaryBtnText}>
                          Mở khoá khách hàng
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={styles.dangerBtn}
                        onPress={() => openActionModal("SUSPEND")}
                      >
                        <Text style={styles.dangerBtnText}>
                          Khoá khách hàng
                        </Text>
                      </Pressable>
                    )}

                    {actionExpanded ? (
                      <View style={styles.inlineActionBox}>
                        <Text style={styles.inlineActionTitle}>
                          {getActionTitle(actionType)}
                        </Text>

                        <TextInput
                          value={actionReason}
                          onChangeText={setActionReason}
                          placeholder={getActionPlaceholder(actionType)}
                          placeholderTextColor="#9ca3af"
                          style={[styles.textInput, styles.dialogInput]}
                          multiline
                          editable={!actionLoading}
                        />

                        <View style={styles.dialogActions}>
                          <Pressable
                            style={styles.secondaryBtn}
                            onPress={closeActionModal}
                            disabled={actionLoading}
                          >
                            <Text style={styles.secondaryBtnText}>Huỷ</Text>
                          </Pressable>

                          <Pressable
                            style={[
                              actionType === "SUSPEND"
                                ? styles.dangerBtn
                                : styles.primaryBtn,
                              actionLoading && styles.btnDisabled,
                            ]}
                            onPress={handleConfirmAction}
                            disabled={actionLoading}
                          >
                            {actionLoading ? (
                              <ActivityIndicator color="#fff" />
                            ) : (
                              <Text
                                style={
                                  actionType === "SUSPEND"
                                    ? styles.dangerBtnText
                                    : styles.primaryBtnText
                                }
                              >
                                Xác nhận
                              </Text>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </>
              ) : (
                <>
                  {logs.length === 0 ? (
                    <View style={styles.emptyMiniBox}>
                      <Text style={styles.emptyTitle}>Chưa có lịch sử</Text>
                      <Text style={styles.emptyText}>
                        Khách hàng này chưa có log thao tác.
                      </Text>
                    </View>
                  ) : (
                    logs.map((log) => (
                      <View key={log.id} style={styles.logCard}>
                        <Text style={styles.logTitle}>
                          {log.action || "--"}
                        </Text>
                        <Text style={styles.logLine}>
                          Từ: {log.fromStatus || "--"} → {log.toStatus || "--"}
                        </Text>
                        <Text style={styles.logLine}>
                          Người thao tác: {log.actorUsername || "--"}
                        </Text>
                        <Text style={styles.logLine}>
                          Thời gian: {formatDateTime(log.createdAt)}
                        </Text>
                        <Text style={styles.logLine}>
                          Ghi chú: {log.note || "--"}
                        </Text>
                      </View>
                    ))
                  )}
                </>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f6f8",
  },
  keyboardRoot: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "android" ? 16 : 8,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    fontSize: 24,
    lineHeight: 28,
    color: "#111827",
    fontWeight: "700",
  },
  headerCenter: {
    flex: 1,
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: "#6b7280",
  },
  headerRight: {
    width: 40,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
    gap: 12,
  },
  searchBox: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  sectionBlock: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 10,
  },
  textInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  chipActive: {
    backgroundColor: "#1d4ed8",
    borderColor: "#1d4ed8",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  loadingBox: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  loadingText: {
    fontSize: 14,
    color: "#6b7280",
  },
  emptyBox: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  emptyMiniBox: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 12,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTopLeft: {
    flex: 1,
  },
  customerName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },
  customerPhone: {
    marginTop: 4,
    fontSize: 14,
    color: "#6b7280",
  },
  statusBadge: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  infoGrid: {
    gap: 10,
  },
  infoItem: {
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "700",
  },
  infoValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
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
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  cardFooterText: {
    fontSize: 13,
    color: "#2563eb",
    fontWeight: "700",
  },
  loadMoreBtn: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  listWrap: {
    gap: 12,
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
    backgroundColor: "#f4f6f8",
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
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
  modalContent: {
    padding: 16,
    paddingBottom: 44,
    gap: 14,
  },
  actionPanel: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
  },
  inlineActionBox: {
    marginTop: 14,
    gap: 12,
  },

  inlineActionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  loadMoreText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  sheet: {
    width: "100%",
    maxWidth: 430,
    height: "88%",
    backgroundColor: "#f4f6f8",
    borderRadius: 24,
    overflow: "hidden",
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  sheetSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#6b7280",
  },
  closeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
  },
  sheetLoadingBox: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#ffffff",
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tabBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  tabBtnActive: {
    backgroundColor: "#1d4ed8",
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#374151",
  },
  tabBtnTextActive: {
    color: "#ffffff",
  },
  sheetContent: {
    padding: 16,
    gap: 12,
  },
  detailCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 12,
  },
  detailTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  detailName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  detailPhone: {
    marginTop: 4,
    fontSize: 14,
    color: "#6b7280",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    marginTop: 4,
  },
  actionGroup: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 12,
  },
  primaryBtn: {
    height: 46,
    borderRadius: 14,
    backgroundColor: "#1d4ed8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  dangerBtn: {
    height: 46,
    borderRadius: 14,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  dangerBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryBtnText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  helperText: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
  },
  logCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 8,
  },
  logTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  logAction: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  logTime: {
    fontSize: 12,
    color: "#6b7280",
  },
  logLine: {
    fontSize: 13,
    color: "#374151",
    lineHeight: 18,
  },
  dialog: {
    margin: 20,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  dialogSubtitle: {
    fontSize: 13,
    color: "#6b7280",
  },
  dialogInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  dialogActions: {
    flexDirection: "row",
    gap: 10,
  },
  logTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
});
