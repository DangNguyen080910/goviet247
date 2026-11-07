import {chatNotificationRoute, claimNotificationResponse} from '../../api/src/shared/chatNotificationNavigation.js';
import {TripCallOverlay} from '../../mobile-chat/TripCalls';
import { ChatInboxBadge, isChatVisible, chatPushShouldPlaySound } from "../services/tripChat";
// Path: goviet247/apps/driver-mobile/app/_layout.tsx
import { useEffect } from "react";
import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";
import Toast, { ErrorToast } from "react-native-toast-message";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NotificationProvider } from "../context/NotificationContext";
import { getDriverToken } from "../services/storage";
import AppUpdatePrompt from "../components/AppUpdatePrompt";

Notifications.setNotificationHandler({
  handleNotification: async notification => {
    if (isChatVisible(notification.request.content.data)) return { shouldShowBanner:false,shouldShowList:false,shouldPlaySound:await chatPushShouldPlaySound(notification.request.content.data),shouldSetBadge:false };
    const signedIn = Boolean(await getDriverToken());
    return { shouldShowBanner: signedIn, shouldShowList: signedIn, shouldPlaySound: signedIn && await chatPushShouldPlaySound(notification.request.content.data), shouldSetBadge: signedIn };
  },
});

async function handlePushNavigation(
  response: Notifications.NotificationResponse | null,
) {
  if (!response) {
    return;
  }

  if (!(await getDriverToken()) || !claimNotificationResponse(response)) return;

  const data = response.notification.request.content.data || {};
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  const type = String(data?.type || "")
    .trim()
    .toUpperCase();

  const chatRoute = chatNotificationRoute(data);
          if (chatRoute) { router.push(chatRoute as any); return; }

  if (type === "NEW_TRIP") {
    router.replace("/bootstrap");
    return;
  }

  if (type === "SYSTEM_NOTIFICATION") {
    router.push({pathname: "/dashboard", params: {notificationId: String(data.notificationId || ""), openNotifications: "1", focusRequest: `${response.notification.request.identifier}_${Date.now()}`}});
    return;
  }
}

export default function RootLayout() {
  useEffect(() => {
    let isMounted = true;

    async function checkInitialNotification() {
      try {
        const lastResponse =
          await Notifications.getLastNotificationResponseAsync();

        if (isMounted && lastResponse) {
          handlePushNavigation(lastResponse);
        }
      } catch (error) {
        console.warn("[Push] getLastNotificationResponseAsync error:", error);
      }
    }

    checkInitialNotification();

    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        handlePushNavigation(response);
      });

    return () => {
      isMounted = false;
      responseSubscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <NotificationProvider>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
        <Toast config={{ tripAcceptError: props => <ErrorToast {...props} text2NumberOfLines={4}
          style={{ height: "auto", minHeight: 78, maxWidth: "95%" }}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10 }}
          text1Style={{ fontSize: 14 }} text2Style={{ fontSize: 13, lineHeight: 18, color: "#374151" }} /> }} />
        <ChatInboxBadge />
        <TripCallOverlay />
        <AppUpdatePrompt />
      </NotificationProvider>
    </SafeAreaProvider>
  );
}
