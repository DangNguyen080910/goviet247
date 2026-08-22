// Path: goviet247/apps/driver-mobile/app/driver-profile/pending.tsx
import { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from "react-native";

export default function DriverProfilePendingScreen() {
  const [supportPhone, setSupportPhone] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [brandName, setBrandName] = useState("GoViet247");
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    async function loadSystemConfig() {
      try {
        const { getPublicSystemConfig } = await import(
          "../../services/systemConfigApi"
        );

        const data = await getPublicSystemConfig();

        if (data?.brandName) {
          setBrandName(String(data.brandName).trim());
        }

        if (data?.supportPhoneDriver) {
          setSupportPhone(String(data.supportPhoneDriver).trim());
        }

        if (data?.supportEmail) {
          setSupportEmail(String(data.supportEmail).trim());
        }
      } catch (error) {
        console.warn("loadSystemConfig pending error:", error);
      } finally {
        setLoadingConfig(false);
      }
    }

    loadSystemConfig();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.icon}>⏳</Text>

          <Text style={styles.title}>Hồ sơ đang chờ duyệt</Text>

          <Text style={styles.subtitle}>
            {brandName || "GoViet247"} đang kiểm tra hồ sơ tài xế của bạn. Vui
            lòng chờ thông báo sau khi hồ sơ được xét duyệt.
          </Text>

          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>Lưu ý</Text>
            <Text style={styles.noticeText}>
              Trong thời gian chờ duyệt, tài khoản chưa thể nhận chuyến. Nếu cần
              hỗ trợ, vui lòng liên hệ GoViet247.
            </Text>
          </View>

          <View style={styles.supportBox}>
            <Text style={styles.supportTitle}>Thông tin hỗ trợ</Text>

            {loadingConfig ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : (
              <>
                {supportPhone ? (
                  <Text style={styles.supportText}>
                    Hotline/Zalo: {supportPhone}
                  </Text>
                ) : null}

                {supportEmail ? (
                  <Text style={styles.supportText}>Email: {supportEmail}</Text>
                ) : null}

                {!supportPhone && !supportEmail ? (
                  <Text style={styles.supportText}>
                    Vui lòng liên hệ GoViet247 để được hỗ trợ.
                  </Text>
                ) : null}
              </>
            )}
          </View>
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
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 22,
  },
  icon: {
    fontSize: 42,
    textAlign: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 20,
  },
  noticeBox: {
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1D4ED8",
    marginBottom: 6,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#1E3A8A",
  },
  supportBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 14,
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  supportText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#374151",
    fontWeight: "600",
  },
});