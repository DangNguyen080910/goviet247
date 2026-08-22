// Path: goviet247/apps/driver-mobile/app/otp.tsx
import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { getMe, requestOtp, verifyOtp } from "../services/authApi";
import { removeDriverToken, setDriverToken } from "../services/storage";
import { API_BASE_URL } from "../constants/api";

function isDriverRole(role: string | null | undefined) {
  const normalized = String(role || "")
    .trim()
    .toUpperCase();
  return normalized === "DRIVER";
}

function formatMmSs(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;

  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function OtpScreen() {
  const params = useLocalSearchParams<{
    phone?: string;
    session_id?: string;
  }>();

  const initialPhone = useMemo(
    () => String(params.phone || ""),
    [params.phone],
  );
  const initialSessionId = useMemo(
    () => String(params.session_id || ""),
    [params.session_id],
  );

  const [phone, setPhone] = useState(initialPhone);
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [code, setCode] = useState("");
  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [expireSecondsLeft, setExpireSecondsLeft] = useState(180);
  const [supportPhone, setSupportPhone] = useState("");

  useEffect(() => {
    if (initialPhone) {
      setPhone(initialPhone);
    }
  }, [initialPhone]);

  useEffect(() => {
    if (initialSessionId) {
      setSessionId(initialSessionId);
    }
  }, [initialSessionId]);

  useEffect(() => {
    if (expireSecondsLeft <= 0) return;

    const timer = setInterval(() => {
      setExpireSecondsLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [expireSecondsLeft]);

  useEffect(() => {
    async function loadSupport() {
      try {
        const { getDriverSupportPhone } =
          await import("../services/systemConfigApi");
        const phone = await getDriverSupportPhone();
        setSupportPhone(phone || "");
      } catch (err) {
        console.warn("loadSupport error:", err);
      }
    }

    loadSupport();
  }, []);

  const getDriverSupportPhoneForBlockedAlert = async () => {
    try {
      const base = String(API_BASE_URL || "").replace(/\/+$/, "");
      const url = base.endsWith("/api")
        ? `${base}/public/system-config`
        : `${base}/api/public/system-config`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json().catch(() => ({}));

      const phone =
        data?.data?.supportPhoneDriver || data?.supportPhoneDriver || "";

      return String(phone || "").trim();
    } catch (error) {
      console.warn("getDriverSupportPhoneForBlockedAlert error:", error);
      return "";
    }
  };

  const goBackToPhoneInput = async () => {
    try {
      setCode("");
      setErrorText("");
      setSessionId("");
      await removeDriverToken();
    } catch (error) {
      console.warn("goBackToPhoneInput error:", error);
    } finally {
      router.replace("/");
    }
  };

  const handleVerify = async () => {
    const cleanCode = code.trim();

    if (!sessionId) {
      setErrorText("Thiếu session OTP. Vui lòng quay lại nhập số điện thoại.");
      return;
    }

    if (expireSecondsLeft <= 0) {
      setErrorText("Mã OTP đã hết hạn. Vui lòng gửi lại mã OTP.");
      return;
    }

    if (cleanCode.length !== 6) {
      setErrorText("Vui lòng nhập đủ 6 số OTP.");
      return;
    }

    try {
      setLoading(true);
      setErrorText("");

      const verifyData = await verifyOtp(sessionId, cleanCode);
      const token = verifyData.access_token;

      if (!token) {
        throw new Error("Không nhận được access token.");
      }

      await setDriverToken(token);

      const meData = await getMe(token);
      const user = meData.user;

      if (!isDriverRole(user?.role)) {
        await removeDriverToken();
        setErrorText("Tài khoản này không phải tài xế.");
        return;
      }

      router.replace("/bootstrap");
    } catch (error: any) {
      console.error("Verify OTP error:", error);

      const code = String(error?.code || "").toUpperCase();
      const rawMessage = error?.message || "Xác minh OTP thất bại.";

      await removeDriverToken();

      if (code === "DRIVER_REJECTED" || code === "DRIVER_SUSPENDED") {
        const supportPhone = await getDriverSupportPhoneForBlockedAlert();

        const title =
          code === "DRIVER_REJECTED"
            ? "Hồ sơ bị từ chối"
            : "Tài khoản bị tạm khóa";

        const finalMessage = supportPhone
          ? `${rawMessage}\n\nHotline hỗ trợ tài xế: ${supportPhone}`
          : rawMessage;

        setErrorText(
          code === "DRIVER_REJECTED"
            ? "Hồ sơ tài xế của bạn đã bị từ chối."
            : "Tài khoản tài xế của bạn đang bị tạm khóa.",
        );

        if (Platform.OS === "web") {
          window.alert(`${title}\n\n${finalMessage}`);
          router.replace("/");
          return;
        }

        Alert.alert(title, finalMessage, [
          {
            text: "OK",
            onPress: () => {
              router.replace("/");
            },
          },
        ]);
        return;
      }

      setErrorText(rawMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!phone) {
      setErrorText("Không tìm thấy số điện thoại để gửi lại OTP.");
      return;
    }

    if (resending || loading || expireSecondsLeft > 0) {
      return;
    }

    try {
      setResending(true);
      setErrorText("");

      const data = await requestOtp(phone);
      setSessionId(data.session_id);
      setCode("");
      setExpireSecondsLeft(180);
    } catch (error: any) {
      setErrorText(error?.message || "Không gửi lại được OTP.");
    } finally {
      setResending(false);
    }
  };

  const isOtpExpired = expireSecondsLeft <= 0;
  const verifyDisabled = loading || isOtpExpired;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 12}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.container}>
              <View style={styles.heroBox}>
                <Text style={styles.brand}>Xác minh OTP</Text>
                <Text style={styles.brandSub}>GoViet247 Driver</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.title}>Nhập mã OTP</Text>
                <Text style={styles.subtitle}>
                  Mã OTP đã được gửi tới số{" "}
                  <Text style={styles.bold}>{phone}</Text>
                </Text>

                <View
                  style={[
                    styles.infoBox,
                    isOtpExpired ? styles.infoBoxExpired : styles.infoBoxActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.infoText,
                      isOtpExpired
                        ? styles.infoTextExpired
                        : styles.infoTextActive,
                    ]}
                  >
                    {isOtpExpired
                      ? "Mã OTP đã hết hạn. Vui lòng gửi lại mã OTP."
                      : `Mã OTP còn hiệu lực trong ${formatMmSs(expireSecondsLeft)}`}
                  </Text>
                </View>

                <Text style={styles.label}>Mã OTP (6 số)</Text>
                <TextInput
                  value={code}
                  onChangeText={(text) => {
                    const onlyDigits = text.replace(/\D/g, "").slice(0, 6);
                    setCode(onlyDigits);
                    if (errorText) setErrorText("");
                  }}
                  placeholder="Nhập 6 số OTP"
                  keyboardType="number-pad"
                  style={[styles.input, isOtpExpired && styles.inputDisabled]}
                  placeholderTextColor="#9CA3AF"
                  editable={!loading && !isOtpExpired}
                  maxLength={6}
                />

                {!!errorText && (
                  <Text style={styles.errorText}>{errorText}</Text>
                )}

                <TouchableOpacity
                  style={[
                    styles.button,
                    verifyDisabled && styles.buttonDisabled,
                  ]}
                  onPress={handleVerify}
                  disabled={verifyDisabled}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Xác nhận OTP</Text>
                  )}
                </TouchableOpacity>

                {isOtpExpired ? (
                  <TouchableOpacity
                    style={[
                      styles.secondaryButton,
                      (loading || resending) && styles.secondaryButtonDisabled,
                    ]}
                    onPress={handleResend}
                    disabled={loading || resending}
                  >
                    <Text
                      style={[
                        styles.secondaryButtonText,
                        (loading || resending) &&
                          styles.secondaryButtonTextDisabled,
                      ]}
                    >
                      {resending ? "Đang gửi..." : "Gửi lại mã"}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={styles.backButton}
                  onPress={goBackToPhoneInput}
                  disabled={loading || resending}
                >
                  <Text style={styles.backButtonText}>
                    Quay lại nhập số điện thoại
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  © 2023–{new Date().getFullYear()} GoViet247{"\n"}
                  Công ty TNHH Công nghệ ViNa LightHouse
                </Text>

                {supportPhone ? (
                  <Text style={styles.footerHotline}>
                    Hotline hỗ trợ tài xế: {supportPhone}
                  </Text>
                ) : null}
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  keyboardWrap: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
    paddingVertical: 24,
  },
  heroBox: {
    marginBottom: 24,
    alignItems: "center",
  },
  brand: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0F172A",
  },
  brandSub: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: "600",
    color: "#2563EB",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: "#6B7280",
    marginBottom: 16,
  },
  bold: {
    fontWeight: "700",
    color: "#111827",
  },
  infoBox: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  infoBoxActive: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  infoBoxExpired: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  infoText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  infoTextActive: {
    color: "#166534",
  },
  infoTextExpired: {
    color: "#9A3412",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 18,
    color: "#111827",
    backgroundColor: "#F9FAFB",
    marginBottom: 10,
    letterSpacing: 6,
  },
  inputDisabled: {
    opacity: 0.65,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 13,
    marginBottom: 12,
  },
  button: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#93C5FD",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    marginTop: 16,
  },
  secondaryButtonDisabled: {
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
  },
  secondaryButtonText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  secondaryButtonTextDisabled: {
    color: "#9CA3AF",
  },
  backButton: {
    marginTop: 12,
    alignItems: "center",
  },
  backButtonText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
  },
  footer: {
    marginTop: 20,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 18,
  },
  footerHotline: {
    marginTop: 6,
    fontSize: 12,
    color: "#2563EB",
    fontWeight: "600",
    textAlign: "center",
  },
});
