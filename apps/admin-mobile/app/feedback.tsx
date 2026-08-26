// Path: goviet247/apps/admin-mobile/app/feedback.tsx
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
import {
  FeedbackActorRole,
  FeedbackItem,
  FeedbackStatus,
  fetchAdminFeedbackDetail,
  fetchAdminFeedbacks,
  updateAdminFeedback,
} from "../services/adminFeedbackApi";

const PAGE_SIZE = 10;

type GroupTab = "pending" | "resolved";
type StatusFilter = "ALL" | "NEW" | "IN_REVIEW" | "RESOLVED" | "CLOSED";

function formatDateTime(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleString("vi-VN", {
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function getActorRoleLabel(value?: string | null) {
  if (value === "RIDER") return "Rider";
  if (value === "DRIVER") return "Driver";
  return "--";
}

function getSourceLabel(value?: string | null) {
  switch (value) {
    case "RIDER_PROFILE":
      return "Rider • Hồ sơ";
    case "RIDER_TRIP_HISTORY":
      return "Rider • Lịch sử chuyến";
    case "DRIVER_MENU":
      return "Driver • Menu";
    case "DRIVER_TRIP_HISTORY":
      return "Driver • Lịch sử chuyến";
    default:
      return value || "--";
  }
}

function getStatusLabel(value?: string | null) {
  switch (value) {
    case "NEW":
      return "Mới";
    case "IN_REVIEW":
      return "Đang xử lý";
    case "RESOLVED":
      return "Đã xử lý";
    case "CLOSED":
      return "Đóng";
    default:
      return value || "--";
  }
}

function getStatusTone(value?: string | null) {
  switch (value) {
    case "NEW":
      return {
        bg: "#fef2f2",
        border: "#fecaca",
        text: "#dc2626",
      };
    case "IN_REVIEW":
      return {
        bg: "#fff7ed",
        border: "#fed7aa",
        text: "#ea580c",
      };
    case "RESOLVED":
      return {
        bg: "#ecfdf3",
        border: "#bbf7d0",
        text: "#15803d",
      };
    case "CLOSED":
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

function getStatusParam(groupTab: GroupTab, status: StatusFilter) {
  if (status !== "ALL") return status;
  return groupTab === "resolved" ? "RESOLVED,CLOSED" : "NEW,IN_REVIEW";
}

function belongsToGroup(groupTab: GroupTab, status?: string | null) {
  const normalized = String(status || "")
    .trim()
    .toUpperCase();

  if (groupTab === "resolved") {
    return ["RESOLVED", "CLOSED"].includes(normalized);
  }

  return ["NEW", "IN_REVIEW"].includes(normalized);
}

function showMessage(title: string, message: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.alert(`${title}\n\n${message}`);
    return;
  }

  Alert.alert(title, message);
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

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "--"}</Text>
    </View>
  );
}

function DetailField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value?: string | null;
  multiline?: boolean;
}) {
  return (
    <View style={styles.detailField}>
      <Text style={styles.detailFieldLabel}>{label}</Text>
      <Text
        style={[
          styles.detailFieldValue,
          multiline && styles.detailFieldValueMultiline,
        ]}
      >
        {value || "--"}
      </Text>
    </View>
  );
}

function FeedbackCard({
  item,
  onPress,
}: {
  item: FeedbackItem;
  onPress: () => void;
}) {
  const tone = getStatusTone(item.status);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardTopLeft}>
          <Text style={styles.cardTitle}>
            {item.subject?.trim() || "Góp ý chung"}
          </Text>
          <Text style={styles.cardTime}>{formatDateTime(item.createdAt)}</Text>
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

      <Text style={styles.cardMessage} numberOfLines={3}>
        {item.message?.trim() || "--"}
      </Text>

      <View style={styles.metaRow}>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>
            {getActorRoleLabel(item.actorRole)}
          </Text>
        </View>
        <Text style={styles.metaText}>{item.senderName || "Chưa có tên"}</Text>
      </View>

      <Text style={styles.metaSubText}>{item.senderPhone || "--"}</Text>
      <Text style={styles.metaSubText}>{getSourceLabel(item.source)}</Text>

      {item.tripId ? (
        <Text style={styles.tripText}>Trip: {item.tripId}</Text>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.viewDetailText}>Xem chi tiết</Text>
      </View>
    </Pressable>
  );
}

export default function FeedbackScreen() {
  const [groupTab, setGroupTab] = useState<GroupTab>("pending");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [actorRole, setActorRole] = useState<FeedbackActorRole | "ALL">("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");

  const [page, setPage] = useState(1);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [meta, setMeta] = useState<{
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(
    null,
  );

  const [editStatus, setEditStatus] = useState<FeedbackStatus>("NEW");
  const [editAdminNote, setEditAdminNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQDebounced(q.trim());
    }, 350);

    return () => clearTimeout(timer);
  }, [q]);

  const queryParams = useMemo(() => {
    return {
      q: qDebounced,
      actorRole,
      status: getStatusParam(groupTab, status),
      page,
      pageSize: PAGE_SIZE,
    };
  }, [actorRole, groupTab, page, qDebounced, status]);

  const loadFeedbacks = useCallback(
    async (
      showRefreshSpinner = false,
      pageOverride?: number,
      replaceMode?: boolean,
    ) => {
      const targetPage = pageOverride || page;
      const shouldReplace = replaceMode ?? targetPage === 1;

      try {
        if (showRefreshSpinner) {
          setRefreshing(true);
        } else if (targetPage > 1) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const res = await fetchAdminFeedbacks({
          q: qDebounced,
          actorRole,
          status: getStatusParam(groupTab, status),
          page: targetPage,
          pageSize: PAGE_SIZE,
        });

        setMeta(res.meta || null);

        if (shouldReplace) {
          setItems(res.items || []);
        } else {
          setItems((prev) => {
            const map = new Map<string, FeedbackItem>();

            prev.forEach((item) => map.set(item.id, item));
            (res.items || []).forEach((item) => map.set(item.id, item));

            return Array.from(map.values());
          });
        }
      } catch (error: any) {
        console.error("load feedbacks error:", error);
        showMessage("Lỗi", error?.message || "Không thể tải thư góp ý.");
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [actorRole, groupTab, page, qDebounced, status],
  );

  function closeDetail() {
    setDetailVisible(false);
    setSelectedFeedback(null);
    setDetailLoading(false);
    setSaving(false);
    setEditAdminNote("");
    setEditStatus("NEW");
  }

  async function openDetail(feedbackId: string) {
    try {
      setDetailVisible(true);
      setDetailLoading(true);
      setSelectedFeedback(null);

      const detail = await fetchAdminFeedbackDetail(feedbackId);

      if (!detail) {
        throw new Error("Không tìm thấy chi tiết góp ý.");
      }

      setSelectedFeedback(detail);
      setEditStatus(
        (String(detail.status || "NEW")
          .trim()
          .toUpperCase() as FeedbackStatus) || "NEW",
      );
      setEditAdminNote(String(detail.adminNote || ""));
    } catch (error: any) {
      console.error("open detail error:", error);
      closeDetail();
      showMessage("Lỗi", error?.message || "Không thể tải chi tiết góp ý.");
    } finally {
      setDetailLoading(false);
    }
  }

  function patchListAfterSave(updated: FeedbackItem) {
    setItems((prev) => {
      const next = prev.map((item) =>
        item.id === updated.id ? { ...item, ...updated } : item,
      );
      return next.filter((item) => belongsToGroup(groupTab, item.status));
    });

    setSelectedFeedback((prev) => (prev ? { ...prev, ...updated } : updated));

    if (!belongsToGroup(groupTab, updated.status)) {
      closeDetail();
    }
  }

  async function handleSave() {
    if (!selectedFeedback?.id) return;

    try {
      setSaving(true);

      await updateAdminFeedback(selectedFeedback.id, {
        status: editStatus,
        adminNote: editAdminNote.trim(),
      });

      patchListAfterSave({
        ...selectedFeedback,
        status: editStatus,
        adminNote: editAdminNote.trim(),
      });
      showMessage("Thành công", "Đã cập nhật góp ý.");
      void fetchAdminFeedbackDetail(selectedFeedback.id)
        .then((refreshed) => {
          if (refreshed) patchListAfterSave(refreshed);
        })
        .catch((error) => console.error("refresh feedback after save error:", error));
    } catch (error: any) {
      console.error("save feedback error:", error);
      showMessage("Lỗi", error?.message || "Không thể cập nhật góp ý.");
    } finally {
      setSaving(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadFeedbacks(false);

      const onBackPress = () => {
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

      return () => {
        subscription.remove();
      };
    }, [detailVisible, loadFeedbacks]),
  );

  useEffect(() => {
    loadFeedbacks(false);
  }, [queryParams, loadFeedbacks]);

  function handleChangeGroupTab(nextTab: GroupTab) {
    setGroupTab(nextTab);
    setStatus("ALL");
    setPage(1);
    setItems([]);
  }

  function handleChangeActorRole(nextRole: FeedbackActorRole | "ALL") {
    setActorRole(nextRole);
    setPage(1);
    setItems([]);
  }

  function handleChangeStatus(nextStatus: StatusFilter) {
    setStatus(nextStatus);
    setPage(1);
    setItems([]);
  }

  function handleRefresh() {
    setPage(1);
    loadFeedbacks(true, 1, true);
  }

  function handleLoadMore() {
    if (loadingMore) return;
    if (!meta?.totalPages) return;
    if (page >= meta.totalPages) return;

    const nextPage = page + 1;
    setPage(nextPage);
    loadFeedbacks(false, nextPage, false);
  }

  const groupLabel = groupTab === "pending" ? "Chưa xử lý" : "Đã xử lý";
  const currentTotal = Number(meta?.total || 0);
  const selectedTone = getStatusTone(selectedFeedback?.status);
  const totalPages = Math.max(1, Number(meta?.totalPages || 1));
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <View style={styles.headerRow}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.replace("/home")}
            >
              <Text style={styles.backButtonText}>← Trang chủ</Text>
            </Pressable>

            <Pressable style={styles.refreshButton} onPress={handleRefresh}>
              <Text style={styles.refreshButtonText}>Tải lại</Text>
            </Pressable>
          </View>

          <Text style={styles.pageTitle}>Thư Góp Ý</Text>
          <Text style={styles.pageSubtitle}>
            Xem góp ý từ Rider và Driver trên mobile.
          </Text>

          <View style={styles.tabRow}>
            <Pressable
              style={[
                styles.tabButton,
                groupTab === "pending" && styles.tabButtonActive,
              ]}
              onPress={() => handleChangeGroupTab("pending")}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  groupTab === "pending" && styles.tabButtonTextActive,
                ]}
              >
                Chưa xử lý
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tabButton,
                groupTab === "resolved" && styles.tabButtonActive,
              ]}
              onPress={() => handleChangeGroupTab("resolved")}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  groupTab === "resolved" && styles.tabButtonTextActive,
                ]}
              >
                Đã xử lý
              </Text>
            </Pressable>
          </View>

          <View style={styles.filtersBox}>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Tìm tên, số điện thoại, nội dung..."
              placeholderTextColor="#98a2b3"
              style={styles.searchInput}
            />

            <SectionTitle>Vai trò</SectionTitle>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              <FilterChip
                label="Tất cả"
                active={actorRole === "ALL"}
                onPress={() => handleChangeActorRole("ALL")}
              />
              <FilterChip
                label="Rider"
                active={actorRole === "RIDER"}
                onPress={() => handleChangeActorRole("RIDER")}
              />
              <FilterChip
                label="Driver"
                active={actorRole === "DRIVER"}
                onPress={() => handleChangeActorRole("DRIVER")}
              />
            </ScrollView>

            <SectionTitle>Trạng thái</SectionTitle>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              <FilterChip
                label="Tất cả"
                active={status === "ALL"}
                onPress={() => handleChangeStatus("ALL")}
              />

              {groupTab === "pending" ? (
                <>
                  <FilterChip
                    label="Mới"
                    active={status === "NEW"}
                    onPress={() => handleChangeStatus("NEW")}
                  />
                  <FilterChip
                    label="Đang xử lý"
                    active={status === "IN_REVIEW"}
                    onPress={() => handleChangeStatus("IN_REVIEW")}
                  />
                </>
              ) : (
                <>
                  <FilterChip
                    label="Đã xử lý"
                    active={status === "RESOLVED"}
                    onPress={() => handleChangeStatus("RESOLVED")}
                  />
                  <FilterChip
                    label="Đóng"
                    active={status === "CLOSED"}
                    onPress={() => handleChangeStatus("CLOSED")}
                  />
                </>
              )}
            </ScrollView>
          </View>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Danh sách góp ý</Text>
            <Text style={styles.summaryMeta}>
              Nhóm: {groupLabel} • Tổng: {currentTotal}
            </Text>
          </View>

          {loading && page === 1 ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" />
              <Text style={styles.loadingText}>Đang tải thư góp ý...</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Chưa có dữ liệu</Text>
              <Text style={styles.emptyText}>
                Không tìm thấy thư góp ý phù hợp với bộ lọc hiện tại.
              </Text>
            </View>
          ) : (
            <View style={styles.listBox}>
              {items.map((item) => (
                <FeedbackCard
                  key={item.id}
                  item={item}
                  onPress={() => openDetail(item.id)}
                />
              ))}

              <View style={styles.paginationCard}>
                <Text style={styles.paginationText}>
                  Trang {page} / {totalPages}
                </Text>

                <View style={styles.paginationActions}>
                  <Pressable
                    disabled={!canGoPrev || loadingMore}
                    onPress={() => {
                      const prevPage = Math.max(1, page - 1);
                      setPage(prevPage);
                      loadFeedbacks(false, prevPage, true);
                    }}
                    style={[
                      styles.secondaryPageButton,
                      (!canGoPrev || loadingMore) && styles.pageButtonDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.secondaryPageButtonText,
                        (!canGoPrev || loadingMore) &&
                          styles.pageButtonDisabledText,
                      ]}
                    >
                      Trang trước
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={!canGoNext || loadingMore}
                    onPress={() => {
                      const nextPage = page + 1;
                      setPage(nextPage);
                      loadFeedbacks(false, nextPage, true);
                    }}
                    style={[
                      styles.primaryPageButton,
                      (!canGoNext || loadingMore) &&
                        styles.pageButtonPrimaryDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.primaryPageButtonText,
                        (!canGoNext || loadingMore) &&
                          styles.pageButtonPrimaryDisabledText,
                      ]}
                    >
                      Trang sau
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={detailVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeDetail}
      >
        <SafeAreaView
          style={styles.modalContainer}
          edges={["left", "right", "bottom"]}
        >
          <View
            style={[
              styles.modalHeader,
              Platform.OS === "ios" && styles.modalHeaderIOS,
            ]}
          >
            <Pressable style={styles.modalHeaderButton} onPress={closeDetail}>
              <Text style={styles.modalHeaderButtonText}>Đóng</Text>
            </Pressable>

            <Text style={styles.modalTitle}>Chi tiết góp ý</Text>

            <View style={styles.modalHeaderSpacer} />
          </View>

          {detailLoading ? (
            <View style={styles.modalLoadingBox}>
              <ActivityIndicator size="large" />
              <Text style={styles.loadingText}>Đang tải chi tiết...</Text>
            </View>
          ) : !selectedFeedback ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Không có chi tiết</Text>
              <Text style={styles.emptyText}>
                Không tải được dữ liệu góp ý.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[
                styles.modalContent,
                Platform.OS === "ios" && styles.modalContentIOS,
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.detailCard}>
                <View style={styles.detailTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailTitle}>
                      {selectedFeedback.subject?.trim() || "Góp ý chung"}
                    </Text>
                    <Text style={styles.detailSubtitle}>
                      ID: {selectedFeedback.id || "--"}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: selectedTone.bg,
                        borderColor: selectedTone.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: selectedTone.text },
                      ]}
                    >
                      {getStatusLabel(selectedFeedback.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoGrid}>
                  <InfoRow
                    label="Người gửi"
                    value={
                      selectedFeedback.senderName ||
                      selectedFeedback.user?.displayName ||
                      "--"
                    }
                  />
                  <InfoRow
                    label="Số điện thoại"
                    value={selectedFeedback.senderPhone || "--"}
                  />
                  <InfoRow
                    label="Vai trò"
                    value={getActorRoleLabel(selectedFeedback.actorRole)}
                  />
                  <InfoRow
                    label="Nguồn gửi"
                    value={getSourceLabel(selectedFeedback.source)}
                  />
                  <InfoRow
                    label="Ngày gửi"
                    value={formatDateTime(selectedFeedback.createdAt)}
                  />
                  <InfoRow
                    label="Cập nhật"
                    value={formatDateTime(selectedFeedback.updatedAt)}
                  />
                </View>

                <DetailField
                  label="Nội dung góp ý"
                  value={selectedFeedback.message || "--"}
                  multiline
                />
              </View>

              {selectedFeedback.trip ? (
                <View style={styles.detailCard}>
                  <Text style={styles.blockTitle}>
                    Thông tin chuyến liên quan
                  </Text>

                  <View style={styles.infoGrid}>
                    <InfoRow
                      label="Mã chuyến"
                      value={selectedFeedback.trip.id}
                    />
                    <InfoRow
                      label="Trạng thái chuyến"
                      value={selectedFeedback.trip.status || "--"}
                    />
                    <InfoRow
                      label="Giờ đón"
                      value={formatDateTime(selectedFeedback.trip.pickupTime)}
                    />
                    <InfoRow
                      label="Khách hàng"
                      value={selectedFeedback.trip.riderName || "--"}
                    />
                    <InfoRow
                      label="SĐT khách"
                      value={selectedFeedback.trip.riderPhone || "--"}
                    />
                    <InfoRow
                      label="Loại xe"
                      value={selectedFeedback.trip.carType || "--"}
                    />
                  </View>

                  <DetailField
                    label="Điểm đón"
                    value={selectedFeedback.trip.pickupAddress || "--"}
                    multiline
                  />
                  <DetailField
                    label="Điểm trả"
                    value={selectedFeedback.trip.dropoffAddress || "--"}
                    multiline
                  />
                </View>
              ) : null}

              <View style={styles.detailCard}>
                <Text style={styles.blockTitle}>Xử lý góp ý</Text>

                <Text style={styles.inputLabel}>Trạng thái xử lý</Text>
                <View style={styles.statusOptionsWrap}>
                  <FilterChip
                    label="Mới"
                    active={editStatus === "NEW"}
                    onPress={() => setEditStatus("NEW")}
                  />
                  <FilterChip
                    label="Đang xử lý"
                    active={editStatus === "IN_REVIEW"}
                    onPress={() => setEditStatus("IN_REVIEW")}
                  />
                  <FilterChip
                    label="Đã xử lý"
                    active={editStatus === "RESOLVED"}
                    onPress={() => setEditStatus("RESOLVED")}
                  />
                  <FilterChip
                    label="Đóng"
                    active={editStatus === "CLOSED"}
                    onPress={() => setEditStatus("CLOSED")}
                  />
                </View>

                <Text style={styles.inputLabel}>Ghi chú admin</Text>
                <TextInput
                  value={editAdminNote}
                  onChangeText={setEditAdminNote}
                  placeholder="Nhập ghi chú nội bộ để lưu lại quá trình xử lý..."
                  placeholderTextColor="#98a2b3"
                  multiline
                  textAlignVertical="top"
                  style={styles.noteInput}
                />

                <Text style={styles.helperText}>
                  Người xử lý:{" "}
                  {selectedFeedback?.resolvedBy?.username || "Chưa có"} • Thời
                  gian xử lý: {formatDateTime(selectedFeedback?.resolvedAt)}
                </Text>

                <View style={styles.modalActionRow}>
                  <Pressable
                    style={[styles.modalGhostButton]}
                    onPress={closeDetail}
                    disabled={saving}
                  >
                    <Text style={styles.modalGhostButtonText}>Đóng</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.modalPrimaryButton,
                      saving && styles.btnDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    <Text style={styles.modalPrimaryButtonText}>
                      {saving ? "Đang lưu..." : "Lưu cập nhật"}
                    </Text>
                  </Pressable>
                </View>
              </View>
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
    backgroundColor: "#f7f8fa",
  },
  keyboardRoot: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 110,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  backButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d0d7de",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  refreshButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d0d7de",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },
  pageSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "#667085",
  },
  tabRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  tabButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d0d7de",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  tabButtonActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475467",
  },
  tabButtonTextActive: {
    color: "#1d4ed8",
  },
  filtersBox: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    gap: 10,
  },
  searchInput: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d0d7de",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#111827",
  },
  sectionTitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
    color: "#344054",
  },
  chipRow: {
    gap: 8,
    paddingRight: 12,
  },
  chip: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d0d7de",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475467",
  },
  chipTextActive: {
    color: "#1d4ed8",
  },
  summaryBox: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  summaryMeta: {
    marginTop: 6,
    fontSize: 13,
    color: "#667085",
  },
  loadingBox: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#667085",
  },
  emptyBox: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  emptyText: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 14,
    color: "#667085",
  },
  listBox: {
    marginTop: 16,
    gap: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTopLeft: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },
  cardTime: {
    marginTop: 4,
    fontSize: 12,
    color: "#667085",
  },
  statusBadge: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  cardMessage: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: "#344054",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  },
  roleBadge: {
    minHeight: 26,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  metaText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  metaSubText: {
    marginTop: 4,
    fontSize: 13,
    color: "#667085",
  },
  tripText: {
    marginTop: 6,
    fontSize: 13,
    color: "#1d4ed8",
    fontWeight: "600",
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    alignItems: "flex-end",
  },
  viewDetailText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  infoRow: {
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: "#667085",
  },
  infoValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
  },
  paginationCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
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
  secondaryPageButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d0d7de",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryPageButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  primaryPageButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#1d4ed8",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryPageButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  pageButtonDisabled: {
    backgroundColor: "#f9fafb",
    borderColor: "#eaecf0",
  },
  pageButtonDisabledText: {
    color: "#98a2b3",
  },
  pageButtonPrimaryDisabled: {
    backgroundColor: "#cbd5e1",
  },
  pageButtonPrimaryDisabledText: {
    color: "#f8fafc",
  },
  loadMoreButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d0d7de",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  loadMoreButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#f7f8fa",
  },
  modalHeader: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalHeaderIOS: {
    paddingTop: 52,
    minHeight: 96,
  },
  modalHeaderButton: {
    minWidth: 56,
  },
  modalHeaderButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  modalHeaderSpacer: {
    minWidth: 56,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },
  modalLoadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalContent: {
    padding: 16,
    paddingBottom: 90,
    gap: 14,
  },
  modalContentIOS: {
    paddingBottom: 48,
  },
  detailCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
  },
  detailTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  detailSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#667085",
  },
  infoGrid: {
    marginTop: 14,
    gap: 12,
  },
  detailField: {
    marginTop: 14,
    gap: 6,
  },
  detailFieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#667085",
  },
  detailFieldValue: {
    fontSize: 14,
    lineHeight: 21,
    color: "#111827",
    fontWeight: "500",
  },
  detailFieldValueMultiline: {
    lineHeight: 22,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  inputLabel: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "700",
    color: "#344054",
  },
  statusOptionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  noteInput: {
    minHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d0d7de",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#111827",
  },
  helperText: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: "#667085",
  },
  modalActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  modalGhostButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d0d7de",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  modalGhostButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  modalPrimaryButton: {
    flex: 1.2,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  modalPrimaryButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
