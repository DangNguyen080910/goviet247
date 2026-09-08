// Path: goviet247/apps/driver-mobile/app/bootstrap.tsx
import { useEffect, useState } from "react";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import {
  ActivityIndicator,
  Pressable,
  Text,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";
import { getDriverToken, removeDriverToken } from "../services/storage";
import { ApiError, getMe } from "../services/authApi";
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
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
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
        if (!active) return;
        const user = meData?.user;
        if (!user?.id || !user?.role) throw new Error("Invalid account response");

        if (!isDriverRole(user?.role)) {
          await removeDriverToken();
          router.replace("/");
          return;
        }

        const data = await getMyDriverProfile(token);
        if (!active) return;

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
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          await removeDriverToken();
          if (active) router.replace("/");
        } else {
          setFailed(true);
        }
      }
    }

    void run();
    return () => { active = false; };
  }, [attempt]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.center}>
        {failed ? <>
          <Text style={{ textAlign: "center", padding: 24 }}>
            Chưa thể khôi phục đăng nhập. Vui lòng kiểm tra kết nối và thử lại.
          </Text>
          <Pressable accessibilityRole="button"
            style={{ padding: 16, backgroundColor: "#2563EB", borderRadius: 10 }}
            onPress={() => { setFailed(false); setAttempt(value => value + 1); }}>
            <Text style={{ color: "white" }}>Thử lại</Text>
          </Pressable>
        </> : <ActivityIndicator size="large" color="#2563EB" />}
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
