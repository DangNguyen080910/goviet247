// Path: goviet247/apps/rider-mobile/app/bootstrap.tsx
import { useEffect } from "react";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getMe } from "../services/authApi";
import { getRiderToken, removeRiderToken } from "../services/storage";
import { registerPushToken } from "../services/pushRegister";
import { configureRiderAudioMode } from "../services/notify";

export default function BootstrapScreen() {
  useEffect(() => {
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

        const meData = await getMe(token);
        const user = meData?.user;

        console.log("[Rider bootstrap] user =", user);

        if (!user?.id) {
          await removeRiderToken();
          alert("Không thể khôi phục phiên đăng nhập Rider.");
          router.replace("/");
          return;
        }

        router.replace("/home");
      } catch (error) {
        console.error("Rider bootstrap error:", error);
        await removeRiderToken();
        alert("Không thể khôi phục phiên đăng nhập Rider.");
        router.replace("/");
      }
    }

    run();
  }, []);

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
