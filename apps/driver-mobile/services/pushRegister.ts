// Path: goviet247/apps/driver-mobile/services/pushRegister.ts
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { API_BASE_URL } from "../constants/api";

function resolveExpoProjectId() {
  const fromEasConfig = String(Constants?.easConfig?.projectId || "").trim();
  const fromExpoConfig = String(
    Constants?.expoConfig?.extra?.eas?.projectId || "",
  ).trim();

  return fromEasConfig || fromExpoConfig || "";
}

export async function registerPushToken(token: string) {
  console.log("[Push] registerPushToken start, platform =", Platform.OS);

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

    console.log("[Push] Android notification channel ready: default");
  }

  if (Platform.OS === "ios") {
    await Notifications.setBadgeCountAsync(0).catch(() => {});
  }

  const permission = await Notifications.getPermissionsAsync();
  console.log("[Push] notification permission =", permission);

  const projectId = resolveExpoProjectId();

  console.log("[Push] resolved Expo projectId =", projectId);

  if (!projectId) {
    throw new Error("Thiếu Expo projectId để lấy push token.");
  }

  console.log("[Push] getting expo push token...");

  const expoToken = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  console.log("[Push] raw expoToken =", expoToken);

  const pushToken = String(expoToken?.data || "").trim();

  console.log("[Push] expo push token =", pushToken);

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

  console.log("[Push] /api/devices response =", res.status, data);

  if (!res.ok) {
    throw new Error(data?.message || "Không lưu được push token.");
  }

  return data;
}