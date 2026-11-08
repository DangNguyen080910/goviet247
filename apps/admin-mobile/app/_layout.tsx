import {claimNotificationResponse} from '../../api/src/shared/chatNotificationNavigation.js';
import { ChatInboxBadge, isChatVisible, chatPushShouldPlaySound } from "../services/tripChat";
import { Alert, AppState } from "react-native";
import TripMilestoneCelebration from "../components/TripMilestoneCelebration";
// Path: goviet247/apps/admin-mobile/app/_layout.tsx
import { useEffect } from "react";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { AdminRealtimeBadgeProvider } from "../context/AdminRealtimeBadgeContext";
import "react-native-reanimated";
import {
  playAdminUrgentNotify,
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
import { getAdminNotificationResponseRoute } from "../services/adminNotificationNavigation";

Notifications.setNotificationHandler({
  handleNotification: async notification => ({
    shouldShowBanner:!isChatVisible(notification.request.content.data),shouldShowList:!isChatVisible(notification.request.content.data),shouldPlaySound:await chatPushShouldPlaySound(notification.request.content.data),shouldSetBadge:true,
  }),
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
          Notifications.setBadgeCountAsync(1).catch(() => {});
        };

        const handleDashboardChanged = (payload?: any) => {
          if (payload?.source === 'chat_contact_alert') {
            void playAdminUrgentNotify();
            if (AppState.currentState === 'active') Alert.alert('Đã chặn gửi số điện thoại', 'Có thành viên thử gửi số điện thoại trong hội thoại chuyến. Mở Cảnh báo để kiểm tra.', [{text:'Để sau',style:'cancel'},{text:'Xem cảnh báo',onPress:()=>router.push('/alerts')}]);
          }

          Notifications.setBadgeCountAsync(1).catch(() => {});
        };

        const handleTripAccepted = () => {
          Notifications.setBadgeCountAsync(1).catch(() => {});
        };

        const handleTripStatusChanged = () => {
          Notifications.setBadgeCountAsync(1).catch(() => {});
        };

        const handleTripCancelled = () => {
          Notifications.setBadgeCountAsync(1).catch(() => {});
        };

        const handleBlockedAttempt = (payload?: any) => {
          void playAdminUrgentNotify();
          if (AppState.currentState === "active") {
            Alert.alert("Tài xế bị khoá vừa bấm nhận chuyến",
              `${payload?.driverName || "Tài xế"} vừa bấm nhận chuyến #${String(payload?.tripId || "").slice(-8).toUpperCase()}. Chuyến chưa được giao cho tài xế này.`,
              [{ text: "Để sau", style: "cancel" }, { text: "Xem cảnh báo", onPress: () => router.push("/alerts") },
                ...(payload?.driverProfileId ? [{ text: "Mở tài xế", onPress: () => router.push({ pathname: "/drivers", params: { driverProfileId: payload.driverProfileId } }) }] : [])]);
          }
        };
        onAdminRealtimeEvent("admin:blocked_trip_accept_attempt", handleBlockedAttempt);
        onAdminRealtimeEvent("admin:new_trip", handleNewTrip);
        onAdminRealtimeEvent("admin:dashboard_changed", handleDashboardChanged);
        onAdminRealtimeEvent("admin:trip_accepted", handleTripAccepted);
        onAdminRealtimeEvent(
          "admin:trip_status_changed",
          handleTripStatusChanged,
        );
        onAdminRealtimeEvent("admin:trip_cancelled", handleTripCancelled);

        return () => {
          offAdminRealtimeEvent("admin:blocked_trip_accept_attempt", handleBlockedAttempt);
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

    void Notifications.getLastNotificationResponseAsync().then(response => {
      if (!claimNotificationResponse(response)) return;
      void Notifications.clearLastNotificationResponseAsync().catch(() => {});
      router.push(getAdminNotificationResponseRoute(response) as any);
    }).catch(() => {});

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        if (!claimNotificationResponse(response)) return;
        Notifications.setBadgeCountAsync(0).catch(() => {});
        Notifications.clearLastNotificationResponseAsync().catch(() => {});
        router.push(getAdminNotificationResponseRoute(response) as any);
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
        <Stack.Screen name="ledger" />
        <Stack.Screen name="commission" />
        <Stack.Screen name="feedback" />
        <Stack.Screen name="alerts" />
      </Stack>

      <StatusBar style="dark" />
      <ChatInboxBadge />
      <AppUpdatePrompt />
      <TripMilestoneCelebration />
    </SafeAreaProvider>
  );
}
