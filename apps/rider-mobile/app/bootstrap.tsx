// Path: goviet247/apps/rider-mobile/app/bootstrap.tsx
import { useEffect, useState } from "react";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, getMe } from "../services/authApi";
import { getRiderToken, removeRiderToken } from "../services/storage";
import { registerPushToken } from "../services/pushRegister";
import { configureRiderAudioMode } from "../services/notify";

export default function BootstrapScreen() {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    async function run() {
      try {
        await configureRiderAudioMode();

        const token = await getRiderToken();

        if (!token) {
          router.replace("/");
          return;
        }

        const existingPermission = await Notifications.getPermissionsAsync();
        console.log("[RiderPush] existing permission =", existingPermission);

        let finalStatus = existingPermission.status;

        if (finalStatus !== "granted") {
          const requestedPermission =
            await Notifications.requestPermissionsAsync({
              ios: {
                allowAlert: true,
                allowBadge: true,
                allowSound: true,
              },
            });

          console.log(
            "[RiderPush] requested permission =",
            requestedPermission,
          );

          finalStatus = requestedPermission.status;
        }

        console.log("[RiderPush] final permission status =", finalStatus);

        if (finalStatus === "granted") {
          try {
            await registerPushToken(token);
          } catch (err) {
            console.warn("[RiderPush] register token error:", err);
          }
        } else {
          console.warn("[RiderPush] notification permission not granted");
        }

        let meData;
        try {
          meData = await getMe(token);
        } catch (error) {
          // Only an authentication rejection can invalidate the stored token.
          if (active && error instanceof ApiError && error.status === 401) {
            await removeRiderToken();
            if (active) router.replace("/");
            return;
          }
          throw error;
        }
        if (!active) return;
        const user = meData?.user;

        console.log("[Rider bootstrap] user =", user);

        if (!user?.id) {
          throw new Error("Missing user in account response");
        }

        router.replace("/home");
      } catch (error) {
        console.error("Rider bootstrap error:", error);
        if (active) setFailed(true);
      }
    }

    void run();
    return () => { active = false; };
  }, [attempt]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.center}>
        {failed ? (
          <>
            <Text style={styles.message}>
              Chưa thể kết nối để khôi phục đăng nhập. Vui lòng thử lại sau ít phút.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.retry}
              onPress={() => {
                setFailed(false);
                setAttempt((value) => value + 1);
              }}
            >
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </>
        ) : <ActivityIndicator size="large" color="#2563EB" />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  message: { textAlign: "center", color: "#334155", marginBottom: 16, paddingHorizontal: 24 },
  retry: { backgroundColor: "#2563EB", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: "#fff", fontWeight: "600" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
