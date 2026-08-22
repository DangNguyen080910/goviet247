// Path: goviet247/apps/rider-mobile/services/notify.ts
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";

export function configureRiderNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export async function configureRiderAudioMode() {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    await Notifications.setNotificationChannelAsync("default", {
      name: "Thông báo khách hàng",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      enableVibrate: true,
      vibrationPattern: [0, 250, 180, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    await Notifications.setNotificationChannelAsync("trip_updates", {
      name: "Cập nhật chuyến đi",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      enableVibrate: true,
      vibrationPattern: [0, 300, 180, 300],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    await Notifications.setNotificationChannelAsync("system_notifications", {
      name: "Thông báo hệ thống",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      enableVibrate: true,
      vibrationPattern: [0, 220, 140, 220],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch (error) {
    console.warn("[RiderPush] configure audio mode error:", error);
  }
}

export async function triggerRiderForegroundPushHaptic(type: string) {
  try {
    if (type === "TRIP_STATUS_CHANGED") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    if (type === "SYSTEM_NOTIFICATION") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (error) {
    console.warn("[RiderPush] foreground haptic error:", error);
  }
}
