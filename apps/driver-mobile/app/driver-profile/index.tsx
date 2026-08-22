// Path: goviet247/apps/driver-mobile/app/driver-profile/index.tsx
import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  Alert,
} from "react-native";

import { API_BASE_URL } from "../../constants/api";
import { clearDriverToken, getDriverToken } from "../../services/storage";
import { getMyDriverProfile } from "../../services/driverProfileApi";

function getDriverDisplayName(profile: any) {
  return (
    profile?.fullName ||
    profile?.displayName ||
    profile?.phone ||
    "Tài xế GoViet247"
  );
}

export default function DriverProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [errorText, setErrorText] = useState("");

  const topInset =
    Platform.OS === "android"
      ? Math.max((StatusBar.currentHeight ?? 0) - 6, 8)
      : 0;

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const token = await getDriverToken();

      if (!token) {
        throw new Error("Phiên đăng nhập đã hết hạn.");
      }

      const data = await getMyDriverProfile(token);

      if (!data?.profile) {
        router.replace("/driver-profile/create");
        return;
      }

      setProfile(data.profile);
    } catch (error: any) {
      setErrorText(error?.message || "Không tải được hồ sơ.");
    } finally {
      setLoading(false);
    }
  }

  const portraitUrl = useMemo(() => {
    const documents = Array.isArray(profile?.documents)
      ? profile.documents
      : [];

    const portraitDoc = documents.find((item: any) => {
      const docType = String(
        item?.type || item?.documentType || item?.docType || "",
      ).toUpperCase();

      return docType === "PORTRAIT";
    });

    const raw =
      portraitDoc?.viewUrl ||
      portraitDoc?.signedUrl ||
      portraitDoc?.fileUrl ||
      portraitDoc?.file_url ||
      portraitDoc?.url ||
      portraitDoc?.publicUrl ||
      portraitDoc?.s3Url ||
      null;

    const normalized = String(raw || "").trim();

    if (!normalized) return null;

    if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
      return normalized;
    }

    if (normalized.startsWith("/")) {
      return `${API_BASE_URL}${normalized}`;
    }

    return `${API_BASE_URL}/${normalized}`;
  }, [profile]);

  const carTypeLabel = useMemo(() => {
    switch (profile?.vehicleType) {
      case "CAR_5":
        return "Xe 5 chỗ";
      case "CAR_7":
        return "Xe 7 chỗ";
      case "CAR_16":
        return "Xe 16 chỗ";
      default:
        return profile?.vehicleType || "--";
    }
  }, [profile]);

  const handleGoHome = () => {
    router.replace("/dashboard");
  };

  async function handleDeleteAccount() {
    try {
      const token = await getDriverToken();

      if (!token) {
        throw new Error("Phiên đăng nhập đã hết hạn.");
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Không thể xóa tài khoản.");
      }

      await clearDriverToken();

      router.replace("/");
    } catch (error: any) {
      Alert.alert(
        "Không thể xóa tài khoản",
        error?.message || "Vui lòng thử lại sau.",
      );
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Đang tải hồ sơ...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorText) {
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
            onPress={handleGoHome}
          >
            <Text style={styles.headerIcon}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Hồ sơ tài xế</Text>

          <View style={styles.headerIconButton} />
        </View>

        <View style={styles.loadingWrap}>
          <Text style={styles.errorText}>{errorText}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) return null;

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
          onPress={handleGoHome}
        >
          <Text style={styles.headerIcon}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Hồ sơ tài xế</Text>

        <View style={styles.headerIconButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <View style={styles.heroCard}>
            {portraitUrl ? (
              <Image
                source={{ uri: portraitUrl }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>👨‍✈️</Text>
              </View>
            )}

            <Text style={styles.driverName}>
              {getDriverDisplayName(profile)}
            </Text>

            <Text style={styles.driverPhone}>{profile.phone || "--"}</Text>

            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>Đã duyệt</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Thông tin xe</Text>

            <View style={styles.infoItem}>
              <Text style={styles.label}>Loại xe</Text>
              <Text style={styles.value}>{carTypeLabel}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.label}>Hãng xe</Text>
              <Text style={styles.value}>{profile.vehicleBrand || "--"}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.label}>Dòng xe</Text>
              <Text style={styles.value}>{profile.vehicleModel || "--"}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.label}>Năm xe</Text>
              <Text style={styles.value}>
                {profile.vehicleYear ? String(profile.vehicleYear) : "--"}
              </Text>
            </View>

            <View style={[styles.infoItem, styles.infoItemNoBorder]}>
              <Text style={styles.label}>Biển số</Text>
              <Text style={styles.value}>{profile.plateNumber || "--"}</Text>
            </View>
          </View>
          <View style={styles.dangerCard}>
            <Text style={styles.dangerTitle}>Quản lý tài khoản</Text>

            <Text style={styles.dangerText}>
              Bạn có thể yêu cầu xóa vĩnh viễn tài khoản tài xế GoViet247.
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.deleteButton}
              onPress={() => {
                Alert.alert(
                  "Xóa tài khoản",
                  "Bạn có chắc muốn xóa tài khoản tài xế GoViet247? Hành động này sẽ đăng xuất tài khoản hiện tại.",
                  [
                    {
                      text: "Hủy",
                      style: "cancel",
                    },
                    {
                      text: "Xóa tài khoản",
                      style: "destructive",
                      onPress: handleDeleteAccount,
                    },
                  ],
                );
              }}
            >
              <Text style={styles.deleteButtonText}>Xóa tài khoản tài xế</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },
  headerIconButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: {
    fontSize: 24,
    color: "#374151",
    fontWeight: "700",
    lineHeight: 24,
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
    padding: 20,
    paddingBottom: 84,
  },
  container: {
    flex: 1,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  avatar: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: "#E5E7EB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  avatarFallback: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  avatarFallbackText: {
    fontSize: 46,
  },
  driverName: {
    marginTop: 14,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  driverPhone: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
  },
  statusBadge: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#DCFCE7",
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#16A34A",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
    color: "#111827",
  },
  infoItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  infoItemNoBorder: {
    borderBottomWidth: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 4,
  },
  value: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 10,
    color: "#6B7280",
    fontWeight: "600",
  },
  errorText: {
    color: "#DC2626",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  dangerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#FECACA",
  },

  dangerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#991B1B",
    marginBottom: 10,
  },

  dangerText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#7F1D1D",
    marginBottom: 16,
  },

  deleteButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },

  deleteButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
