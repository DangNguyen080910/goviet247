// Path: goviet247/apps/driver-mobile/app/support.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Linking,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import {
  getDriverSupportConfig,
  type DriverSupportConfig,
} from "../services/tripApi";

function normalizePhoneForTel(phone?: string | null) {
  const raw = String(phone || "").trim();

  if (!raw) {
    return "";
  }

  if (raw.startsWith("+")) {
    return `+${raw.slice(1).replace(/\D/g, "")}`;
  }

  return raw.replace(/\D/g, "");
}

function normalizePhoneForZalo(phone?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("84")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `84${digits.slice(1)}`;
  }

  return digits;
}

export default function DriverSupportScreen() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<DriverSupportConfig | null>(null);
  const [supportPhone, setSupportPhone] = useState("0977100917");
  const [supportEmail, setSupportEmail] = useState("driver@goviet247.com");
  const [error, setError] = useState("");

  const topInset =
    Platform.OS === "android"
      ? Math.max((StatusBar.currentHeight ?? 0) - 6, 8)
      : 0;

  const telPhone = useMemo(() => {
    return normalizePhoneForTel(supportPhone);
  }, [supportPhone]);

  const zaloPhone = useMemo(() => {
    return normalizePhoneForZalo(supportPhone);
  }, [supportPhone]);

  const zaloUrl = useMemo(() => {
    if (!zaloPhone) {
      return "";
    }

    return `https://zalo.me/${zaloPhone}`;
  }, [zaloPhone]);

  const mailtoUrl = useMemo(() => {
    const email = String(supportEmail || "").trim();

    if (!email) {
      return "";
    }

    const subject = encodeURIComponent("Hỗ trợ tài xế GoViet247");
    const body = encodeURIComponent(
      "Xin chào GoViet247,\n\nTôi là tài xế và cần được hỗ trợ.\n\nCảm ơn.",
    );

    return `mailto:${email}?subject=${subject}&body=${body}`;
  }, [supportEmail]);

  const loadSupportData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getDriverSupportConfig();
      setConfig(data);

      const nextPhone = String(data?.supportPhoneDriver || "").trim();
      const nextEmail = String(data?.supportEmailDriver || "").trim();

      if (nextPhone) {
        setSupportPhone(nextPhone);
      } else {
        setSupportPhone("0977100917");
      }

      if (nextEmail) {
        setSupportEmail(nextEmail);
      } else {
        setSupportEmail("driver@goviet247.com");
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Không thể tải thông tin hỗ trợ tài xế.";

      setError(message);
      setSupportPhone("0977100917");
      setSupportEmail("driver@goviet247.com");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSupportData();
  }, [loadSupportData]);

  const handleGoBack = useCallback(() => {
    router.back();
  }, []);

  const handleCallNow = useCallback(async () => {
    if (!telPhone) {
      Alert.alert(
        "Thiếu số điện thoại",
        "Hiện chưa có số điện thoại hỗ trợ tài xế.",
      );
      return;
    }

    const telUrl = `tel:${telPhone}`;

    try {
      await Linking.openURL(telUrl);
    } catch (error) {
      console.error("call driver support error:", error);
      Alert.alert(
        "Không thể gọi điện",
        "Thiết bị hiện không mở được ứng dụng gọi điện. Vui lòng thử gọi thủ công tới hotline.",
      );
    }
  }, [telPhone]);

  const handleOpenZalo = useCallback(async () => {
    if (!zaloPhone) {
      Alert.alert(
        "Thiếu thông tin Zalo",
        "Hiện chưa có số điện thoại hỗ trợ để mở Zalo.",
      );
      return;
    }

    // ✅ Universal link ổn định hơn trên iOS + Android
    const zaloWebUrl = `https://zalo.me/${zaloPhone}`;

    try {
      await Linking.openURL(zaloWebUrl);
      return;
    } catch (_webError) {
      Alert.alert(
        "Không mở được Zalo",
        "Thiết bị hiện không mở được Zalo. Vui lòng gọi hotline để được hỗ trợ nhanh.",
        [
          { text: "Đóng", style: "cancel" },
          {
            text: "Gọi hotline",
            onPress: () => {
              void handleCallNow();
            },
          },
        ],
      );
    }
  }, [handleCallNow, zaloPhone]);

  const handleSendEmail = useCallback(async () => {
    if (!mailtoUrl) {
      Alert.alert("Thiếu email hỗ trợ", "Hiện chưa có email hỗ trợ tài xế.");
      return;
    }

    try {
      const supported = await Linking.canOpenURL(mailtoUrl);

      if (!supported) {
        Alert.alert(
          "Không thể gửi email",
          "Thiết bị hiện không hỗ trợ mở ứng dụng email.",
        );
        return;
      }

      await Linking.openURL(mailtoUrl);
    } catch {
      Alert.alert(
        "Không thể gửi email",
        "Có lỗi xảy ra khi mở ứng dụng email.",
      );
    }
  }, [mailtoUrl]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.container}>
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
            style={styles.headerBackButton}
            activeOpacity={0.85}
            onPress={handleGoBack}
          >
            <Text style={styles.headerBackIcon}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Hỗ trợ</Text>

          <View style={styles.headerRightSpace} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <Text style={styles.heroEmoji}>☎️</Text>
            <Text style={styles.heroTitle}>Hỗ trợ tài xế GoViet247</Text>
            <Text style={styles.heroText}>
              Nếu đang xử lý chuyến gấp hoặc cần hỗ trợ nhanh, vui lòng gọi
              hotline bên dưới.
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#F97316" />
              <Text style={styles.loadingText}>
                Đang tải thông tin hỗ trợ...
              </Text>
            </View>
          ) : (
            <>
              {!!error && (
                <View style={styles.errorCard}>
                  <Text style={styles.errorTitle}>Không thể tải dữ liệu</Text>
                  <Text style={styles.errorText}>{error}</Text>

                  <TouchableOpacity
                    style={styles.retryButton}
                    activeOpacity={0.85}
                    onPress={loadSupportData}
                  >
                    <Text style={styles.retryButtonText}>Tải lại</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.infoCard}>
                <Text style={styles.cardTitle}>Hotline hỗ trợ tài xế</Text>
                <Text style={styles.primaryValue}>{supportPhone}</Text>
                <Text style={styles.cardHint}>
                  Dùng cho các trường hợp gấp: hỗ trợ chuyến đi, xử lý sự cố,
                  hoặc cần liên hệ admin nhanh.
                </Text>

                <TouchableOpacity
                  style={styles.primaryButton}
                  activeOpacity={0.85}
                  onPress={handleCallNow}
                >
                  <Text style={styles.primaryButtonText}>Gọi ngay</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.cardTitle}>Zalo hỗ trợ</Text>
                <Text style={styles.secondaryValue}>
                  Chat với admin hỗ trợ qua Zalo
                </Text>
                <Text style={styles.cardHint}>
                  Nếu thiết bị không mở được Zalo, app sẽ gợi ý gọi hotline để
                  xử lý nhanh hơn.
                </Text>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  activeOpacity={0.85}
                  onPress={handleOpenZalo}
                >
                  <Text style={styles.secondaryButtonText}>Mở Zalo</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.cardTitle}>Email hỗ trợ</Text>
                <Text style={styles.secondaryValue}>{supportEmail}</Text>
                <Text style={styles.cardHint}>
                  Phù hợp cho các trường hợp cần mô tả chi tiết hoặc gửi thông
                  tin không gấp.
                </Text>

                <TouchableOpacity
                  style={styles.darkButton}
                  activeOpacity={0.85}
                  onPress={handleSendEmail}
                >
                  <Text style={styles.darkButtonText}>Gửi email</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>Lưu ý</Text>
                <Text style={styles.noteText}>
                  • Nếu đang trên chuyến hoặc có vấn đề khẩn cấp, hãy ưu tiên
                  gọi hotline.
                </Text>
                <Text style={styles.noteText}>
                  • Nếu không khẩn cấp vui lòng nhắn tin qua zalo.
                </Text>
                <Text style={styles.noteText}>
                  • Nếu cần gửi nội dung dài hoặc chi tiết, hãy dùng email.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#EEF2F7",
  },
  container: {
    flex: 1,
    backgroundColor: "#EEF2F7",
  },
  header: {
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },
  headerBackButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRightSpace: {
    width: 48,
    height: 48,
  },
  headerBackIcon: {
    fontSize: 26,
    lineHeight: 26,
    color: "#111827",
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
    padding: 16,
    paddingBottom: 88,
    gap: 14,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  heroEmoji: {
    fontSize: 34,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#6B7280",
    textAlign: "center",
  },
  loadingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
  },
  errorCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#B91C1C",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#6B7280",
  },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: 14,
    minWidth: 110,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
  },
  primaryValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    color: "#F97316",
    marginBottom: 10,
  },
  secondaryValue: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 10,
  },
  cardHint: {
    fontSize: 14,
    lineHeight: 22,
    color: "#6B7280",
    marginBottom: 16,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  darkButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  darkButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  noteCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  noteTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1D4ED8",
    marginBottom: 10,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#1E40AF",
    marginBottom: 6,
  },
});
