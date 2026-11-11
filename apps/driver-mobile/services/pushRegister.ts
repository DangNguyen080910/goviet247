// Path: goviet247/apps/driver-mobile/services/pushRegister.ts
import { requestNotificationPermission } from "../../mobile-chat/permissionHelp";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { prepareNotificationUx } from "../services/notify";
import { API_BASE_URL } from "../constants/api";

function resolveExpoProjectId() {
  const fromEasConfig = String(Constants?.easConfig?.projectId || "").trim();
  const fromExpoConfig = String(
    Constants?.expoConfig?.extra?.eas?.projectId || "",
  ).trim();

  return fromEasConfig || fromExpoConfig || "";
}

async function registerPushToken(token: string) {
  if (Platform.OS === "ios") {
    await Notifications.setBadgeCountAsync(0).catch(() => {});
  }

  const projectId = resolveExpoProjectId();

  if (!projectId) {
    throw new Error("Thiếu Expo projectId để lấy push token.");
  }

  const expoToken = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  const pushToken = String(expoToken?.data || "").trim();

  if (!pushToken) {
    throw new Error("Không lấy được Expo push token.");
  }

  const res = await fetch(`${API_BASE_URL}/api/devices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      platform: Platform.OS,
      pushToken,
      role: "DRIVER",
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.message || "Không lưu được push token.");
  }

  return data;
}

export async function refreshPushNotifications(token: string) {
  if (Platform.OS === "web" || !Device.isDevice || !(await Notifications.getPermissionsAsync()).granted) return;
  await prepareNotificationUx();
  await registerPushToken(token);
}

export async function enablePushNotifications(getToken: () => Promise<string | null>) {
  const token = await getToken();
  if (!token) throw new Error("Vui lòng đăng nhập lại.");
  if (!await requestNotificationPermission() || await getToken() !== token) return false;

  await refreshPushNotifications(token);
  return true;
}
