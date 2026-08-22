// Path: goviet247/apps/admin-mobile/app/_layout.tsx
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { AdminRealtimeBadgeProvider } from "../context/AdminRealtimeBadgeContext";
import "react-native-reanimated";
import {
  playAdminNormalNotify,
  playAdminUrgentNotify,
  showAdminLocalNotification,
  unloadAdminNotify,
  warmupAdminNotify,
} from "../services/adminNotify";
import { registerAdminPushToken } from "../services/adminDeviceApi";
import {
  connectAdminSocket,
  offAdminRealtimeEvent,
  onAdminRealtimeEvent,
} from "../services/adminSocket";
import AppUpdatePrompt from "../components/AppUpdatePrompt";

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

export default function RootLayout() {
  return (
    <AdminRealtimeBadgeProvider>
      <RootLayoutContent />
    </AdminRealtimeBadgeProvider>
  );
}

function RootLayoutContent() {
  useEffect(() => {
    let stopped = false;
    let retryTimer: ReturnType<typeof setInterval> | null = null;

    const setupAdminRealtime = async () => {
      try {
        await warmupAdminNotify();

        await registerAdminPushToken().catch((error) => {
          console.log("[RootLayout] register admin push token error:", error);
        });

        const socket = await connectAdminSocket();

        if (!socket || stopped) {
          return;
        }

        console.log("[RootLayout] Admin socket setup done.");

        const handleNewTrip = () => {
          playAdminUrgentNotify();

          Notifications.setBadgeCountAsync(1).catch(() => {});

          showAdminLocalNotification({
            title: "Có chuyến mới",
            body: "Có chuyến mới đang chờ admin xử lý.",
          });
        };

        const handleDashboardChanged = () => {
          playAdminNormalNotify();

          Notifications.setBadgeCountAsync(1).catch(() => {});
        };

        const handleTripAccepted = () => {
          playAdminUrgentNotify();

          Notifications.setBadgeCountAsync(1).catch(() => {});

          showAdminLocalNotification({
            title: "Tài xế đã nhận chuyến",
            body: "Một chuyến vừa được tài xế nhận.",
          });
        };

        const handleTripStatusChanged = () => {
          playAdminNormalNotify();

          Notifications.setBadgeCountAsync(1).catch(() => {});
        };

        const handleTripCancelled = () => {
          playAdminUrgentNotify();

          Notifications.setBadgeCountAsync(1).catch(() => {});

          showAdminLocalNotification({
            title: "Chuyến bị huỷ",
            body: "Một chuyến vừa được huỷ, vui lòng kiểm tra.",
          });
        };

        onAdminRealtimeEvent("admin:new_trip", handleNewTrip);
        onAdminRealtimeEvent("admin:dashboard_changed", handleDashboardChanged);
        onAdminRealtimeEvent("admin:trip_accepted", handleTripAccepted);
        onAdminRealtimeEvent(
          "admin:trip_status_changed",
          handleTripStatusChanged,
        );
        onAdminRealtimeEvent("admin:trip_cancelled", handleTripCancelled);

        return () => {
          offAdminRealtimeEvent("admin:new_trip", handleNewTrip);
          offAdminRealtimeEvent(
            "admin:dashboard_changed",
            handleDashboardChanged,
          );
          offAdminRealtimeEvent("admin:trip_accepted", handleTripAccepted);
          offAdminRealtimeEvent(
            "admin:trip_status_changed",
            handleTripStatusChanged,
          );
          offAdminRealtimeEvent("admin:trip_cancelled", handleTripCancelled);
        };
      } catch (error) {
        console.log("[RootLayout] setup admin realtime error:", error);
        return undefined;
      }
    };

    let cleanupRealtime: (() => void) | undefined;

    setupAdminRealtime().then((cleanup) => {
      cleanupRealtime = cleanup;
    });

    retryTimer = setInterval(() => {
      if (stopped || cleanupRealtime) {
        return;
      }

      setupAdminRealtime().then((cleanup) => {
        cleanupRealtime = cleanup;
      });
    }, 3000);

    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      Notifications.setBadgeCountAsync(0).catch(() => {});
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      () => {
        Notifications.setBadgeCountAsync(0).catch(() => {});
      },
    );

    return () => {
      stopped = true;

      if (retryTimer) {
        clearInterval(retryTimer);
      }

      cleanupRealtime?.();
      receivedSub.remove();
      responseSub.remove();
      unloadAdminNotify();
    };
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: "#f7f8fa",
          },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="home" />
        <Stack.Screen name="pending-trips" />
        <Stack.Screen name="unassigned-trips" />
        <Stack.Screen name="assigned-trips" />
        <Stack.Screen name="drivers" />
        <Stack.Screen name="customers" />
        <Stack.Screen name="wallets" />
        <Stack.Screen name="feedback" />
      </Stack>

      <StatusBar style="dark" />
      <AppUpdatePrompt />
    </SafeAreaProvider>
  );
}
