// Path: goviet247/apps/admin-mobile/services/adminDeviceApi.ts
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { adminRequest } from "./adminRequest";
import { getAdminToken, getAdminUser } from "./storage";

function getExpoProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    ""
  );
}

export async function registerAdminPushToken() {
  if (!Device.isDevice) {
    console.log(
      "[adminDeviceApi] Push token chỉ hoạt động chuẩn trên máy thật.",
    );
    return null;
  }

  const token = await getAdminToken();
  const adminUser = await getAdminUser();

  if (!token || !adminUser?.id) {
    return null;
  }

  const permission = await Notifications.getPermissionsAsync();

  let finalStatus = permission.status;

  if (finalStatus !== "granted") {
    const request = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    finalStatus = request.status;
  }

  if (finalStatus !== "granted") {
    console.log("[adminDeviceApi] Chưa được cấp quyền notification.");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("admin_default_alerts", {
      name: "Thông báo quản trị",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  const projectId = getExpoProjectId();

  if (!projectId) {
    console.log("[adminDeviceApi] Thiếu EAS projectId.");
    return null;
  }

  const expoToken = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  const pushToken = expoToken.data;

  await adminRequest("/api/devices", {
    method: "POST",
    body: JSON.stringify({
      platform: Platform.OS,
      pushToken,
      role: String(adminUser.role || "ADMIN").toUpperCase(),
    }),
  });

  console.log("[adminDeviceApi] Đã đăng ký push token admin:", pushToken);

  return pushToken;
}
