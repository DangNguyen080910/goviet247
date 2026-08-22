// Path: goviet247/apps/admin-mobile/services/adminNotify.ts
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Platform, Vibration } from "react-native";

let lastPlayAt = 0;
const DEFAULT_COOLDOWN_MS = 1800;

function shouldSkipByCooldown(cooldownMs = DEFAULT_COOLDOWN_MS) {
  const now = Date.now();

  if (now - lastPlayAt < cooldownMs) {
    return true;
  }

  lastPlayAt = now;
  return false;
}

async function vibrateStrong() {
  try {
    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.([250, 160, 250]);
      }
      return;
    }

    Vibration.vibrate([0, 250, 160, 250]);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, 220);
  } catch (error) {
    console.warn("[adminNotify] vibrateStrong error:", error);
  }
}

async function vibrateMedium() {
  try {
    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.([180, 120, 180]);
      }
      return;
    }

    Vibration.vibrate([0, 180, 120, 180]);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch (error) {
    console.warn("[adminNotify] vibrateMedium error:", error);
  }
}

export async function warmupAdminNotify() {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () =>
        ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }) as any,
    });

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("admin_default_alerts", {
        name: "Thông báo Admin",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        enableVibrate: true,
        vibrationPattern: [0, 300, 180, 300],
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
  } catch (error) {
    console.warn("[adminNotify] warmup error:", error);
  }
}

export async function playAdminUrgentNotify() {
  if (shouldSkipByCooldown(1800)) {
    return;
  }

  await vibrateStrong();
}

export async function playAdminNormalNotify() {
  if (shouldSkipByCooldown(1800)) {
    return;
  }

  await vibrateMedium();
}

export async function showAdminLocalNotification({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  try {
    if (Platform.OS === "web") return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
      },
      trigger: null,
    });
  } catch (error) {
    console.warn("[adminNotify] showAdminLocalNotification error:", error);
  }
}

export async function unloadAdminNotify() {
  return;
}
