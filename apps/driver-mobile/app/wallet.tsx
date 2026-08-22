// Path: goviet247/apps/driver-mobile/app/wallet.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
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
  Image,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";

import { getDriverToken } from "../services/storage";
import { getMe } from "../services/authApi";
import {
  getDriverSupportConfig,
  type DriverSupportConfig,
} from "../services/tripApi";
import {
  createMyDriverBankAccount,
  createMyDriverWithdrawRequest,
  deleteMyDriverBankAccount,
  getMyDriverWalletSummary,
  setMyDriverDefaultBankAccount,
  type DriverBankAccountSummary,
  type DriverWalletSummaryData,
  type DriverWalletTransactionItem,
  type DriverWithdrawRequestItem,
} from "../services/driverProfileApi";
import { showError, showSuccess } from "../services/toast";

type WalletTab = "OVERVIEW" | "TOPUP" | "WITHDRAW" | "HISTORY";

type DriverIdentity = {
  displayName: string;
  phone: string;
};

type BankFormState = {
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
};

const EMPTY_BANK_FORM: BankFormState = {
  bankName: "",
  accountNumber: "",
  accountHolderName: "",
};

const MIN_WITHDRAW_AMOUNT = 50000;

export default function WalletScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState<DriverWalletSummaryData | null>(null);
  const [topupConfig, setTopupConfig] = useState<DriverSupportConfig | null>(
    null,
  );
  const [driverIdentity, setDriverIdentity] = useState<DriverIdentity | null>(
    null,
  );
  const [error, setError] = useState("");
  const [tab, setTab] = useState<WalletTab>("OVERVIEW");

  const [bankForm, setBankForm] = useState<BankFormState>(EMPTY_BANK_FORM);
  const [bankFormError, setBankFormError] = useState("");
  const [savingBank, setSavingBank] = useState(false);
  const [settingDefaultBankId, setSettingDefaultBankId] = useState("");
  const [deletingBankId, setDeletingBankId] = useState("");
  const [showAddBankForm, setShowAddBankForm] = useState(false);

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawError, setWithdrawError] = useState("");
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

  const topInset =
    Platform.OS === "android"
      ? Math.max((StatusBar.currentHeight ?? 0) - 6, 8)
      : 0;

  const formatMoney = useCallback((value?: number | null) => {
    return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
  }, []);

  const formatVndInput = useCallback((value?: string | number | null) => {
    const digits = String(value || "")
      .replace(/\D+/g, "")
      .trim();

    if (!digits) {
      return "";
    }

    return Number(digits).toLocaleString("vi-VN");
  }, []);

  const formatDateTime = useCallback((value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("vi-VN");
  }, []);

  const getTxnTypeLabel = useCallback((type?: string | null) => {
    switch (
      String(type || "")
        .trim()
        .toUpperCase()
    ) {
      case "TOPUP":
        return "Nạp tiền";

      case "COMMISSION_HOLD":
        return "Phí môi giới";

      case "COMMISSION_REFUND":
        return "Hoàn phí môi giới";

      case "TRIP_CANCEL_PENALTY":
        return "Phạt huỷ chuyến";

      case "DRIVER_VAT_HOLD":
        return "Thuế VAT tài xế";

      case "DRIVER_VAT_REFUND":
        return "Hoàn VAT";

      case "DRIVER_PIT_HOLD":
        return "Thuế TNCN tài xế";

      case "DRIVER_PIT_REFUND":
        return "Hoàn PIT";

      case "WITHDRAW_REQUEST":
        return "Yêu cầu rút tiền";

      case "WITHDRAW_REJECT_REFUND":
        return "Hoàn tiền (từ chối rút)";

      case "WITHDRAW_PAID":
        return "Đã chuyển khoản";

      case "ADJUST_ADD":
        return "Điều chỉnh cộng";

      case "ADJUST_SUBTRACT":
        return "Điều chỉnh trừ";

      default:
        return type || "Giao dịch";
    }
  }, []);

  const getWithdrawStatusLabel = useCallback((status?: string | null) => {
    switch (
      String(status || "")
        .trim()
        .toUpperCase()
    ) {
      case "PENDING":
        return "Chờ xử lý";
      case "APPROVED":
        return "Đã duyệt";
      case "PAID":
        return "Đã chuyển khoản";
      case "REJECTED":
        return "Đã từ chối";
      default:
        return status || "--";
    }
  }, []);

  const normalizeSpaces = useCallback((value?: string | null) => {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  const removeVietnameseTones = useCallback((value?: string | null) => {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D");
  }, []);

  const sanitizeTransferName = useCallback(
    (value?: string | null) => {
      return normalizeSpaces(
        removeVietnameseTones(value)
          .replace(/[^a-zA-Z0-9 ]+/g, " ")
          .replace(/\s+/g, " "),
      );
    },
    [normalizeSpaces, removeVietnameseTones],
  );

  const sanitizePhoneForTransfer = useCallback((value?: string | null) => {
    const raw = String(value || "").trim();

    if (!raw) return "";

    let digits = raw.replace(/\D+/g, "");

    if (digits.startsWith("0084")) {
      digits = digits.slice(2);
    }

    if (digits.startsWith("84") && digits.length >= 10) {
      digits = `0${digits.slice(2)}`;
    }

    return digits;
  }, []);

  const extractFirstNonEmptyString = useCallback((values: unknown[]) => {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return "";
  }, []);

  const extractPhoneFromUnknown = useCallback(
    (payload: any) => {
      const directPhone = extractFirstNonEmptyString([
        payload?.phone,
        payload?.phoneNumber,
        payload?.e164,
        payload?.user?.phone,
        payload?.user?.phoneNumber,
        payload?.user?.e164,
        payload?.data?.phone,
        payload?.data?.phoneNumber,
        payload?.data?.e164,
        payload?.data?.user?.phone,
        payload?.data?.user?.phoneNumber,
        payload?.data?.user?.e164,
      ]);

      if (directPhone) {
        return directPhone;
      }

      const phoneLists = [
        payload?.phones,
        payload?.user?.phones,
        payload?.data?.phones,
        payload?.data?.user?.phones,
      ];

      for (const list of phoneLists) {
        if (!Array.isArray(list)) continue;

        const verifiedPhone =
          list.find((item) => Boolean(item?.isVerified) && item?.e164)?.e164 ||
          list.find((item) => item?.e164)?.e164 ||
          list.find((item) => item?.phone)?.phone ||
          list.find((item) => item?.phoneNumber)?.phoneNumber;

        if (typeof verifiedPhone === "string" && verifiedPhone.trim()) {
          return verifiedPhone.trim();
        }
      }

      return "";
    },
    [extractFirstNonEmptyString],
  );

  const getDriverIdentityFromMe = useCallback(
    (payload: any): DriverIdentity => {
      const displayName = normalizeSpaces(
        extractFirstNonEmptyString([
          payload?.displayName,
          payload?.name,
          payload?.fullName,
          payload?.user?.displayName,
          payload?.user?.name,
          payload?.user?.fullName,
          payload?.data?.displayName,
          payload?.data?.name,
          payload?.data?.fullName,
          payload?.data?.user?.displayName,
          payload?.data?.user?.name,
          payload?.data?.user?.fullName,
        ]),
      );

      const phone = normalizeSpaces(extractPhoneFromUnknown(payload));

      return {
        displayName,
        phone,
      };
    },
    [extractFirstNonEmptyString, extractPhoneFromUnknown, normalizeSpaces],
  );

  const loadWallet = useCallback(async () => {
    try {
      setError("");

      const token = await getDriverToken();

      if (!token) {
        throw new Error("Phiên đăng nhập đã hết hạn.");
      }

      const [walletResult, configResult, meResult] = await Promise.all([
        getMyDriverWalletSummary(token),
        getDriverSupportConfig(),
        getMe(token),
      ]);

      setWallet(walletResult?.data || null);
      setTopupConfig(configResult || null);
      setDriverIdentity(getDriverIdentityFromMe(meResult));
    } catch (err: any) {
      setError(err?.message || "Không thể tải ví tài xế.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getDriverIdentityFromMe]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWallet();
  };

  const handleGoBack = () => {
    router.replace("/dashboard");
  };

  const handleCopy = useCallback(
    async (value: string, successMessage: string) => {
      try {
        await Clipboard.setStringAsync(String(value || ""));
        showSuccess(successMessage);
      } catch (err) {
        console.error("Copy error", err);
        showError("Không thể copy");
      }
    },
    [],
  );

  const updateWalletBankState = useCallback(
    (
      items: DriverBankAccountSummary[] = [],
      nextDefaultBankAccount?: DriverBankAccountSummary | null,
    ) => {
      setWallet((prev) => {
        if (!prev) return prev;

        const computedDefault =
          nextDefaultBankAccount ??
          items.find((item) => item.isDefault) ??
          items[0] ??
          null;

        return {
          ...prev,
          bankAccounts: items,
          defaultBankAccount: computedDefault,
        };
      });
    },
    [],
  );

  const validateBankForm = useCallback(() => {
    const bankName = normalizeSpaces(bankForm.bankName);
    const accountNumber = String(bankForm.accountNumber || "")
      .replace(/\s+/g, "")
      .trim();
    const accountHolderName = normalizeSpaces(bankForm.accountHolderName);

    if (bankName.length < 2) {
      return "Vui lòng nhập tên ngân hàng hợp lệ.";
    }

    if (accountNumber.length < 6) {
      return "Vui lòng nhập số tài khoản hợp lệ.";
    }

    if (accountHolderName.length < 2) {
      return "Vui lòng nhập tên chủ tài khoản hợp lệ.";
    }

    return "";
  }, [bankForm, normalizeSpaces]);

  const handleSaveBankAccount = useCallback(async () => {
    try {
      const token = await getDriverToken();

      if (!token) {
        throw new Error("Phiên đăng nhập đã hết hạn.");
      }

      const validationError = validateBankForm();

      if (validationError) {
        setBankFormError(validationError);
        return;
      }

      setSavingBank(true);
      setBankFormError("");

      const response = await createMyDriverBankAccount(token, {
        bankName: normalizeSpaces(bankForm.bankName),
        accountNumber: String(bankForm.accountNumber || "")
          .replace(/\s+/g, "")
          .trim(),
        accountHolderName: normalizeSpaces(bankForm.accountHolderName),
        isDefault: (wallet?.bankAccounts?.length ?? 0) === 0,
      });

      updateWalletBankState(
        response.items || [],
        response.defaultBankAccount || null,
      );

      setBankForm(EMPTY_BANK_FORM);
      setShowAddBankForm(false);
      showSuccess(response.message || "Đã thêm tài khoản ngân hàng.");
    } catch (err: any) {
      const message = err?.message || "Không thể thêm tài khoản ngân hàng.";
      setBankFormError(message);
      showError(message);
    } finally {
      setSavingBank(false);
    }
  }, [
    bankForm,
    normalizeSpaces,
    updateWalletBankState,
    validateBankForm,
    wallet,
  ]);

  const handleSetDefaultBank = useCallback(
    async (bankAccountId: string) => {
      try {
        const token = await getDriverToken();

        if (!token) {
          throw new Error("Phiên đăng nhập đã hết hạn.");
        }

        setSettingDefaultBankId(bankAccountId);

        const response = await setMyDriverDefaultBankAccount(
          token,
          bankAccountId,
        );

        updateWalletBankState(
          response.items || [],
          response.defaultBankAccount || null,
        );

        showSuccess(response.message || "Đã cập nhật tài khoản mặc định.");
      } catch (err: any) {
        const message =
          err?.message || "Không thể cập nhật tài khoản mặc định.";
        showError(message);
      } finally {
        setSettingDefaultBankId("");
      }
    },
    [updateWalletBankState],
  );

  const doDeleteBankAccount = useCallback(
    async (bankAccountId: string) => {
      try {
        const token = await getDriverToken();

        if (!token) {
          throw new Error("Phiên đăng nhập đã hết hạn.");
        }

        setDeletingBankId(bankAccountId);

        const response = await deleteMyDriverBankAccount(token, bankAccountId);

        updateWalletBankState(
          response.items || [],
          response.defaultBankAccount || null,
        );

        showSuccess(response.message || "Đã xoá tài khoản ngân hàng.");
      } catch (err: any) {
        const message = err?.message || "Không thể xoá tài khoản ngân hàng.";
        showError(message);
      } finally {
        setDeletingBankId("");
      }
    },
    [updateWalletBankState],
  );

  const handleDeleteBankAccount = useCallback(
    async (item: DriverBankAccountSummary) => {
      const message = `Xác nhận xoá tài khoản ngân hàng này?\n\n${item.bankName}\nSố tài khoản: ${item.accountNumber}\nChủ tài khoản: ${item.accountHolderName}`;

      if (Platform.OS === "web" && typeof window !== "undefined") {
        const confirmed = window.confirm(message);
        if (!confirmed) return;

        await doDeleteBankAccount(item.id);
        return;
      }

      Alert.alert(
        "Xác nhận xoá tài khoản",
        message,
        [
          {
            text: "Huỷ",
            style: "cancel",
          },
          {
            text: "Xoá",
            style: "destructive",
            onPress: () => {
              void doDeleteBankAccount(item.id);
            },
          },
        ],
        { cancelable: true },
      );
    },
    [doDeleteBankAccount],
  );

  const parseWithdrawAmount = useCallback(() => {
    const numeric = String(withdrawAmount || "")
      .replace(/\D+/g, "")
      .trim();

    if (!numeric) {
      return 0;
    }

    return Number(numeric);
  }, [withdrawAmount]);

  const validateWithdrawAmount = useCallback(() => {
    const amount = parseWithdrawAmount();

    if (!wallet?.defaultBankAccount) {
      return "Bạn cần có tài khoản ngân hàng mặc định trước khi rút tiền.";
    }

    if (!amount) {
      return "Vui lòng nhập số tiền muốn rút.";
    }

    if (amount < MIN_WITHDRAW_AMOUNT) {
      return `Số tiền rút tối thiểu là ${MIN_WITHDRAW_AMOUNT.toLocaleString("vi-VN")}đ.`;
    }

    if (amount > Number(wallet?.balance || 0)) {
      return "Số dư ví không đủ để tạo yêu cầu rút tiền này.";
    }

    return "";
  }, [parseWithdrawAmount, wallet]);

  const doSubmitWithdraw = useCallback(async () => {
    try {
      const token = await getDriverToken();

      if (!token) {
        throw new Error("Phiên đăng nhập đã hết hạn.");
      }

      const validationError = validateWithdrawAmount();

      if (validationError) {
        setWithdrawError(validationError);
        return;
      }

      const amount = parseWithdrawAmount();

      setSubmittingWithdraw(true);
      setWithdrawError("");

      const response = await createMyDriverWithdrawRequest(token, { amount });

      if (response.data) {
        setWallet(response.data);
      } else {
        await loadWallet();
      }

      setWithdrawAmount("");

      const successMessage =
        response.message ||
        "Đã gửi yêu cầu rút tiền. Yêu cầu sẽ được xử lý và chuyển khoản trong thời gian sớm nhất.";

      showSuccess(successMessage);
    } catch (err: any) {
      const message = err?.message || "Không thể gửi yêu cầu rút tiền.";
      setWithdrawError(message);
      showError(message);
    } finally {
      setSubmittingWithdraw(false);
    }
  }, [loadWallet, parseWithdrawAmount, validateWithdrawAmount]);

  const handleSubmitWithdraw = useCallback(async () => {
    const validationError = validateWithdrawAmount();

    if (validationError) {
      setWithdrawError(validationError);
      return;
    }

    const amount = parseWithdrawAmount();
    const message = `Xác nhận gửi yêu cầu rút ${amount.toLocaleString("vi-VN")}đ?\n\nLưu ý: số tiền sẽ bị trừ ngay khỏi ví để tránh rút vượt số dư. Yêu cầu sẽ được xử lý và chuyển khoản sớm nhất có thể.`;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      const confirmed = window.confirm(message);
      if (!confirmed) return;

      await doSubmitWithdraw();
      return;
    }

    Alert.alert(
      "Xác nhận rút tiền",
      message,
      [
        {
          text: "Huỷ",
          style: "cancel",
        },
        {
          text: "Xác nhận",
          onPress: () => {
            void doSubmitWithdraw();
          },
        },
      ],
      { cancelable: true },
    );
  }, [doSubmitWithdraw, parseWithdrawAmount, validateWithdrawAmount]);

  const defaultBank = wallet?.defaultBankAccount || null;
  const bankAccounts = wallet?.bankAccounts || [];
  const transactions = (wallet?.recentTransactions || []).filter((item) => {
    return (
      String(item?.type || "")
        .trim()
        .toUpperCase() !== "TRIP_CANCEL_PENALTY"
    );
  });
  const withdrawRequests = wallet?.recentWithdrawRequests || [];

  const overviewTransactions = useMemo(
    () => transactions.slice(0, 3),
    [transactions],
  );
  const overviewWithdraws = useMemo(
    () => withdrawRequests.slice(0, 3),
    [withdrawRequests],
  );

  const topupBankName = normalizeSpaces(topupConfig?.driverTopupBankName);
  const topupAccountNumber = normalizeSpaces(
    topupConfig?.driverTopupAccountNumber,
  );
  const topupAccountHolderName = normalizeSpaces(
    topupConfig?.driverTopupAccountHolderName,
  );
  const topupTransferPrefix =
    normalizeSpaces(topupConfig?.driverTopupTransferPrefix) || "NAPVI";
  const topupQrImageUrl = normalizeSpaces(topupConfig?.driverTopupQrImageUrl);
  const topupNote = normalizeSpaces(topupConfig?.driverTopupNote);

  const sanitizedDriverName = useMemo(() => {
    return sanitizeTransferName(driverIdentity?.displayName);
  }, [driverIdentity?.displayName, sanitizeTransferName]);

  const sanitizedDriverPhone = useMemo(() => {
    return sanitizePhoneForTransfer(driverIdentity?.phone);
  }, [driverIdentity?.phone, sanitizePhoneForTransfer]);

  const transferNote = useMemo(() => {
    const parts = [
      topupTransferPrefix,
      sanitizedDriverName,
      sanitizedDriverPhone,
    ].filter(Boolean);

    return parts.join(" ").trim();
  }, [sanitizedDriverName, sanitizedDriverPhone, topupTransferPrefix]);

  const hasTopupBankInfo =
    Boolean(topupBankName) &&
    Boolean(topupAccountNumber) &&
    Boolean(topupAccountHolderName);

  const hasTransferIdentity =
    Boolean(sanitizedDriverName) && Boolean(sanitizedDriverPhone);

  const renderTransactionItem = (item: DriverWalletTransactionItem) => {
    const amount = Number(item.amount || 0);
    const normalizedType = String(item.type || "")
      .trim()
      .toUpperCase();

    const minusTypes = new Set([
      "COMMISSION_HOLD",
      "DRIVER_VAT_HOLD",
      "DRIVER_PIT_HOLD",
      "WITHDRAW_REQUEST",
      "ADJUST_SUBTRACT",
    ]);

    const plusTypes = new Set([
      "TOPUP",
      "COMMISSION_REFUND",
      "DRIVER_VAT_REFUND",
      "DRIVER_PIT_REFUND",
      "WITHDRAW_REJECT_REFUND",
      "ADJUST_ADD",
    ]);

    const neutralTypes = new Set(["WITHDRAW_PAID"]);

    const isMinus = minusTypes.has(normalizedType);
    const isPlus = plusTypes.has(normalizedType);
    const isNeutral = neutralTypes.has(normalizedType);

    const amountPrefix = isMinus ? "-" : isPlus ? "+" : "";
    const amountStyle = isMinus
      ? styles.amountMinus
      : isPlus
        ? styles.amountPlus
        : styles.amountNeutral;

    return (
      <View key={item.id} style={styles.listCard}>
        <View style={styles.listCardTop}>
          <Text style={styles.listCardTitle}>{getTxnTypeLabel(item.type)}</Text>
          <Text style={[styles.amountText, amountStyle]}>
            {amountPrefix}
            {formatMoney(amount)}
          </Text>
        </View>

        {!!item.note && <Text style={styles.listCardNote}>{item.note}</Text>}

        {!!item.tripId && (
          <Text style={styles.metaText}>Mã chuyến: {item.tripId}</Text>
        )}

        <Text style={styles.metaText}>
          Số dư: {formatMoney(item.balanceBefore)} →{" "}
          {formatMoney(item.balanceAfter)}
        </Text>

        {isNeutral && normalizedType === "WITHDRAW_PAID" ? (
          <Text style={styles.metaText}>
            Trạng thái: Đã chuyển khoản ngoài hệ thống
          </Text>
        ) : null}

        <Text style={styles.metaText}>{formatDateTime(item.createdAt)}</Text>
      </View>
    );
  };

  const renderWithdrawItem = (item: DriverWithdrawRequestItem) => {
    const status = String(item.status || "")
      .trim()
      .toUpperCase();
    const isRejected = status === "REJECTED";
    const isPaid = status === "PAID";
    const isApproved = status === "APPROVED";

    return (
      <View key={item.id} style={styles.listCard}>
        <View style={styles.listCardTop}>
          <Text style={styles.listCardTitle}>
            Rút {formatMoney(item.amount)}
          </Text>

          <View
            style={[
              styles.statusBadge,
              isRejected
                ? styles.statusRejected
                : isPaid
                  ? styles.statusPaid
                  : isApproved
                    ? styles.statusApproved
                    : styles.statusPending,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                isRejected
                  ? styles.statusRejectedText
                  : isPaid
                    ? styles.statusPaidText
                    : isApproved
                      ? styles.statusApprovedText
                      : styles.statusPendingText,
              ]}
            >
              {getWithdrawStatusLabel(item.status)}
            </Text>
          </View>
        </View>

        {!!item.bankAccount && (
          <>
            <Text style={styles.metaText}>
              {item.bankAccount.bankName} - {item.bankAccount.accountNumber}
            </Text>

            <Text style={styles.metaText}>
              Chủ tài khoản: {item.bankAccount.accountHolderName}
            </Text>
          </>
        )}

        {!!item.note && (
          <Text style={styles.listCardNote}>Ghi chú: {item.note}</Text>
        )}

        {!!item.rejectReason && (
          <Text style={styles.rejectText}>
            Lý do từ chối: {item.rejectReason}
          </Text>
        )}

        <Text style={styles.metaText}>
          Tạo lúc: {formatDateTime(item.createdAt)}
        </Text>

        {!!item.approvedAt && (
          <Text style={styles.metaText}>
            Duyệt lúc: {formatDateTime(item.approvedAt)}
          </Text>
        )}

        {!!item.paidAt && (
          <Text style={styles.metaText}>
            Chuyển lúc: {formatDateTime(item.paidAt)}
          </Text>
        )}
      </View>
    );
  };

  const renderBankAccountItem = (item: DriverBankAccountSummary) => {
    const isSettingDefault = settingDefaultBankId === item.id;
    const isDeleting = deletingBankId === item.id;
    const isBusy = isSettingDefault || isDeleting;

    return (
      <View key={item.id} style={styles.bankItemCard}>
        <View style={styles.bankItemTop}>
          <View style={styles.bankItemTitleWrap}>
            <Text style={styles.bankItemTitle}>{item.bankName}</Text>
            <Text style={styles.bankItemMeta}>
              Số tài khoản: {item.accountNumber}
            </Text>
            <Text style={styles.bankItemMeta}>
              Chủ tài khoản: {item.accountHolderName}
            </Text>
          </View>

          {item.isDefault ? (
            <View style={[styles.statusBadge, styles.statusPaid]}>
              <Text style={[styles.statusBadgeText, styles.statusPaidText]}>
                Mặc định
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.bankItemActions}>
          {!item.isDefault ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.85}
              disabled={isBusy}
              onPress={() => handleSetDefaultBank(item.id)}
            >
              <Text style={styles.secondaryButtonText}>
                {isSettingDefault ? "Đang lưu..." : "Đặt mặc định"}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.bankItemActionSpacer} />
          )}

          <TouchableOpacity
            style={[
              styles.dangerButton,
              isBusy && styles.primaryButtonDisabled,
            ]}
            activeOpacity={0.85}
            disabled={isBusy}
            onPress={() => handleDeleteBankAccount(item)}
          >
            <Text style={styles.dangerButtonText}>
              {isDeleting ? "Đang xoá..." : "Xoá"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderOverviewTab = () => {
    return (
      <>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Số dư hiện tại</Text>
          <Text style={styles.balanceValue}>
            {formatMoney(wallet?.balance || 0)}
          </Text>
          <Text style={styles.balanceHint}>
            Số dư dùng để nhận chuyến, xử lý môi giới và giao dịch nội bộ.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tài khoản nhận tiền mặc định</Text>

          {defaultBank ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>{defaultBank.bankName}</Text>
              <Text style={styles.infoLine}>
                Số tài khoản: {defaultBank.accountNumber}
              </Text>
              <Text style={styles.infoLine}>
                Chủ tài khoản: {defaultBank.accountHolderName}
              </Text>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Chưa có tài khoản ngân hàng mặc định.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Giao dịch gần đây</Text>

            {transactions.length > 3 ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setTab("HISTORY")}
              >
                <Text style={styles.linkText}>Xem tất cả</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {overviewTransactions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Chưa có giao dịch nào.</Text>
            </View>
          ) : (
            overviewTransactions.map(renderTransactionItem)
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Rút tiền gần đây</Text>

            {withdrawRequests.length > 3 ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setTab("HISTORY")}
              >
                <Text style={styles.linkText}>Xem tất cả</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {overviewWithdraws.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Chưa có yêu cầu rút tiền nào.
              </Text>
            </View>
          ) : (
            overviewWithdraws.map(renderWithdrawItem)
          )}
        </View>
      </>
    );
  };

  const renderTopupInfoRow = (
    label: string,
    value: string,
    copyMessage: string,
  ) => {
    return (
      <View style={styles.topupInfoRow} key={`${label}-${value}`}>
        <View style={styles.topupInfoTextWrap}>
          <Text style={styles.topupInfoLabel}>{label}</Text>
          <Text style={styles.topupInfoValue}>{value}</Text>
        </View>

        <TouchableOpacity
          style={styles.copyButton}
          activeOpacity={0.85}
          onPress={() => handleCopy(value, copyMessage)}
        >
          <Text style={styles.copyButtonText}>Copy</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderTopupTab = () => {
    return (
      <>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nạp tiền vào ví</Text>

          <View style={styles.qrCard}>
            {topupQrImageUrl ? (
              <Image
                source={{ uri: topupQrImageUrl }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Text style={styles.qrPlaceholderText}>QR</Text>
              </View>
            )}

            <Text style={styles.qrHint}>
              {topupQrImageUrl
                ? "Quét mã QR để chuyển khoản nhanh."
                : "Admin chưa cấu hình mã QR. Bạn vẫn có thể dùng thông tin chuyển khoản bên dưới."}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin chuyển khoản</Text>

          {!hasTopupBankInfo ? (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>
                Chưa có thông tin nạp tiền
              </Text>
              <Text style={styles.warningText}>
                Admin chưa cấu hình đầy đủ ngân hàng nhận tiền cho ví tài xế.
              </Text>
            </View>
          ) : (
            <View style={styles.infoCard}>
              {renderTopupInfoRow(
                "Ngân hàng",
                topupBankName,
                "Đã copy tên ngân hàng",
              )}

              {renderTopupInfoRow(
                "Số tài khoản",
                topupAccountNumber,
                "Đã copy số tài khoản",
              )}

              {renderTopupInfoRow(
                "Tên tài khoản",
                topupAccountHolderName,
                "Đã copy tên tài khoản",
              )}

              {transferNote ? (
                renderTopupInfoRow(
                  "Nội dung chuyển khoản",
                  transferNote,
                  "Đã copy nội dung chuyển khoản",
                )
              ) : (
                <View style={styles.topupIdentityWarning}>
                  <Text style={styles.topupIdentityWarningTitle}>
                    Chưa ghép được nội dung chuyển khoản đầy đủ
                  </Text>
                  <Text style={styles.topupIdentityWarningText}>
                    App cần có đủ tên tài xế và số điện thoại để tạo nội dung
                    theo dạng:
                    {"\n"}
                    {topupTransferPrefix} Ten tai xe So dien thoai
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lưu ý</Text>

          <View style={styles.noticeCard}>
            {hasTransferIdentity ? (
              <Text style={styles.noticeItem}>
                • Vui lòng chuyển khoản đúng nội dung: {transferNote}
              </Text>
            ) : (
              <Text style={styles.noticeItem}>
                • Khi app đọc được đủ tên tài xế và số điện thoại, nội dung
                chuyển khoản sẽ tự ghép theo mẫu:
                {"\n"}
                {topupTransferPrefix} Ten tai xe So dien thoai
              </Text>
            )}

            <Text style={styles.noticeItem}>
              • Sau khi nhận được giao dịch, admin sẽ kiểm tra và cộng tiền vào
              ví.
            </Text>

            <Text style={styles.noticeItem}>
              • Nếu nạp lâu chưa thấy cập nhật, vui lòng liên hệ admin để được
              hỗ trợ.
            </Text>

            {!!topupNote && (
              <Text style={styles.noticeItem}>
                • Ghi chú từ admin: {topupNote}
              </Text>
            )}
          </View>
        </View>
      </>
    );
  };

  const renderWithdrawTab = () => {
    const parsedAmount = parseWithdrawAmount();

    return (
      <>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Số dư có thể rút</Text>
          <Text style={styles.balanceValue}>
            {formatMoney(wallet?.balance || 0)}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tài khoản nhận tiền</Text>

          {defaultBank ? (
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>{defaultBank.bankName}</Text>
              <Text style={styles.infoLine}>
                Số tài khoản: {defaultBank.accountNumber}
              </Text>
              <Text style={styles.infoLine}>
                Chủ tài khoản: {defaultBank.accountHolderName}
              </Text>
            </View>
          ) : (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>
                Chưa có tài khoản mặc định
              </Text>
              <Text style={styles.warningText}>
                Bạn cần thêm ít nhất 1 tài khoản ngân hàng để gửi yêu cầu rút
                tiền.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              Danh sách tài khoản ngân hàng
            </Text>

            <TouchableOpacity
              style={styles.inlineActionButton}
              activeOpacity={0.85}
              onPress={() => {
                setBankFormError("");
                setShowAddBankForm((prev) => !prev);
              }}
            >
              <Text style={styles.inlineActionButtonText}>
                {showAddBankForm ? "Thu gọn" : "+ Thêm tài khoản"}
              </Text>
            </TouchableOpacity>
          </View>

          {bankAccounts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Bạn chưa có tài khoản ngân hàng nào.
              </Text>
            </View>
          ) : (
            bankAccounts.map(renderBankAccountItem)
          )}
        </View>

        {showAddBankForm ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thêm tài khoản ngân hàng</Text>

            <View style={styles.formCard}>
              <Text style={styles.inputLabel}>Tên ngân hàng</Text>
              <TextInput
                value={bankForm.bankName}
                onChangeText={(text) => {
                  setBankFormError("");
                  setBankForm((prev) => ({ ...prev, bankName: text }));
                }}
                placeholder="Ví dụ: Techcombank"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Số tài khoản</Text>
              <TextInput
                value={bankForm.accountNumber}
                onChangeText={(text) => {
                  setBankFormError("");
                  setBankForm((prev) => ({ ...prev, accountNumber: text }));
                }}
                placeholder="Nhập số tài khoản"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Tên chủ tài khoản</Text>
              <TextInput
                value={bankForm.accountHolderName}
                onChangeText={(text) => {
                  setBankFormError("");
                  setBankForm((prev) => ({ ...prev, accountHolderName: text }));
                }}
                placeholder="Nhập tên chủ tài khoản"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
              />

              {!!bankFormError && (
                <Text style={styles.formErrorText}>{bankFormError}</Text>
              )}

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  savingBank && styles.primaryButtonDisabled,
                ]}
                activeOpacity={0.85}
                disabled={savingBank}
                onPress={handleSaveBankAccount}
              >
                <Text style={styles.primaryButtonText}>
                  {savingBank ? "Đang lưu..." : "Lưu tài khoản ngân hàng"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gửi yêu cầu rút tiền</Text>

          <View style={styles.formCard}>
            <Text style={styles.inputLabel}>Số tiền muốn rút</Text>
            <TextInput
              value={withdrawAmount}
              onChangeText={(text) => {
                setWithdrawError("");
                setWithdrawAmount(formatVndInput(text));
              }}
              placeholder={`Tối thiểu ${MIN_WITHDRAW_AMOUNT.toLocaleString("vi-VN")}đ`}
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={15}
              style={styles.input}
            />

            {parsedAmount > 0 ? (
              <Text style={styles.helperText}>
                Bạn đang nhập: {formatMoney(parsedAmount)}
              </Text>
            ) : null}

            {!!withdrawError && (
              <Text style={styles.formErrorText}>{withdrawError}</Text>
            )}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!defaultBank || submittingWithdraw) &&
                  styles.primaryButtonDisabled,
              ]}
              activeOpacity={0.85}
              disabled={!defaultBank || submittingWithdraw}
              onPress={handleSubmitWithdraw}
            >
              <Text style={styles.primaryButtonText}>
                {submittingWithdraw ? "Đang gửi..." : "Gửi yêu cầu rút tiền"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trạng thái hiện tại</Text>

          <View style={styles.noticeCard}>
            <Text style={styles.noticeItem}>
              • Số dư hiện tại của bạn: {formatMoney(wallet?.balance || 0)}
            </Text>
            <Text style={styles.noticeItem}>
              • Số tiền rút tối thiểu: {formatMoney(MIN_WITHDRAW_AMOUNT)}
            </Text>
            <Text style={styles.noticeItem}>
              • Sau khi gửi yêu cầu, bạn có thể xem lại trạng thái trong tab
              Lịch sử.
            </Text>
          </View>
        </View>
      </>
    );
  };

  const renderHistoryTab = () => {
    return (
      <>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lịch sử giao dịch ví</Text>

          {transactions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Chưa có giao dịch nào.</Text>
            </View>
          ) : (
            transactions.map(renderTransactionItem)
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lịch sử yêu cầu rút tiền</Text>

          {withdrawRequests.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Chưa có yêu cầu rút tiền nào.
              </Text>
            </View>
          ) : (
            withdrawRequests.map(renderWithdrawItem)
          )}
        </View>
      </>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ff6b00" />
          <Text style={styles.loadingText}>Đang tải ví tài xế...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
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

          <Text style={styles.headerTitle}>Ví tài xế</Text>

          <View style={styles.headerIconButton} />
        </View>

        <View style={styles.center}>
          <Text style={styles.errorTitle}>Không thể tải ví</Text>
          <Text style={styles.errorText}>{error}</Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadWallet}
            activeOpacity={0.85}
          >
            <Text style={styles.retryButtonText}>Tải lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  let tabContent: React.ReactNode = null;

  if (tab === "OVERVIEW") {
    tabContent = <>{renderOverviewTab()}</>;
  } else if (tab === "TOPUP") {
    tabContent = <>{renderTopupTab()}</>;
  } else if (tab === "WITHDRAW") {
    tabContent = <>{renderWithdrawTab()}</>;
  } else {
    tabContent = <>{renderHistoryTab()}</>;
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

        <Text style={styles.headerTitle}>Ví tài xế</Text>

        <View style={styles.headerIconButton} />
      </View>

      <View style={styles.tabsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          <WalletTabButton
            label="Tổng quan"
            active={tab === "OVERVIEW"}
            onPress={() => setTab("OVERVIEW")}
          />
          <WalletTabButton
            label="Nạp tiền"
            active={tab === "TOPUP"}
            onPress={() => setTab("TOPUP")}
          />
          <WalletTabButton
            label="Rút tiền"
            active={tab === "WITHDRAW"}
            onPress={() => setTab("WITHDRAW")}
          />
          <WalletTabButton
            label="Lịch sử"
            active={tab === "HISTORY"}
            onPress={() => setTab("HISTORY")}
          />
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {tabContent}
      </ScrollView>
    </SafeAreaView>
  );
}

function WalletTabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tabButton, active && styles.tabButtonActive]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <Text
        style={[styles.tabButtonText, active && styles.tabButtonTextActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7FB",
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

  tabsWrap: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },

  tabsRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 92,
  },

  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
  },

  tabButtonActive: {
    backgroundColor: "#ff6b00",
  },

  tabButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#4B5563",
  },

  tabButtonTextActive: {
    color: "#FFFFFF",
  },

  balanceCard: {
    backgroundColor: "#FFF7ED",
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },

  balanceLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#9A3412",
  },

  balanceValue: {
    marginTop: 8,
    fontSize: 32,
    fontWeight: "900",
    color: "#EA580C",
  },

  balanceHint: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: "#7C2D12",
  },

  section: {
    marginBottom: 18,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
    flex: 1,
  },

  linkText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ff6b00",
  },

  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
  },

  infoTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },

  infoLine: {
    fontSize: 14,
    lineHeight: 22,
    color: "#4B5563",
  },

  listCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },

  listCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },

  listCardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },

  amountText: {
    fontSize: 15,
    fontWeight: "900",
  },

  amountPlus: {
    color: "#16A34A",
  },

  amountMinus: {
    color: "#DC2626",
  },

  amountNeutral: {
    color: "#374151",
  },

  listCardNote: {
    fontSize: 14,
    lineHeight: 21,
    color: "#374151",
    marginBottom: 6,
  },

  metaText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#6B7280",
    marginBottom: 2,
  },

  rejectText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#DC2626",
    fontWeight: "700",
    marginBottom: 4,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },

  statusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },

  statusPending: {
    backgroundColor: "#FEF3C7",
  },

  statusPendingText: {
    color: "#B45309",
  },

  statusApproved: {
    backgroundColor: "#DBEAFE",
  },

  statusApprovedText: {
    color: "#1D4ED8",
  },

  statusPaid: {
    backgroundColor: "#DCFCE7",
  },

  statusPaidText: {
    color: "#15803D",
  },

  statusRejected: {
    backgroundColor: "#FEE2E2",
  },

  statusRejectedText: {
    color: "#DC2626",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
  },

  emptyText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#6B7280",
  },

  warningCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },

  warningTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#B91C1C",
    marginBottom: 8,
  },

  warningText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#7F1D1D",
  },

  qrCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
  },

  qrImage: {
    width: 220,
    height: 220,
    borderRadius: 16,
    backgroundColor: "#FFF7ED",
  },

  qrPlaceholder: {
    width: 220,
    height: 220,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#FDBA74",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF7ED",
  },

  qrPlaceholderText: {
    fontSize: 48,
    fontWeight: "900",
    color: "#EA580C",
  },

  qrHint: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
    color: "#6B7280",
  },

  topupInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },

  topupInfoTextWrap: {
    flex: 1,
  },

  topupInfoLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9CA3AF",
    marginBottom: 4,
  },

  topupInfoValue: {
    fontSize: 14,
    lineHeight: 21,
    color: "#111827",
    fontWeight: "700",
  },

  copyButton: {
    minWidth: 64,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  copyButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  topupIdentityWarning: {
    marginTop: 6,
    borderRadius: 14,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 12,
  },

  topupIdentityWarningTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#B91C1C",
    marginBottom: 6,
  },

  topupIdentityWarningText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#7F1D1D",
  },

  noticeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
  },

  noticeItem: {
    fontSize: 14,
    lineHeight: 22,
    color: "#374151",
    marginBottom: 6,
  },

  bankItemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },

  bankItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },

  bankItemTitleWrap: {
    flex: 1,
  },

  bankItemTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },

  bankItemMeta: {
    fontSize: 13,
    lineHeight: 20,
    color: "#6B7280",
    marginBottom: 2,
  },

  bankItemActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },

  bankItemActionSpacer: {
    flex: 1,
  },

  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },

  input: {
    height: 46,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    color: "#111827",
    backgroundColor: "#FFFFFF",
    marginBottom: 14,
  },

  helperText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#6B7280",
    marginBottom: 10,
  },

  formErrorText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#DC2626",
    fontWeight: "700",
    marginBottom: 10,
  },

  primaryButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#ff6b00",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  primaryButtonDisabled: {
    opacity: 0.7,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  secondaryButton: {
    minWidth: 110,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  dangerButton: {
    minWidth: 84,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  dangerButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  inlineActionButton: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: "#111827",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  inlineActionButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  loadingText: {
    marginTop: 10,
    color: "#6B7280",
  },

  errorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },

  errorText: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 22,
    color: "#6B7280",
    marginBottom: 16,
  },

  retryButton: {
    minWidth: 120,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#ff6b00",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
