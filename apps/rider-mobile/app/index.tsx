// Path: goviet247/apps/rider-mobile/app/index.tsx
import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { requestOtp, verifyOtp } from "../services/authApi";
import { setRiderToken, getRiderToken } from "../services/storage";
import { getRiderPublicSystemConfig } from "../services/tripApi";

function formatOtpCountdown(ms: number) {
  const safeMs = Math.max(0, Number(ms || 0));
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function RiderLoginScreen() {
  const insets = useSafeAreaInsets();

  const [phone, setPhone] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const [supportPhone, setSupportPhone] = useState("");
  const [brandName, setBrandName] = useState("GoViet247");
  const [brandLogoUrl, setBrandLogoUrl] = useState("");

  useEffect(() => {
    async function checkToken() {
      const token = await getRiderToken();

      if (token) {
        router.replace("/bootstrap");
      }
    }

    void checkToken();
  }, []);

  useEffect(() => {
    if (!sessionId || !otpExpiresAt) return;

    const timer = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionId, otpExpiresAt]);

  useEffect(() => {
    async function loadConfig() {
      try {
        const data = await getRiderPublicSystemConfig();

        setSupportPhone(String(data?.supportPhoneRider || "").trim());
        setBrandName(String(data?.brandName || "").trim() || "GoViet247");
        setBrandLogoUrl(String(data?.brandLogoUrl || "").trim());
      } catch (err) {
        console.warn("load system config error", err);
      }
    }

    void loadConfig();
  }, []);

  const otpRemainingMs = useMemo(() => {
    if (!sessionId || !otpExpiresAt) return 0;

    const expiresMs = new Date(otpExpiresAt).getTime();
    if (Number.isNaN(expiresMs)) return 0;

    return Math.max(0, expiresMs - nowTs);
  }, [sessionId, otpExpiresAt, nowTs]);

  const otpCountdownLabel = useMemo(() => {
    return formatOtpCountdown(otpRemainingMs);
  }, [otpRemainingMs]);

  const isOtpExpired = !!sessionId && otpRemainingMs <= 0;

  async function handleSendOtp() {
    try {
      setLoading(true);

      const cleanPhone = phone.trim();

      if (!cleanPhone) {
        Alert.alert("Thiếu số điện thoại", "Vui lòng nhập số điện thoại.");
        return;
      }

      const res = await requestOtp(cleanPhone);
      setSessionId(res.session_id);

      const fallbackExpiresAt = new Date(Date.now() + 180 * 1000).toISOString();

      const nextExpiresAt =
        (res as any)?.expiresAt ||
        (res as any)?.expires_at ||
        ((res as any)?.expiresIn
          ? new Date(
              Date.now() + Number((res as any).expiresIn) * 1000,
            ).toISOString()
          : null) ||
        ((res as any)?.ttlSeconds
          ? new Date(
              Date.now() + Number((res as any).ttlSeconds) * 1000,
            ).toISOString()
          : null) ||
        fallbackExpiresAt;

      setOtpExpiresAt(nextExpiresAt);
      setNowTs(Date.now());

      Alert.alert(
        "Thành công",
        "Mã OTP đã được gửi đến số điện thoại của bạn. Vui lòng kiểm tra tin nhắn SMS.",
      );
    } catch (error: any) {
      Alert.alert("Không gửi được OTP", error?.message || "Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    try {
      setLoading(true);

      if (isOtpExpired) {
        Alert.alert("OTP hết hạn", "Vui lòng gửi lại mã OTP mới.");
        return;
      }

      if (!sessionId) {
        Alert.alert("Thiếu phiên OTP", "Vui lòng gửi OTP lại.");
        return;
      }

      const res = await verifyOtp(sessionId, otp.trim());
      const token = res?.access_token;

      if (!token) {
        throw new Error("Không nhận được token đăng nhập.");
      }

      await setRiderToken(token);
      router.replace("/bootstrap");
    } catch (error: any) {
      Alert.alert(
        "Xác minh thất bại",
        error?.message || "OTP không hợp lệ hoặc đã hết hạn.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChangePhone() {
    setSessionId(null);
    setOtp("");
    setOtpExpiresAt(null);
    setNowTs(Date.now());
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 12}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.contentContainer,
            {
              paddingTop: Math.max(insets.top, 10),
              paddingBottom: Math.max(insets.bottom, 18),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <View style={styles.heroBox}>
              <View style={styles.brandRow}>
                {brandLogoUrl ? (
                  <Image
                    source={{ uri: brandLogoUrl }}
                    style={styles.brandLogoImage}
                  />
                ) : (
                  <View style={styles.brandLogoFallback} />
                )}

                <Text style={styles.brandText}>{brandName}</Text>
              </View>
              <Text style={styles.brandSub}>
                Thuê xe riêng, đi đường dài thoải mái
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.title}>Đăng nhập / Đăng ký</Text>
              <Text style={styles.subtitle}>
                Nhập số điện thoại để tiếp tục.
              </Text>

              <Text style={styles.label}>Số điện thoại</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                editable={!loading && !sessionId}
                placeholder="Ví dụ: 0901234567"
                keyboardType="phone-pad"
                style={[styles.input, sessionId ? styles.inputDisabled : null]}
                placeholderTextColor="#9CA3AF"
              />

              {!sessionId ? (
                <Pressable
                  style={[
                    styles.primaryButton,
                    loading ? styles.buttonDisabled : null,
                  ]}
                  onPress={handleSendOtp}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Gửi OTP</Text>
                  )}
                </Pressable>
              ) : (
                <>
                  <View style={styles.infoBox}>
                    <Text style={styles.infoText}>
                      {isOtpExpired
                        ? "OTP đã hết hạn. Vui lòng gửi lại mã mới."
                        : `OTP đã được gửi. Vui lòng nhập mã trong ${otpCountdownLabel}.`}
                    </Text>
                  </View>

                  <Text style={styles.label}>Mã OTP</Text>
                  <TextInput
                    value={otp}
                    onChangeText={setOtp}
                    editable={!loading && !isOtpExpired}
                    placeholder="6 chữ số"
                    keyboardType="number-pad"
                    style={[
                      styles.input,
                      isOtpExpired ? styles.inputDisabled : null,
                    ]}
                    placeholderTextColor="#9CA3AF"
                  />

                  <Pressable
                    style={[
                      styles.primaryButton,
                      loading ? styles.buttonDisabled : null,
                    ]}
                    onPress={handleVerifyOtp}
                    disabled={loading || isOtpExpired}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Xác nhận OTP</Text>
                    )}
                  </Pressable>

                  <Pressable
                    style={styles.secondaryButton}
                    onPress={handleChangePhone}
                    disabled={loading}
                  >
                    <Text style={styles.secondaryButtonText}>Đổi số khác</Text>
                  </Pressable>

                  {isOtpExpired ? (
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={handleSendOtp}
                      disabled={loading}
                    >
                      <Text style={styles.secondaryButtonText}>Gửi lại mã</Text>
                    </Pressable>
                  ) : null}
                </>
              )}
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                © 2023–{new Date().getFullYear()} GoViet247
              </Text>

              <Text style={styles.footerText}>
                Công ty TNHH Công nghệ ViNa LightHouse
              </Text>

              <Text style={styles.footerHotline}>
                Hotline hỗ trợ khách hàng: {supportPhone || "..."}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  contentContainer: {
    flexGrow: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#FFFFFF",
    marginBottom: 14,
  },
  inputDisabled: {
    backgroundColor: "#F3F4F6",
    color: "#6B7280",
  },
  infoBox: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  infoText: {
    color: "#1D4ED8",
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  secondaryButtonText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  heroBox: {
    marginBottom: 18,
    alignItems: "center",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    gap: 10,
  },
  brandLogoImage: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    flexShrink: 0,
  },
  brandLogoFallback: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: "#F97316",
    flexShrink: 0,
  },
  brandText: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0F172A",
  },
  brandSub: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: "600",
    color: "#2563EB",
    textAlign: "center",
  },
  footer: {
    marginTop: 20,
    alignItems: "center",
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  footerHotline: {
    fontSize: 13,
    color: "#2563EB",
    fontWeight: "700",
    textAlign: "center",
  },
});
