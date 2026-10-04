// Path: goviet247/apps/driver-mobile/services/notify.ts
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import { Platform } from "react-native";

/**
 * Helper phát âm thanh + rung cho driver app
 * Chuẩn bị sẵn cho iOS:
 * - playsInSilentModeIOS để dễ nghe hơn khi test máy thật
 * - duck/mix audio an toàn hơn
 * - foreground haptic rõ hơn
 */

let audioModePrepared = false;
let newTripRingtone: Audio.Sound | null = null;
let newTripRingtonePromise: Promise<void> | null = null;
let newTripRingtoneGeneration = 0;

async function ensureAudioMode() {
  if (audioModePrepared) {
    return;
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });

  audioModePrepared = true;
}

async function playSoundOnce(source: number) {
  let sound: Audio.Sound | null = null;

  try {
    await ensureAudioMode();

    const result = await Audio.Sound.createAsync(
      source,
      {
        shouldPlay: true,
        volume: 1,
        progressUpdateIntervalMillis: 150,
      },
      undefined,
      false,
    );

    sound = result.sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) {
        return;
      }

      if (status.didJustFinish) {
        sound
          ?.unloadAsync()
          .catch(() => {})
          .finally(() => {
            sound = null;
          });
      }
    });
  } catch (err) {
    if (sound) {
      await sound.unloadAsync().catch(() => {});
      sound = null;
    }
    throw err;
  }
}

async function pulseNewTripHaptics() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, 180);

    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }, 420);
  } catch (err) {
    console.warn("[notify] pulseNewTripHaptics error:", err);
  }
}

async function pulseTripChangedHaptics() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }, 160);
  } catch (err) {
    console.warn("[notify] pulseTripChangedHaptics error:", err);
  }
}

export async function startNewTripRingtone() {
  if (newTripRingtone || newTripRingtonePromise) return;

  const generation = newTripRingtoneGeneration;
  const startPromise = (async () => {
    let sound: Audio.Sound | null = null;
    try {
      await ensureAudioMode();
      const result = await Audio.Sound.createAsync(
        require("../assets/sounds/new-trip.mp3"),
        { shouldPlay: true, isLooping: true, volume: 1 },
      );
      sound = result.sound;

      if (generation !== newTripRingtoneGeneration) {
        await sound.unloadAsync().catch(() => {});
        return;
      }

      newTripRingtone = sound;
      await pulseNewTripHaptics();
    } catch (err) {
      if (sound) await sound.unloadAsync().catch(() => {});
      console.warn("[notify] new trip ringtone error:", err);
    }
  })();

  newTripRingtonePromise = startPromise;
  try {
    await startPromise;
  } finally {
    if (newTripRingtonePromise === startPromise) {
      newTripRingtonePromise = null;
    }
  }
}

export async function stopNewTripRingtone() {
  newTripRingtoneGeneration += 1;
  newTripRingtonePromise = null;
  const sound = newTripRingtone;
  newTripRingtone = null;
  if (sound) {
    await sound.stopAsync().catch(() => {});
    await sound.unloadAsync().catch(() => {});
  }
}

export async function playTripChangedNotify() {
  try {
    await playSoundOnce(require("../assets/sounds/trip-update.mp3"));
    await pulseTripChangedHaptics();
  } catch (err) {
    console.warn("[notify] trip changed sound error:", err);
  }
}

export async function prepareNotificationUx() {
  try {
    await ensureAudioMode();

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Thông báo tài xế",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        enableVibrate: true,
        vibrationPattern: [0, 300, 180, 300],
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      await Notifications.setNotificationChannelAsync("new_trip", {
        name: "Có chuyến mới",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        enableVibrate: true,
        vibrationPattern: [0, 400, 200, 400],
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      await Notifications.setNotificationChannelAsync("trip_updates", {
        name: "Cập nhật chuyến đi",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
        enableVibrate: true,
        vibrationPattern: [0, 250, 150, 250],
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    if (Platform.OS === "ios") {
      await Haptics.selectionAsync().catch(() => {});
    }
  } catch (err) {
    console.warn("[notify] prepareNotificationUx error:", err);
  }
}
