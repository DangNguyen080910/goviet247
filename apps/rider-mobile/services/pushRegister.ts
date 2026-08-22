// Path: goviet247/apps/rider-mobile/services/pushRegister.ts
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

export async function registerPushToken(token: string) {
  console.log("[RiderPush] registerPushToken start, platform =", Platform.OS);

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

    console.log("[RiderPush] Android notification channel ready: default");
  }

  const projectId = getExpoProjectId();

  console.log("[RiderPush] Expo projectId =", projectId || "(empty)");

  const expoToken = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  const pushToken = expoToken.data;

  console.log("[RiderPush] expo push token =", pushToken);

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

  console.log("[RiderPush] /api/devices response =", res.status, data);

  if (!res.ok) {
    throw new Error(data?.message || "Không lưu được push token rider.");
  }

  return data;
}