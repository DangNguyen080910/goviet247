import { useEffect } from "react";
import Constants from "expo-constants";
import { Alert, Linking, Platform } from "react-native";
import { API_BASE_URL } from "../constants/api";

type UpdateConfig = {
  latestVersion?: string;
  minimumVersion?: string;
  iosStoreUrl?: string;
  androidStoreUrl?: string;
  updateMessage?: string;
};

function compareVersions(left = "0.0.0", right = "0.0.0") {
  const a = left.split(".").map((part) => Number(part) || 0);
  const b = right.split(".").map((part) => Number(part) || 0);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (a[index] || 0) - (b[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export default function AppUpdatePrompt() {
  useEffect(() => {
    if (Platform.OS === "web") return;

    let active = true;

    async function checkVersion() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/public/system-config`);
        const payload = await response.json().catch(() => ({}));
        if (!active || !response.ok || !payload?.success) return;

        const config = payload?.data?.mobileApps?.driver as
          | UpdateConfig
          | undefined;
        const currentVersion = String(Constants.expoConfig?.version || "0.0.0");
        const latestVersion = String(config?.latestVersion || currentVersion);
        const minimumVersion = String(config?.minimumVersion || currentVersion);

        if (compareVersions(currentVersion, latestVersion) >= 0) return;

        const storeUrl =
          Platform.OS === "ios"
            ? String(config?.iosStoreUrl || "")
            : String(config?.androidStoreUrl || "");
        const isRequired =
          compareVersions(currentVersion, minimumVersion) < 0 && Boolean(storeUrl);
        const message =
          String(config?.updateMessage || "").trim() ||
          "GoViet247 Driver đã có phiên bản mới.";

        const openStore = () => {
          Linking.openURL(storeUrl).catch(() => {
            Alert.alert("Không mở được cửa hàng", "Vui lòng mở App Store hoặc Google Play và tìm GoViet247 Driver.");
          });
        };

        Alert.alert(
          isRequired ? "Cần cập nhật ứng dụng" : "Đã có phiên bản mới",
          `${message}\n\nPhiên bản hiện tại: ${currentVersion}\nPhiên bản mới: ${latestVersion}`,
          isRequired
            ? [{ text: "Cập nhật ngay", onPress: openStore }]
            : [
                { text: "Để sau", style: "cancel" },
                ...(storeUrl
                  ? [{ text: "Cập nhật ngay", onPress: openStore }]
                  : []),
              ],
          { cancelable: !isRequired },
        );
      } catch (error) {
        console.warn("[AppUpdate] check version error:", error);
      }
    }

    void checkVersion();
    return () => {
      active = false;
    };
  }, []);

  return null;
}
