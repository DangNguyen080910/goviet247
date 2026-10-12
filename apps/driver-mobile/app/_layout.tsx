// Path: goviet247/apps/driver-mobile/app/_layout.tsx
import { useEffect } from "react";
import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";
import Toast from "react-native-toast-message";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NotificationProvider } from "../context/NotificationContext";
import { getDriverToken } from "../services/storage";
import AppUpdatePrompt from "../components/AppUpdatePrompt";

Notifications.setNotificationHandler({
  handleNotification: async () => {
    const signedIn = Boolean(await getDriverToken());
    return { shouldShowBanner: signedIn, shouldShowList: signedIn, shouldPlaySound: signedIn, shouldSetBadge: signedIn };
  },
});

async function handlePushNavigation(
  response: Notifications.NotificationResponse | null,
) {
  if (!response) {
    return;
  }

  if (!(await getDriverToken())) return;

  const data = response.notification.request.content.data || {};
  const type = String(data?.type || "")
    .trim()
    .toUpperCase();

  if (type === "NEW_TRIP") {
    router.replace("/bootstrap");
    return;
  }

  if (type === "SYSTEM_NOTIFICATION") {
    router.replace("/bootstrap");
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
        <Toast />
        <AppUpdatePrompt />
      </NotificationProvider>
    </SafeAreaProvider>
  );
}
