import { useWalletRecordSearch } from "../hooks/useWalletRecordSearch";
import { readPendingWalletOperation, submitWalletOperation, PendingWalletOperation } from "../services/walletOperations";
// Path: goviet247/apps/admin-mobile/app/
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
  adjustAddDriverWallet,
  approveWithdrawRequest,
  DriverWalletListItem,
  DriverWalletTransactionItem,
  DriverWithdrawRequestItem,
  fetchDriverWallets,
  fetchDriverWalletSummary,
  fetchDriverWalletTransactions,
  fetchLedgerTransactions,
  fetchWithdrawRequests,
  markWithdrawRequestPaid,
  rejectWithdrawRequest,
  subtractDriverWallet,
  topupDriverWallet,
} from "../services/adminWalletsApi";
import {
  formatVietnamesePhone,
  normalizeSmartSearch,
} from "../utils/phone";

type WalletTabKey = "WALLETS" | "WITHDRAWS" | "PENALTIES" | "LEDGER";
type WalletActionMode = "TOPUP" | "ADJUST_ADD" | "SUBTRACT";

const TAB_ITEMS: { key: WalletTabKey; label: string }[] = [
  { key: "WALLETS", label: "Danh sách ví" },
  { key: "WITHDRAWS", label: "Yêu cầu rút tiền" },
  // { key: "PENALTIES", label: "Phạt huỷ chuyến" },
  { key: "LEDGER", label: "Lịch sử ví" },
];

function formatMoney(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function formatDateTimeVN(input: string | null | undefined) {
  if (!input) return "N/A";

  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "N/A";

  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function normalizeDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function formatInputMoney(value: string) {
  const digits = normalizeDigits(value);
  if (!digits) return "";
  return Number(digits).toLocaleString("vi-VN");
}

function getKycLabel(status: string | null | undefined) {
  const key = String(status || "").toUpperCase();
  if (key === "VERIFIED") return "Đã duyệt";
  if (key === "PENDING") return "Chờ duyệt";
  if (key === "REJECTED") return "Từ chối";
  if (key === "SUSPENDED") return "Tạm khoá";
  return key || "N/A";
}

function getTxnTypeLabel(type: string | null | undefined) {
  const key = String(type || "").toUpperCase();

  if (key === "TOPUP") return "Nạp tiền";
  if (key === "ADJUST_ADD") return "Điều chỉnh cộng";
  if (key === "ADJUST_SUBTRACT") return "Điều chỉnh trừ";
  if (key === "COMMISSION_HOLD") return "Giữ phí môi giới";
  if (key === "COMMISSION_REFUND") return "Hoàn phí môi giới";
  // if (key === "TRIP_CANCEL_PENALTY") return "Phạt huỷ chuyến";
  if (key === "WITHDRAW_REQUEST") return "Yêu cầu rút";
  if (key === "WITHDRAW_REJECT_REFUND") return "Hoàn do từ chối rút";
  if (key === "WITHDRAW_PAID") return "Đã trả rút tiền";

  return key || "N/A";
}

function getWithdrawStatusLabel(status: string | null | undefined) {
  const key = String(status || "").toUpperCase();
  if (key === "PENDING") return "Chờ xử lý";
  if (key === "APPROVED") return "Đã duyệt";
  if (key === "REJECTED") return "Từ chối";
  if (key === "PAID") return "Đã chuyển khoản";
  return key || "N/A";
}

function getDriverDisplayName(item: any) {
  const fullName = String(
    item?.fullName ||
      item?.driverProfile?.fullName ||
      item?.driverProfile?.user?.fullName ||
      "",
  ).trim();

  const displayName = String(
    item?.displayName ||
      item?.user?.displayName ||
      item?.driverProfile?.user?.displayName ||
      "",
  ).trim();

  const isBadDefaultName = (value: string) => {
    const text = value.trim().toLowerCase();
    return !text || text === "user" || text === "tài xế" || text === "driver";
  };

  if (!isBadDefaultName(fullName)) return fullName;
  if (!isBadDefaultName(displayName)) return displayName;

  return (
    item?.phone ||
    item?.user?.phone ||
    item?.user?.phones?.[0]?.e164 ||
    item?.driverProfile?.user?.phone ||
    item?.driverProfile?.user?.phones?.[0]?.e164 ||
    "Chưa có tên"
  );
}

function getDriverPhone(item: any) {
  const raw =
    item?.phone ||
    item?.user?.phone ||
    item?.user?.phones?.[0]?.e164 ||
    item?.driverProfile?.user?.phone ||
    item?.driverProfile?.user?.phones?.[0]?.e164 ||
    "";

  return formatVietnamesePhone(raw);
}

function isPendingStatus(status: string | null | undefined) {
  return String(status || "").toUpperCase() === "PENDING";
}

function isApprovedStatus(status: string | null | undefined) {
  return String(status || "").toUpperCase() === "APPROVED";
}

async function copyToClipboard(value: string | null | undefined) {
  const text = String(value || "").trim();

  if (!text) {
    Alert.alert("Thiếu dữ liệu", "Không có số tài khoản để copy.");
    return;
  }

  try {
    await Clipboard.setStringAsync(text);
    Alert.alert("Đã copy", `Đã copy số tài khoản:\n${text}`);
  } catch (error) {
    console.error("copy clipboard error:", error);
    Alert.alert("Lỗi", "Không thể copy số tài khoản.");
  }
}

export default function WalletsScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const requestedTab = String(params.tab || "").toUpperCase();
  const initialTab: WalletTabKey = TAB_ITEMS.some(
    (item) => item.key === requestedTab,
  )
    ? (requestedTab as WalletTabKey)
    : "WALLETS";
  const [activeTab, setActiveTab] = useState<WalletTabKey>(initialTab);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [walletSearchText, setWalletSearchText] = useState("");
  const [walletStatus, setWalletStatus] = useState("ALL");

  const [walletItems, setWalletItems] = useState<DriverWalletListItem[]>([]);
  const [walletSummary, setWalletSummary] = useState({
    totalDrivers: 0,
    verifiedDrivers: 0,
    totalWalletBalance: 0,
  });
  const withdrawSearch = useWalletRecordSearch(fetchWithdrawRequests);
  const ledgerSearch = useWalletRecordSearch(fetchLedgerTransactions);
  const { items: withdrawItems, setItems: setWithdrawItems } = withdrawSearch;
  const { items: ledgerItems } = ledgerSearch;

  const [walletHistoryExpandedId, setWalletHistoryExpandedId] = useState<
    string | null
  >(null);

  const [walletHistoryLoading, setWalletHistoryLoading] = useState(false);

  const [walletHistoryItems, setWalletHistoryItems] = useState<
    DriverWalletTransactionItem[]
  >([]);

  const [actionExpandedId, setActionExpandedId] = useState<string | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const [actionMode, setActionMode] = useState<WalletActionMode>("TOPUP");

  const [actionDriver, setActionDriver] = useState<DriverWalletListItem | null>(
    null,
  );

  const [actionAmount, setActionAmount] = useState("");
  const [actionNote, setActionNote] = useState("");
  const actionLock = useRef(false);
  const walletLoadVersion = useRef(0);
  const allLoadVersion = useRef(0);
  const walletFilters = useRef({ q: walletSearchText, status: walletStatus });
  walletFilters.current = { q: walletSearchText, status: walletStatus };
  const [pendingOperation, setPendingOperation] = useState<PendingWalletOperation | null>(null);
  const [loadWarning, setLoadWarning] = useState("");

  async function refreshPendingOperation() {
    try { setPendingOperation(await readPendingWalletOperation()); }
    catch (error) { console.error("read pending wallet error:", error); }
  }

  async function checkPendingOperation() {
    if (!pendingOperation || actionLock.current) return;
    actionLock.current = true;
    setActionSubmitting(true);
    try {
      const result = await submitWalletOperation(pendingOperation.driverId, pendingOperation.type, pendingOperation);
      applyWalletReceipt(result);
      setActionExpandedId(null);
      Alert.alert("Đã xác nhận", "Giao dịch đã được ghi nhận một lần. Số dư đang được cập nhật.");
      void loadAll(false, true);
    } catch (error: any) {
      Alert.alert("Kiểm tra giao dịch", error?.message || "Chưa xác nhận được giao dịch.");
    } finally {
      await refreshPendingOperation();
      actionLock.current = false;
      setActionSubmitting(false);
    }
  }

  function applyWalletReceipt(result: any) {
    const profile = result?.item?.profile;
    if (!profile?.id || !Number.isFinite(Number(profile.balance))) return;
    walletLoadVersion.current += 1;
    setWalletItems((current) => current.map((item) => item.id === profile.id ? { ...item, balance: Number(profile.balance) } : item));
  }


  const [withdrawRejectExpandedId, setWithdrawRejectExpandedId] = useState<
    string | null
  >(null);

  const [withdrawRejectReason, setWithdrawRejectReason] = useState("");

  const { totalDrivers, verifiedDrivers, totalWalletBalance } = walletSummary;
  const withdrawPendingCount = withdrawItems.filter((item) =>
    isPendingStatus(item.status),
  ).length;
  const filteredWalletItems = useMemo(() => {
    const q = normalizeSmartSearch(walletSearchText);
    const searchTokens = q.split(/\s+/).filter(Boolean);

    return walletItems.filter((item) => {
      const statusOk =
        walletStatus === "ALL"
          ? true
          : String(item.status || "").toUpperCase() === walletStatus;

      const rawPhone = String(item.phone || "");
      const localPhone = rawPhone.startsWith("+84")
        ? `0${rawPhone.slice(3)}`
        : rawPhone;
      const haystack = normalizeSmartSearch(
        [
          getDriverDisplayName(item),
          rawPhone,
          localPhone,
          item.licensePlate || "",
        ].join(" "),
      );
      const compactHaystack = haystack.replace(/\s+/g, "");
      const searchOk = searchTokens.every(
        (token) => haystack.includes(token) || compactHaystack.includes(token),
      );

      return statusOk && searchOk;
    });
  }, [walletItems, walletSearchText, walletStatus]);

  const loadOnFocus = useRef(loadAll);
  loadOnFocus.current = loadAll;
  useFocusEffect(
    useCallback(() => {
      void loadOnFocus.current(false);
    }, []),
  );

  useEffect(() => {
    if (activeTab !== "WALLETS") return;

    const version = ++walletLoadVersion.current;
    let active = true;
    const timer = setTimeout(() => {
      fetchDriverWallets({
        page: 1,
        pageSize: 100,
        q: walletSearchText.trim(),
        status: walletStatus,
      })
        .then((result) => { if (active && version === walletLoadVersion.current) setWalletItems(result.items || []); })
        .catch((error) =>
          console.error("search driver wallets error:", error),
        );
    }, 350);

    return () => { active = false; clearTimeout(timer); };
  }, [activeTab, walletSearchText, walletStatus]);

  useEffect(() => {
    if (!walletHistoryExpandedId) return;
    let active = true;
    setWalletHistoryLoading(true);
    setWalletHistoryItems([]);
    fetchDriverWalletTransactions(walletHistoryExpandedId, { page: 1, pageSize: 50 })
      .then((data) => { if (active) setWalletHistoryItems(data.items); })
      .catch((error) => { if (active) Alert.alert("Chưa tải được lịch sử ví", error.message); })
      .finally(() => { if (active) setWalletHistoryLoading(false); });
    return () => { active = false; };
  }, [walletHistoryExpandedId]);

  async function loadAll(showRefreshSpinner = false, silentError = false) {
    const version = ++walletLoadVersion.current;
    const allVersion = ++allLoadVersion.current;
    if (showRefreshSpinner) setRefreshing(true);
    else if (!silentError) setLoading(true);
    void refreshPendingOperation();
    const results = await Promise.allSettled([
      fetchDriverWallets({ page: 1, pageSize: 100, q: walletFilters.current.q.trim(), status: walletFilters.current.status }).then((data) => {
        if (version === walletLoadVersion.current) setWalletItems(data.items || []);
      }),
      fetchDriverWalletSummary().then((data) => { if (allVersion === allLoadVersion.current) setWalletSummary(data); }),
      withdrawSearch.refresh(),
      ledgerSearch.refresh(),
    ]);
    if (allVersion !== allLoadVersion.current) return;
    const failed = results.some((result) => result.status === "rejected");
    setLoadWarning(failed ? "Một phần dữ liệu chưa tải được và có thể chưa mới nhất. Kéo xuống để tải lại; không tạo lại giao dịch đã gửi." : "");
    setLoading(false);
    setRefreshing(false);
  }

  function openActionModal(
    mode: WalletActionMode,
    driver: DriverWalletListItem,
  ) {
    if (actionLock.current) return;
    const nextId = actionExpandedId === driver.id ? null : driver.id;

    setActionExpandedId(nextId);

    if (!nextId) {
      setActionDriver(null);
      setActionAmount("");
      setActionNote("");
      return;
    }

    setActionMode(mode);
    setActionDriver(driver);
    setActionAmount("");

    if (mode === "ADJUST_ADD") {
      setActionNote("Hoàn tiền phạt huỷ chuyến - TripID: ");
    } else {
      setActionNote("");
    }
  }

  function closeActionModal() {
    if (actionSubmitting) return;

    setActionExpandedId(null);
    setActionDriver(null);
    setActionAmount("");
    setActionNote("");
  }

  async function handleSubmitAction() {
    if (actionLock.current) return;
    if (!actionDriver?.id) {
      Alert.alert("Thiếu dữ liệu", "Không tìm thấy tài xế để thao tác.");
      return;
    }

    const amountDigits = normalizeDigits(actionAmount);
    const amountNumber = Number(amountDigits || 0);

    if (!amountNumber || amountNumber <= 0) {
      Alert.alert("Thiếu số tiền", "Vui lòng nhập số tiền hợp lệ.");
      return;
    }

    if (!actionNote.trim()) {
      Alert.alert("Thiếu ghi chú", "Vui lòng nhập ghi chú cho giao dịch.");
      return;
    }
    actionLock.current = true;
    try {
      setActionSubmitting(true);

      const payload = {
        amount: amountNumber,
        note: actionNote.trim(),
      };

      let result;
      if (actionMode === "TOPUP") {
        result = await topupDriverWallet(actionDriver.id, payload);
      } else if (actionMode === "ADJUST_ADD") {
        result = await adjustAddDriverWallet(actionDriver.id, payload);
      } else {
        result = await subtractDriverWallet(actionDriver.id, payload);
      }

      applyWalletReceipt(result);
      setActionExpandedId(null);
      setActionDriver(null);
      setActionAmount("");
      setActionNote("");
      Alert.alert("Thành công", "Đã cập nhật ví tài xế.");
      void loadAll(false, true);
    } catch (error: any) {
      console.error("submit wallet action error:", error);
      Alert.alert("Lỗi", error?.message || "Không thể cập nhật ví tài xế.");
    } finally {
      await refreshPendingOperation();
      actionLock.current = false;
      setActionSubmitting(false);
    }
  }

  async function handleApproveWithdraw(item: DriverWithdrawRequestItem) {
    try {
      await approveWithdrawRequest(item.id);
      setWithdrawItems((current) => current.filter((entry) => entry.id !== item.id));
      Alert.alert("Thành công", "Đã duyệt yêu cầu rút tiền.");
      void loadAll(false, true);
    } catch (error: any) {
      console.error("approve withdraw error:", error);
      Alert.alert("Lỗi", error?.message || "Không thể duyệt yêu cầu rút tiền.");
    }
  }

  async function handleMarkWithdrawPaid(item: DriverWithdrawRequestItem) {
    try {
      await markWithdrawRequestPaid(item.id);
      setWithdrawItems((current) => current.filter((entry) => entry.id !== item.id));
      Alert.alert("Thành công", "Đã đánh dấu chuyển khoản thành công.");
      void loadAll(false, true);
    } catch (error: any) {
      console.error("mark paid withdraw error:", error);
      Alert.alert("Lỗi", error?.message || "Không thể cập nhật trạng thái.");
    }
  }

  async function handleRejectWithdraw(item: DriverWithdrawRequestItem) {
    const reason = withdrawRejectReason.trim();
    if (!reason) { Alert.alert("Thiếu lý do", "Vui lòng nhập lý do từ chối."); return; }

    try {
      await rejectWithdrawRequest(item.id, { reason });
      setWithdrawRejectExpandedId(null);
      setWithdrawRejectReason("");
      setWithdrawItems((current) => current.filter((entry) => entry.id !== item.id));
      Alert.alert("Thành công", "Đã từ chối yêu cầu rút tiền.");
      void loadAll(false, true);
    } catch (error: any) {
      console.error("reject withdraw error:", error);
      Alert.alert("Lỗi", error?.message || "Không thể từ chối yêu cầu rút.");
    }
  }

  // async function handleApprovePenalty(item: DriverTripPenaltyItem) {
  //   try {
  //     await approveDriverTripPenalty(item.id);
  //     await loadAll(false);
  //     Alert.alert("Thành công", "Đã duyệt phạt huỷ chuyến.");
  //   } catch (error: any) {
  //     console.error("approve penalty error:", error);
  //     Alert.alert("Lỗi", error?.message || "Không thể duyệt phạt huỷ chuyến.");
  //   }
  // }

  function renderSummaryCards() {
    return (
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Tổng tài xế</Text>
          <Text style={styles.summaryValue}>{totalDrivers}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Tài xế đã duyệt</Text>
          <Text style={styles.summaryValue}>{verifiedDrivers}</Text>
        </View>

        <View style={[styles.summaryCard, styles.summaryCardWide]}>
          <Text style={styles.summaryLabel}>Tổng số dư ví</Text>
          <Text style={styles.summaryValueMoney}>
            {formatMoney(totalWalletBalance)} đ
          </Text>
        </View>
      </View>
    );
  }

  function renderTabBar() {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
      >
        {TAB_ITEMS.map((tab) => {
          const isActive = activeTab === tab.key;
          const badge =
            tab.key === "WITHDRAWS"
              ? withdrawPendingCount
              : 0;

          return (
            <Pressable
              key={tab.key}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  isActive && styles.tabButtonTextActive,
                ]}
              >
                {tab.label}
              </Text>

              {badge > 0 ? (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{badge}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }

  function renderWalletFilters() {
    return (
      <View style={styles.filtersBox}>
        <TextInput
          value={walletSearchText}
          onChangeText={setWalletSearchText}
          placeholder="Tìm theo tên / số điện thoại / biển số"
          placeholderTextColor="#9ca3af"
          style={styles.searchInput}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipRow}
        >
          {[
            { key: "ALL", label: "Tất cả" },
            { key: "VERIFIED", label: "Đã duyệt" },
            { key: "PENDING", label: "Chờ duyệt" },
            { key: "REJECTED", label: "Từ chối" },
            { key: "SUSPENDED", label: "Tạm khoá" },
          ].map((item) => {
            const active = walletStatus === item.key;
            return (
              <Pressable
                key={item.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setWalletStatus(item.key)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  function renderWalletList() {
    return (
      <View style={styles.sectionBox}>
        <Text style={styles.sectionTitle}>Danh sách ví</Text>
        {renderWalletFilters()}

        {filteredWalletItems.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Không có ví tài xế phù hợp.</Text>
          </View>
        ) : (
          filteredWalletItems.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    {getDriverDisplayName(item)}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {getDriverPhone(item)}
                  </Text>
                </View>

                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>
                    {getKycLabel(item.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Số dư ví:</Text>
                <Text style={styles.infoValueStrong}>
                  {formatMoney(item.balance)} đ
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Biển số:</Text>
                <Text style={styles.infoValue}>
                  {item.licensePlate || "Chưa có"}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tạo lúc:</Text>
                <Text style={styles.infoValue}>
                  {formatDateTimeVN(item.createdAt)}
                </Text>
              </View>

              <View style={styles.actionGrid}>
                <Pressable
                  style={[styles.actionButton, styles.greenButton]}
                  onPress={() => openActionModal("TOPUP", item)}
                >
                  <Text style={styles.actionButtonText}>Nạp tiền</Text>
                </Pressable>

                <Pressable
                  style={[styles.actionButton, styles.greenButton]}
                  onPress={() => openActionModal("ADJUST_ADD", item)}
                >
                  <Text style={styles.actionButtonText}>Điều chỉnh cộng</Text>
                </Pressable>

                <Pressable
                  style={[styles.actionButton, styles.orangeButton]}
                  onPress={() => openActionModal("SUBTRACT", item)}
                >
                  <Text style={styles.actionButtonText}>Trừ tiền</Text>
                </Pressable>

                <Pressable
                  style={[styles.actionButton, styles.blueGhostButton]}
                  onPress={() =>
                    setWalletHistoryExpandedId((prev) =>
                      prev === item.id ? null : item.id,
                    )
                  }
                >
                  <Text style={styles.blueGhostButtonText}>
                    {walletHistoryExpandedId === item.id
                      ? "Đóng lịch sử"
                      : "Lịch sử ví"}
                  </Text>
                </Pressable>
              </View>

              {walletHistoryExpandedId === item.id ? (
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>Lịch sử ví gần đây</Text>
                  {walletHistoryLoading ? <ActivityIndicator /> : walletHistoryItems.length ? walletHistoryItems.map((txn) => (
                    <View key={txn.id} style={styles.historyCard}>
                      <Text style={styles.historyTitle}>{getTxnTypeLabel(txn.type)}: {formatMoney(txn.amount)} đ</Text>
                      <Text style={styles.noteText}>{formatDateTimeVN(txn.createdAt)} — Số dư sau: {formatMoney(txn.balanceAfter)} đ</Text>
                      <Text style={styles.noteText}>{txn.note || ""}</Text>
                    </View>
                  )) : <Text style={styles.noteText}>Chưa có giao dịch.</Text>}
                </View>
              ) : null}
              {actionExpandedId === item.id ? (
                <View style={styles.inlineActionCard}>
                  <Text style={styles.inlineActionTitle}>{actionTitle}</Text>

                  <TextInput
                    editable={!actionSubmitting}
                    value={formatInputMoney(actionAmount)}
                    onChangeText={(value) =>
                      setActionAmount(normalizeDigits(value))
                    }
                    placeholder="Nhập số tiền"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    style={styles.modalInput}
                  />

                  <TextInput
                    editable={!actionSubmitting}
                    value={actionNote}
                    onChangeText={setActionNote}
                    placeholder="Ghi chú"
                    placeholderTextColor="#9ca3af"
                    multiline
                    textAlignVertical="top"
                    style={[styles.modalInput, styles.modalTextarea]}
                  />

                  <View style={styles.modalActions}>
                    <Pressable
                      style={[styles.modalButton, styles.modalButtonGhost]}
                      onPress={closeActionModal}
                      disabled={actionSubmitting}
                    >
                      <Text style={styles.modalButtonGhostText}>Huỷ</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.modalButton, styles.modalButtonPrimary]}
                      onPress={handleSubmitAction}
                      disabled={actionSubmitting}
                    >
                      <Text style={styles.modalButtonPrimaryText}>
                        {actionSubmitting ? "Đang xử lý..." : "Xác nhận"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>
    );
  }

  function renderRecordSearch(search: typeof withdrawSearch | typeof ledgerSearch) {
    return (
      <View style={styles.filtersBox}>
        <TextInput
          value={search.query}
          onChangeText={search.setQuery}
          placeholder="Tìm tên tài xế hoặc số điện thoại"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
          accessibilityLabel="Tìm tên tài xế hoặc số điện thoại"
        />
        <Text style={styles.noteText}>Tìm có dấu hoặc không dấu, số 0 hoặc +84.</Text>
        {search.loading ? <ActivityIndicator /> : search.error ? (
          <Pressable onPress={() => { void search.refresh().catch(() => {}); }}>
            <Text style={styles.noteText}>{search.error} Chạm để thử lại.</Text>
          </Pressable>
        ) : <Text style={styles.noteText}>{search.total} kết quả</Text>}
      </View>
    );
  }

  function renderMoreRecords(search: typeof withdrawSearch | typeof ledgerSearch) {
    return search.hasMore ? (
      <Pressable disabled={search.loading} onPress={search.loadMore} style={[styles.modalButton, styles.modalButtonGhost]}>
        <Text style={styles.modalButtonGhostText}>{search.loading ? "Đang tải..." : "Xem thêm"}</Text>
      </Pressable>
    ) : null;
  }

  function renderWithdrawList() {
    return (
      <View style={styles.sectionBox}>
        <Text style={styles.sectionTitle}>Yêu cầu rút tiền</Text>
        {renderRecordSearch(withdrawSearch)}

        {withdrawItems.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{withdrawSearch.loading ? "Đang tìm kiếm..." : withdrawSearch.error ? "Chưa xác nhận được kết quả tìm kiếm." : withdrawSearch.query.trim() ? "Không tìm thấy kết quả phù hợp." : "Chưa có yêu cầu rút tiền."}</Text>
          </View>
        ) : (
          withdrawItems.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    {getDriverDisplayName(item)}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {getDriverPhone(item)}
                  </Text>
                </View>

                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>
                    {getWithdrawStatusLabel(item.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Số tiền:</Text>
                <Text style={styles.infoValueStrong}>
                  {formatMoney(item.amount)} đ
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Số dư hiện tại:</Text>
                <Text style={styles.infoValue}>
                  {formatMoney(item.driverProfile?.balance || 0)} đ
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Ngân hàng:</Text>
                <Text style={styles.infoValue}>
                  {item.bankAccount?.bankName || "N/A"}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>STK:</Text>

                <View style={styles.copyValueWrap}>
                  <Text style={styles.infoValueInline}>
                    {item.bankAccount?.accountNumber || "N/A"}
                  </Text>

                  {item.bankAccount?.accountNumber ? (
                    <Pressable
                      style={styles.copyButton}
                      onPress={() =>
                        copyToClipboard(item.bankAccount?.accountNumber)
                      }
                    >
                      <Text style={styles.copyButtonText}>Copy</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Chủ tài khoản:</Text>
                <Text style={styles.infoValue}>
                  {item.bankAccount?.accountHolderName || "N/A"}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tạo lúc:</Text>
                <Text style={styles.infoValue}>
                  {formatDateTimeVN(item.createdAt)}
                </Text>
              </View>

              {item.rejectReason ? (
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>Lý do từ chối:</Text>
                  <Text style={styles.noteText}>{item.rejectReason}</Text>
                </View>
              ) : null}

              {isPendingStatus(item.status) ? (
                <View style={styles.actionGrid}>
                  <Pressable
                    style={[styles.actionButton, styles.greenButton]}
                    onPress={() => handleApproveWithdraw(item)}
                  >
                    <Text style={styles.actionButtonText}>Duyệt</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.actionButton, styles.orangeButton]}
                    onPress={() => { setWithdrawRejectExpandedId(item.id); setWithdrawRejectReason(""); }}
                  >
                    <Text style={styles.actionButtonText}>Từ chối</Text>
                  </Pressable>
                </View>
              ) : null}

              {withdrawRejectExpandedId === item.id && isPendingStatus(item.status) ? (
                <View style={styles.noteBox}>
                  <TextInput value={withdrawRejectReason} onChangeText={setWithdrawRejectReason} placeholder="Lý do từ chối rút tiền" style={styles.modalInput} />
                  <Pressable onPress={() => handleRejectWithdraw(item)} style={[styles.modalButton, styles.orangeButton]}>
                    <Text style={styles.modalButtonPrimaryText}>Xác nhận từ chối</Text>
                  </Pressable>
                </View>
              ) : null}
              {isApprovedStatus(item.status) ? (
                <View style={styles.actionGrid}>
                  <Pressable
                    style={[styles.actionButton, styles.greenButton]}
                    onPress={() => handleMarkWithdrawPaid(item)}
                  >
                    <Text style={styles.actionButtonText}>Đã chuyển khoản</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))
        )}
        {renderMoreRecords(withdrawSearch)}
      </View>
    );
  }

  function renderLedgerList() {
    return (
      <View style={styles.sectionBox}>
        <Text style={styles.sectionTitle}>Lịch sử ví</Text>
        {renderRecordSearch(ledgerSearch)}

        {ledgerItems.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{ledgerSearch.loading ? "Đang tìm kiếm..." : ledgerSearch.error ? "Chưa xác nhận được kết quả tìm kiếm." : ledgerSearch.query.trim() ? "Không tìm thấy kết quả phù hợp." : "Chưa có giao dịch ví."}</Text>
          </View>
        ) : (
          ledgerItems.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    {getDriverDisplayName(item)}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {getDriverPhone(item)}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    {getTxnTypeLabel(item.type)}
                  </Text>
                </View>

                <Text style={styles.amountHighlight}>
                  {formatMoney(item.amount)} đ
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Số dư trước:</Text>
                <Text style={styles.infoValue}>
                  {formatMoney(item.balanceBefore)} đ
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Số dư sau:</Text>
                <Text style={styles.infoValue}>
                  {formatMoney(item.balanceAfter)} đ
                </Text>
              </View>

              {item.note ? (
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>Ghi chú:</Text>
                  <Text style={styles.noteText}>{item.note}</Text>
                </View>
              ) : null}

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Thời gian:</Text>
                <Text style={styles.infoValue}>
                  {formatDateTimeVN(item.createdAt)}
                </Text>
              </View>
            </View>
          ))
        )}
        {renderMoreRecords(ledgerSearch)}
      </View>
    );
  }

  function renderActiveTabContent() {
    if (activeTab === "WALLETS") return renderWalletList();
    if (activeTab === "WITHDRAWS") return renderWithdrawList();
    // if (activeTab === "PENALTIES") return renderPenaltyList();
    return renderLedgerList();
  }

  const actionTitle = useMemo(() => {
    if (actionMode === "TOPUP") return "Nạp tiền ví tài xế";
    if (actionMode === "ADJUST_ADD") return "Điều chỉnh cộng ví tài xế";
    return "Điều chỉnh trừ ví tài xế";
  }, [actionMode]);

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
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadAll(true)}
            />
          }
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>←</Text>
            </Pressable>

            <View style={{ flex: 1 }}>
              <Text style={styles.screenTitle}>Ví Tài Xế</Text>
              <Text style={styles.screenSubtitle}>
                Nạp tiền, điều chỉnh ví, xử lý rút tiền và tra cứu lịch sử ví.
              </Text>
            </View>
          </View>

          {loadWarning ? <Text style={styles.noteText}>{loadWarning}</Text> : null}
          {pendingOperation ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteText}>Có giao dịch ví {formatMoney(pendingOperation.amount)} đ cần xác nhận. Ghi chú: {pendingOperation.note}</Text>
              <Pressable disabled={actionSubmitting} onPress={checkPendingOperation} style={[styles.modalButton, styles.modalButtonPrimary]}>
                <Text style={styles.modalButtonPrimaryText}>{actionSubmitting ? "Đang kiểm tra..." : "Kiểm tra giao dịch đang chờ"}</Text>
              </Pressable>
            </View>
          ) : null}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" />
              <Text style={styles.loadingText}>Đang tải ví tài xế...</Text>
            </View>
          ) : (
            <>
              {renderSummaryCards()}
              {renderTabBar()}
              {renderActiveTabContent()}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef2f7",
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
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe3ef",
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1f2937",
    marginTop: -2,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1f2937",
  },
  screenSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "#6b7280",
  },
  loadingBox: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingBoxInner: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: "#6b7280",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryCard: {
    width: "47%",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    padding: 16,
  },
  summaryCardWide: {
    width: "100%",
  },
  summaryLabel: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 10,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },
  summaryValueMoney: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  tabBar: {
    gap: 10,
    paddingRight: 24,
    paddingBottom: 2,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe3ef",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  tabButtonActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#3b82f6",
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4b5563",
  },
  tabButtonTextActive: {
    color: "#2563eb",
  },
  tabBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: "#ea580c",
    alignItems: "center",
    justifyContent: "center",
  },
  tabBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  sectionBox: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    padding: 14,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2937",
  },
  filtersBox: {
    gap: 12,
  },
  searchInput: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d1d9e6",
    backgroundColor: "#f9fafb",
    paddingHorizontal: 14,
    color: "#111827",
    fontSize: 14,
  },
  filterChipRow: {
    gap: 10,
    paddingRight: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d9e6",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#3b82f6",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4b5563",
  },
  filterChipTextActive: {
    color: "#2563eb",
  },
  emptyBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d1d5db",
    paddingVertical: 22,
    paddingHorizontal: 14,
    backgroundColor: "#f9fafb",
  },
  emptyText: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: 14,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  cardSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#6b7280",
  },
  statusPill: {
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#374151",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  infoColumn: {
    gap: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "600",
  },
  infoValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    color: "#111827",
  },
  infoValueStrong: {
    flex: 1,
    textAlign: "right",
    fontSize: 14,
    color: "#111827",
    fontWeight: "800",
  },
  copyValueWrap: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
  },
  infoValueInline: {
    fontSize: 13,
    color: "#111827",
  },
  copyButton: {
    borderWidth: 1,
    borderColor: "#60a5fa",
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563eb",
  },
  amountHighlight: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  actionButton: {
    width: "47%",
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  greenButton: {
    backgroundColor: "#2e7d32",
  },
  orangeButton: {
    backgroundColor: "#ea580c",
  },
  blueGhostButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#60a5fa",
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  blueGhostButtonText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "800",
  },
  noteBox: {
    borderRadius: 14,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    gap: 6,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6b7280",
  },
  noteText: {
    fontSize: 13,
    color: "#111827",
    lineHeight: 19,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.45)",
    padding: 20,
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    gap: 14,
  },
  modalCardLarge: {
    maxHeight: "85%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  modalDriverBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    padding: 12,
    gap: 4,
  },
  modalDriverName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  modalDriverText: {
    fontSize: 13,
    color: "#6b7280",
  },
  modalInput: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d1d9e6",
    backgroundColor: "#f9fafb",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#111827",
    fontSize: 14,
  },
  modalTextarea: {
    minHeight: 110,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  modalButtonGhost: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  modalButtonGhostText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#374151",
  },
  modalButtonPrimary: {
    backgroundColor: "#2563eb",
  },
  modalButtonPrimaryText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
  },
  historyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    gap: 8,
    backgroundColor: "#ffffff",
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  inlineActionCard: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    backgroundColor: "#f8fafc",
    padding: 12,
    gap: 12,
  },
  inlineActionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  inlineHistoryCard: {
    marginTop: 10,
  },
});
