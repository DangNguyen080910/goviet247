// Path: goviet247/apps/driver-mobile/app/driver-profile/suspended.tsx
import { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Linking,
} from "react-native";
import { getDriverToken } from "../../services/storage";
import { getMyDriverProfile } from "../../services/driverProfileApi";

export default function DriverProfileSuspendedScreen() {
  const [suspendReason, setSuspendReason] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [brandName, setBrandName] = useState("GoViet247");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const token = await getDriverToken();

        if (token) {
          const profileData = await getMyDriverProfile(token);
          const reason = String(
            profileData?.profile?.suspendReason || ""
          ).trim();

          if (reason) {
            setSuspendReason(reason);
          }
        }

        const { getPublicSystemConfig } = await import(
          "../../services/systemConfigApi"
        );

        const config = await getPublicSystemConfig();

        if (config?.brandName) {
          setBrandName(String(config.brandName).trim());
        }

        if (config?.supportPhoneDriver) {
          setSupportPhone(String(config.supportPhoneDriver).trim());
        }

        if (config?.supportEmail) {
          setSupportEmail(String(config.supportEmail).trim());
        }
      } catch (error) {
        console.warn("load suspended profile data error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleCallSupport = () => {
    if (!supportPhone) return;

    const cleanPhone = supportPhone.replace(/\s+/g, "");

    Linking.openURL(`tel:${cleanPhone}`).catch((error) => {
      console.warn("open support phone error:", error);
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.icon}>⛔</Text>

          <Text style={styles.title}>Tài khoản bị khóa</Text>

          <Text style={styles.subtitle}>
            Tài khoản tài xế của bạn hiện đang bị tạm khóa. Vui lòng xem lý do
            bên dưới và liên hệ {brandName || "GoViet247"} nếu cần hỗ trợ.
          </Text>

          <View style={styles.reasonBox}>
            <Text style={styles.reasonTitle}>Lý do khóa tài khoản</Text>

            {loading ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Text style={styles.reasonText}>
                {suspendReason ||
                  "Tài khoản hiện chưa thể hoạt động. Vui lòng liên hệ GoViet247 để được hỗ trợ."}
              </Text>
            )}
          </View>

          <View style={styles.supportBox}>
            <Text style={styles.supportTitle}>Thông tin hỗ trợ</Text>

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
          </View>

          {supportPhone ? (
            <TouchableOpacity
              style={styles.callButton}
              activeOpacity={0.85}
              onPress={handleCallSupport}
            >
              <Text style={styles.callButtonText}>Gọi hỗ trợ</Text>
            </TouchableOpacity>
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
  reasonBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  reasonTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#B91C1C",
    marginBottom: 6,
  },
  reasonText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#7F1D1D",
    fontWeight: "600",
  },
  supportBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
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
  callButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  callButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});