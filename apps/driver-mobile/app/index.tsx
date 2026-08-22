// Path: goviet247/apps/driver-mobile/app/index.tsx
import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Image,
} from "react-native";
import { requestOtp } from "../services/authApi";
import { getDriverToken } from "../services/storage";

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);

  const phoneInputRef = useRef<TextInput | null>(null);
  const [supportPhone, setSupportPhone] = useState("");
  const [brandName, setBrandName] = useState("GoViet247");
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    async function checkLogin() {
      try {
        const token = await getDriverToken();

        if (token) {
          router.replace("/bootstrap");
          return;
        }
      } catch (error) {
        console.error("Kiểm tra token thất bại:", error);
      } finally {
        setCheckingToken(false);
      }
    }

    checkLogin();
  }, []);

  useEffect(() => {
    async function loadSystemConfig() {
      try {
        const { getPublicSystemConfig } =
          await import("../services/systemConfigApi");

        const data = await getPublicSystemConfig();

        if (data?.supportPhoneDriver) {
          setSupportPhone(String(data.supportPhoneDriver).trim());
        }

        if (data?.brandName) {
          setBrandName(String(data.brandName).trim());
        }

        if (data?.brandLogoUrl) {
          setBrandLogoUrl(String(data.brandLogoUrl).trim());
        }
      } catch (err) {
        console.warn("loadSystemConfig error:", err);
      }
    }

    loadSystemConfig();
  }, []);

  const handleContinue = async () => {
    const cleanPhone = phone.trim();

    if (!cleanPhone) {
      setErrorText("Vui lòng nhập số điện thoại.");
      return;
    }

    try {
      setLoading(true);
      setErrorText("");

      const data = await requestOtp(cleanPhone);

      router.push({
        pathname: "/otp",
        params: {
          phone: cleanPhone,
          session_id: data.session_id,
          resend_after: data.resend_after,
        },
      });
    } catch (error: any) {
      setErrorText(error?.message || "Không gửi được OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterNow = () => {
    setErrorText("");
    phoneInputRef.current?.focus();
  };

  if (checkingToken) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Đang kiểm tra đăng nhập...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.heroBox}>
          <View style={styles.brandRow}>
            {brandLogoUrl ? (
              <Image
                source={{ uri: brandLogoUrl }}
                style={styles.brandLogo}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.brandMark} />
            )}

            <Text style={styles.brand} numberOfLines={1}>
              {brandName || "GoViet247"}
            </Text>
          </View>

          <Text style={styles.brandSub}>Driver App</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Đăng nhập / Đăng ký tài xế</Text>

          <Text style={styles.label}>Số điện thoại</Text>
          <TextInput
            ref={phoneInputRef}
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              if (errorText) setErrorText("");
            }}
            placeholder="Ví dụ: 0901234567"
            keyboardType="phone-pad"
            style={styles.input}
            editable={!loading}
            placeholderTextColor="#9CA3AF"
          />

          {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Tiếp tục</Text>
            )}
          </TouchableOpacity>

          <View style={styles.registerRow}>
            <Text style={styles.registerHint}>Chưa có tài khoản? </Text>
            <TouchableOpacity
              onPress={handleRegisterNow}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.registerLink}>Đăng ký ngay</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.helperText}>
            Nhập số điện thoại để đăng nhập hoặc tạo tài khoản tài xế mới bằng
            OTP.
          </Text>

          <Text style={styles.helperSubText}>
            Nếu số điện thoại chưa tồn tại, tài khoản mới sẽ được tạo tự động
            sau khi xác thực OTP.
          </Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2023–{new Date().getFullYear()} {brandName || "GoViet247"}
            {"\n"}
            Công ty TNHH Công nghệ ViNa LightHouse
          </Text>

          {supportPhone ? (
            <Text style={styles.footerHotline}>
              Hotline hỗ trợ tài xế: {supportPhone}
            </Text>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  heroBox: {
    marginBottom: 24,
    alignItems: "center",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  brandLogo: {
    width: 42,
    height: 42,
    borderRadius: 10,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#F97316",
    flexShrink: 0,
  },
  brand: {
    flexShrink: 1,
    fontSize: 34,
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
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 20,
    color: "#111827",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#374151",
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
    color: "#111827",
  },
  errorText: {
    color: "#DC2626",
    marginBottom: 12,
  },
  button: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  registerRow: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  registerHint: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  registerLink: {
    fontSize: 14,
    color: "#DC2626",
    fontWeight: "800",
  },
  helperText: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    color: "#6B7280",
  },
  helperSubText: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 16,
    color: "#94A3B8",
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
