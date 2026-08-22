// Path: goviet247/apps/driver-mobile/app/bootstrap.tsx
import { useEffect } from "react";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";
import { getDriverToken, removeDriverToken } from "../services/storage";
import { getMe } from "../services/authApi";
import { getMyDriverProfile } from "../services/driverProfileApi";
import { registerPushToken } from "../services/pushRegister";
import { prepareNotificationUx } from "../services/notify";
import * as Device from "expo-device";

function isDriverRole(role: string | null | undefined) {
  const normalized = String(role || "")
    .trim()
    .toUpperCase();
  return normalized === "DRIVER";
}

export default function BootstrapScreen() {
  useEffect(() => {
    async function run() {
      try {
        const token = await getDriverToken();

        if (!token) {
          router.replace("/");
          return;
        }

        await prepareNotificationUx().catch((err) => {
          console.warn("[Push] prepare notification ux error:", err);
        });

        const currentPermission = await Notifications.getPermissionsAsync();

        let finalStatus = currentPermission.status;

        if (finalStatus !== "granted") {
          const requestedPermission =
            await Notifications.requestPermissionsAsync({
              ios: {
                allowAlert: true,
                allowBadge: true,
                allowSound: true,
              },
            });

          finalStatus = requestedPermission.status;
        }

        console.log("[Push] final permission status =", finalStatus);

        if (finalStatus === "granted") {
          try {
            if (Device.isDevice) {
              await registerPushToken(token);
            } else {
              console.log("[Push] skip simulator push token");
            }
          } catch (err) {
            console.warn("[Push] register token error:", err);
          }
        }

        const meData = await getMe(token);
        const user = meData?.user;

        if (!isDriverRole(user?.role)) {
          await removeDriverToken();
          router.replace("/");
          return;
        }

        const data = await getMyDriverProfile(token);

        if (!data?.hasDriverProfile) {
          router.replace("/driver-profile/create");
          return;
        }

        const status = data?.profile?.status;

        if (status === "PENDING") {
          router.replace("/driver-profile/pending");
          return;
        }

        if (status === "VERIFIED") {
          router.replace("/dashboard");
          return;
        }

        if (status === "REJECTED") {
          router.replace("/driver-profile/rejected");
          return;
        }

        if (status === "SUSPENDED") {
          router.replace("/driver-profile/suspended");
          return;
        }

        router.replace("/dashboard");
      } catch (error) {
        console.error("Bootstrap error:", error);
        await removeDriverToken();
        router.replace("/");
      }
    }

    run();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
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
