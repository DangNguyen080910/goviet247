// Path: goviet247/apps/rider-mobile/app/_layout.tsx
import { useEffect, useRef, useState } from "react";
import { Tabs, router, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { StatusBar } from "react-native";
import {
  SafeAreaProvider,
  initialWindowMetrics,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { getMe } from "../services/authApi";
import { getRiderToken } from "../services/storage";
import {
  connectRiderSocket,
  disconnectRiderSocket,
} from "../services/riderSocket";
import {
  NotificationProvider,
  useNotifications,
} from "../context/NotificationContext";
import {
  TripActivityProvider,
  useTripActivity,
} from "../context/TripActivityContext";
import {
  configureRiderNotificationHandler,
  configureRiderAudioMode,
  triggerRiderForegroundPushHaptic,
} from "../services/notify";
import GlobalSupportButton from "../components/GlobalSupportButton";
import AppUpdatePrompt from "../components/AppUpdatePrompt";

configureRiderNotificationHandler();

function handlePushNavigation(
  response: Notifications.NotificationResponse | null,
) {
  if (!response) {
    return;
  }

  try {
    const data = response.notification.request.content.data || {};

    const type = String(data?.type || "")
      .trim()
      .toUpperCase();

    console.log("[RiderPush] tapped type =", type);

    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          if (type === "SYSTEM_NOTIFICATION") {
            router.replace("/notifications");
            return;
          }

          if (type === "TRIP_STATUS_CHANGED") {
            const tripId = String(data?.tripId || "").trim();

            if (tripId) {
              router.replace(
                `/trip-history?focusTripId=${encodeURIComponent(tripId)}`,
              );
              return;
            }

            router.replace("/trip-history");
          }
        } catch (error) {
          console.warn("[RiderPush] navigate error:", error);
        }
      }, 1500);
    });
  } catch (error) {
    console.warn("[RiderPush] handle tap error:", error);
  }
}

function TabsNavigator() {
  const { unreadCount: notificationUnreadCount } = useNotifications();

  const insets = useSafeAreaInsets();

  return (
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        lazy: false,
        freezeOnBlur: false,
        tabBarActiveTintColor: "#16A34A",
        tabBarInactiveTintColor: "#737373",
        sceneStyle: {
          backgroundColor: "#F4F7FB",
        },
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 58 + Math.max(insets.bottom, 8),
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopWidth: 1,
          borderTopColor: "#E5E7EB",
          backgroundColor: "#FFFFFF",
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Trang chủ",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="trip-history"
        options={{
          title: "Hoạt động",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "list" : "list-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          title: "Thông báo",
          tabBarBadge:
            notificationUnreadCount > 0 ? notificationUnreadCount : undefined,
          tabBarBadgeStyle: {
            minWidth: 18,
            height: 18,
            borderRadius: 999,
            backgroundColor: "#EF4444",
            color: "#FFFFFF",
            fontSize: 10,
            fontWeight: "700",
            top: 4,
          },
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "notifications" : "notifications-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Tài khoản",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="feedback"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="booking"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="bootstrap"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

function GuestTabsNavigator({ userId }: { userId: string }) {
  return (
    <NotificationProvider userId={userId}>
      <TripActivityProvider userId={userId}>
        <Tabs
          detachInactiveScreens={false}
          screenOptions={{
            headerShown: false,
            lazy: true,
            freezeOnBlur: false,
            sceneStyle: {
              backgroundColor: "#F4F7FB",
            },
            tabBarStyle: {
              display: "none",
            },
          }}
        >
          <Tabs.Screen name="index" options={{ href: null }} />
          <Tabs.Screen name="bootstrap" options={{ href: null }} />
          <Tabs.Screen name="home" options={{ href: null }} />
          <Tabs.Screen name="trip-history" options={{ href: null }} />
          <Tabs.Screen name="notifications" options={{ href: null }} />
          <Tabs.Screen name="profile" options={{ href: null }} />
          <Tabs.Screen name="feedback" options={{ href: null }} />
          <Tabs.Screen name="booking" options={{ href: null }} />
        </Tabs>
      </TripActivityProvider>
    </NotificationProvider>
  );
}

function RootLayoutInner() {
  const pathname = usePathname();
  const connectedUserIdRef = useRef("");
  const [riderUserId, setRiderUserId] = useState("");
  const [ready, setReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      void configureRiderAudioMode();
    }, 2500);
  }, []);

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
        console.warn(
          "[RiderPush] getLastNotificationResponseAsync error:",
          error,
        );
      }
    }

    void checkInitialNotification();

    const receivedSubscription = Notifications.addNotificationReceivedListener(
      async (notification) => {
        try {
          const currentBadge = await Notifications.getBadgeCountAsync();

          await Notifications.setBadgeCountAsync(currentBadge + 1);
        } catch (error) {
          console.warn("[RiderPush] set badge error:", error);
        }

        const data = notification.request.content.data || {};
        const type = String(data?.type || "")
          .trim()
          .toUpperCase();

        void triggerRiderForegroundPushHaptic(type);
      },
    );

    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        handlePushNavigation(response);
      });

    return () => {
      isMounted = false;
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function syncRiderApp() {
      try {
        const token = await getRiderToken();

        try {
          await Notifications.setBadgeCountAsync(0);
        } catch (error) {
          console.warn("[RiderPush] clear badge error:", error);
        }

        if (!token) {
          if (connectedUserIdRef.current) {
            disconnectRiderSocket();
            connectedUserIdRef.current = "";
          }

          if (!isMounted) return;
          setIsAuthenticated(false);
          setRiderUserId("");
          setReady(true);
          return;
        }

        const meData = await getMe(token);
        const userId = String(meData?.user?.id || "").trim();

        if (!userId) {
          if (connectedUserIdRef.current) {
            disconnectRiderSocket();
            connectedUserIdRef.current = "";
          }

          if (!isMounted) return;
          setIsAuthenticated(false);
          setRiderUserId("");
          setReady(true);
          return;
        }

        if (connectedUserIdRef.current !== userId) {
          if (connectedUserIdRef.current) {
            disconnectRiderSocket();
          }

          connectRiderSocket(userId);
          connectedUserIdRef.current = userId;
        }

        if (!isMounted) return;
        setRiderUserId(userId);
        setIsAuthenticated(true);
        setReady(true);
      } catch (error) {
        console.warn("[RiderSocket] sync auth state error:", error);

        if (connectedUserIdRef.current) {
          disconnectRiderSocket();
          connectedUserIdRef.current = "";
        }

        if (!isMounted) return;
        setIsAuthenticated(false);
        setRiderUserId("");
        setReady(true);
      }
    }

    void syncRiderApp();

    return () => {
      isMounted = false;
    };
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (connectedUserIdRef.current) {
        disconnectRiderSocket();
        connectedUserIdRef.current = "";
      }
    };
  }, []);

  if (!ready) {
    return null;
  }

  if (!isAuthenticated || !riderUserId) {
    return <GuestTabsNavigator userId="" />;
  }

  return (
    <NotificationProvider userId={riderUserId}>
      <TripActivityProvider userId={riderUserId}>
        <TabsNavigator />
      </TripActivityProvider>
    </NotificationProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F4F7FB"
        translucent={false}
      />

      <RootLayoutInner />

      <AppUpdatePrompt />

      <GlobalSupportButton />
    </SafeAreaProvider>
  );
}
