// Path: goviet247/apps/rider-mobile/services/pushRegister.ts
import { requestNotificationPermission } from "../../mobile-chat/permissionHelp";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { API_BASE_URL } from "../constants/api";

function getExpoProjectId() {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    "";

  return String(projectId || "").trim();
}

async function registerPushToken(token: string) {
  const projectId = getExpoProjectId();

  const expoToken = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  const pushToken = expoToken.data;

  const res = await fetch(`${API_BASE_URL}/api/devices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      platform: Platform.OS,
      pushToken,
      role: "RIDER",
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.message || "Không lưu được push token rider.");
  }

  return data;
}

async function preparePushNotifications() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Mặc định",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#F97316",
      sound: "default",
      enableVibrate: true,
      lockscreenVisibility:
        Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
}

export async function refreshPushNotifications(token: string) {
  if (Platform.OS === "web" || !(await Notifications.getPermissionsAsync()).granted) return;
  await preparePushNotifications();
  await registerPushToken(token);
}

export async function enablePushNotifications(getToken: () => Promise<string | null>) {
  const token = await getToken();
  if (!token) throw new Error("Vui lòng đăng nhập lại.");
  if (!await requestNotificationPermission() || await getToken() !== token) return false;

  await refreshPushNotifications(token);
  return true;
}
