// Path: goviet247/apps/rider-mobile/app/profile.tsx
import { useCallback, useEffect, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import AppBrandHeader from "../components/AppBrandHeader";
import { deleteMe, getMe, updateMe } from "../services/authApi";
import { getRiderSupportConfig } from "../services/tripApi";
import { getRiderToken, removeRiderToken } from "../services/storage";

type MeUser = {
  id: string;
  displayName: string | null;
  riderName?: string | null;
  driverName?: string | null;
  phone: string | null;
  role: string;
  primaryRole?: string | null;
  hasDriverProfile?: boolean;
  hasRiderProfile?: boolean;
  createdAt?: string;
} | null;

function formatPhone(phone: string | null | undefined) {
  const raw = String(phone || "").trim();
  if (!raw) return "";

  if (raw.startsWith("+84") && raw.length >= 12) {
    return `0${raw.slice(3)}`;
  }

  return raw;
}

function normalizePhoneForTel(phone: string | null | undefined) {
  const raw = String(phone || "").trim();

  if (!raw) return "";

  if (raw.startsWith("+")) {
    return `+${raw.slice(1).replace(/\D/g, "")}`;
  }

  return raw.replace(/\D/g, "");
}

function normalizePhoneForZalo(phone: string | null | undefined) {
  return String(phone || "").replace(/\D/g, "");
}

function getRiderDisplayName(user: MeUser) {
  return (
    String(user?.riderName || "").trim() ||
    String(user?.displayName || "").trim() ||
    "Chưa cập nhật"
  );
}

function getRoleLabel(roleRaw: string | null | undefined) {
  const role = String(roleRaw || "")
    .trim()
    .toUpperCase();

  switch (role) {
    case "RIDER":
      return "Khách hàng";
    case "DRIVER":
      return "Tài xế";
    case "ADMIN":
      return "Quản trị viên";
    default:
      return role || "Khách hàng";
  }
}

export default function RiderProfileScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<MeUser>(null);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [supportPhone, setSupportPhone] = useState("");

  async function loadProfile() {
    try {
      setLoading(true);

      await loadSupportConfig();

      const token = await getRiderToken();

      if (!token) {
        router.replace("/");
        return;
      }

      const meData = await getMe(token);
      const nextUser = meData?.user || null;

      setUser(nextUser);
      setDisplayNameInput(getRiderDisplayName(nextUser));
    } catch (error) {
      console.error("load rider profile error:", error);
      Alert.alert("Lỗi", "Không tải được tài khoản. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, []),
  );

  async function handleSaveDisplayName() {
    try {
      const nextName = String(displayNameInput || "").trim();

      if (nextName.length < 2) {
        Alert.alert(
          "Thiếu thông tin",
          "Tên khách hàng phải có ít nhất 2 ký tự.",
        );
        return;
      }

      const token = await getRiderToken();

      if (!token) {
        router.replace("/");
        return;
      }

      setSaving(true);

      const data = await updateMe(token, {
        displayName: nextName,
      });

      const nextUser = data?.user || null;

      setUser(nextUser);
      setDisplayNameInput(getRiderDisplayName(nextUser));

      Alert.alert("Thành công", "Đã cập nhật tên khách hàng.");
    } catch (error: any) {
      console.error("update rider profile error:", error);
      Alert.alert(
        "Lỗi",
        error?.message ||
          "Không cập nhật được tên khách hàng. Vui lòng thử lại.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function loadSupportConfig() {
    try {
      const data = await getRiderSupportConfig();
      setSupportPhone(String(data?.supportPhoneRider || "").trim());
    } catch (error) {
      console.warn("load rider support config error:", error);
      setSupportPhone("");
    }
  }

  async function handleCallSupport() {
    try {
      const telPhone = normalizePhoneForTel(supportPhone);

      if (!telPhone) {
        Alert.alert(
          "Thiếu số hỗ trợ",
          "Hiện chưa có số điện thoại hỗ trợ khách hàng.",
        );
        return;
      }

      const telUrl = `tel:${telPhone}`;
      await Linking.openURL(telUrl);
    } catch (error) {
      console.error("call rider support error:", error);
      Alert.alert(
        "Không thể gọi điện",
        "Thiết bị hiện không mở được ứng dụng gọi điện. Vui lòng thử gọi thủ công tới hotline.",
      );
    }
  }

  async function handleOpenZaloSupport() {
    try {
      const zaloPhone = normalizePhoneForZalo(supportPhone);

      if (!zaloPhone) {
        Alert.alert(
          "Thiếu số hỗ trợ",
          "Hiện chưa có số điện thoại hỗ trợ khách hàng.",
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
                void handleCallSupport();
              },
            },
          ],
        );
      }
    } catch (error) {
      console.error("open rider zalo support error:", error);

      Alert.alert(
        "Không mở được Zalo",
        "Có lỗi xảy ra khi mở Zalo. Vui lòng gọi hotline để được hỗ trợ nhanh.",
        [
          { text: "Đóng", style: "cancel" },
          {
            text: "Gọi hotline",
            onPress: () => {
              void handleCallSupport();
            },
          },
        ],
      );
    }
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "Xóa tài khoản",
      "Bạn có chắc muốn xóa tài khoản GoViet247 không? Hành động này không thể hoàn tác.",
      [
        {
          text: "Hủy",
          style: "cancel",
        },
        {
          text: "Xóa tài khoản",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await getRiderToken();

              if (!token) {
                router.replace("/");
                return;
              }

              await deleteMe(token);

              await removeRiderToken();

              Alert.alert(
                "Đã xóa tài khoản",
                "Tài khoản của bạn đã được xóa thành công.",
                [
                  {
                    text: "OK",
                    onPress: () => {
                      router.replace("/");
                    },
                  },
                ],
              );
            } catch (error: any) {
              console.error("delete account error:", error);

              Alert.alert(
                "Không thể xóa tài khoản",
                error?.message || "Vui lòng thử lại sau.",
              );
            }
          },
        },
      ],
    );
  }

  async function handleLogout() {
    try {
      await removeRiderToken();
      router.replace("/");
    } catch (error) {
      console.error("logout error:", error);
      Alert.alert("Lỗi", "Không thể đăng xuất. Vui lòng thử lại.");
    }
  }

  const currentDisplayName = getRiderDisplayName(user);
  const normalizedInput = String(displayNameInput || "").trim();
  const canSave =
    !loading &&
    !saving &&
    normalizedInput.length >= 2 &&
    normalizedInput !== currentDisplayName;

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: Math.max(insets.top, 10),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AppBrandHeader title="Tài khoản" />

        <View style={styles.profileCard}>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          ) : (
            <>
              <View style={styles.avatarWrap}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {currentDisplayName.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.profileName}>{currentDisplayName}</Text>
                <Text style={styles.profilePhone}>
                  {formatPhone(user?.phone) || "Chưa có số điện thoại"}
                </Text>
              </View>

              <View style={styles.infoCard}>
                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Tên khách hàng</Text>
                  <TextInput
                    value={displayNameInput}
                    onChangeText={setDisplayNameInput}
                    placeholder="Nhập tên khách hàng"
                    placeholderTextColor="#9CA3AF"
                    style={styles.input}
                    editable={!saving}
                    maxLength={100}
                  />
                  <Text style={styles.helperText}>
                    Tên này sẽ được dùng để hiển thị cho các lần đặt chuyến sau.
                  </Text>
                </View>

                <Pressable
                  style={[
                    styles.saveButton,
                    !canSave && styles.saveButtonDisabled,
                  ]}
                  onPress={handleSaveDisplayName}
                  disabled={!canSave}
                >
                  <Text
                    style={[
                      styles.saveButtonText,
                      !canSave && styles.saveButtonTextDisabled,
                    ]}
                  >
                    {saving ? "Đang lưu..." : "Lưu lại"}
                  </Text>
                </Pressable>

                <View style={styles.divider} />

                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Số điện thoại</Text>
                  <Text style={styles.value}>
                    {formatPhone(user?.phone) || "Chưa có số điện thoại"}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Vai trò chính</Text>
                  <Text style={styles.value}>
                    {getRoleLabel(user?.primaryRole || user?.role || "RIDER")}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Hồ sơ khách hàng</Text>
                  <Text style={styles.value}>
                    {user?.hasRiderProfile ? "Đã có" : "Chưa có"}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        <Pressable
          style={styles.zaloSupportButton}
          onPress={handleOpenZaloSupport}
        >
          <Text style={styles.zaloSupportButtonText}>💬 Hỗ trợ qua Zalo</Text>
        </Pressable>

        <Pressable
          style={styles.feedbackButton}
          onPress={() => {
            router.push("/feedback");
          }}
        >
          <Text style={styles.feedbackButtonText}>✉️ Góp ý chung</Text>
        </Pressable>

        <>
          <Pressable
            style={styles.deleteAccountButton}
            onPress={handleDeleteAccount}
          >
            <Text style={styles.deleteAccountText}>Xóa tài khoản</Text>
          </Pressable>

          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </Pressable>
        </>
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  loadingWrap: {
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWrap: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatarCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#2563EB",
  },
  profileName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 4,
  },
  profilePhone: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  infoCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  fieldBlock: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
  },
  value: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
    lineHeight: 24,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  helperText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#6B7280",
  },
  saveButton: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#DBEAFE",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  saveButtonTextDisabled: {
    color: "#6B7280",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 16,
  },
  zaloSupportButton: {
    marginTop: 16,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#86EFAC",
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
  },
  zaloSupportButtonText: {
    color: "#15803D",
    fontSize: 15,
    fontWeight: "800",
  },
  feedbackButton: {
    marginTop: 16,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#93C5FD",
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  feedbackButtonText: {
    color: "#2563EB",
    fontSize: 15,
    fontWeight: "800",
  },
  deleteAccountButton: {
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },

  deleteAccountText: {
    color: "#B91C1C",
    fontSize: 16,
    fontWeight: "800",
  },
  logoutButton: {
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  logoutText: {
    color: "#DC2626",
    fontSize: 16,
    fontWeight: "800",
  },
});
