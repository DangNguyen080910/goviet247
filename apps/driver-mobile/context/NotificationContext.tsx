// Path: goviet247/apps/driver-mobile/context/NotificationContext.tsx
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  fetchDriverNotifications,
  markAllDriverNotificationsAsRead,
  type DriverNotificationItem,
} from "../services/notificationApi";

type NotificationItem = DriverNotificationItem;

type NotificationContextValue = {
  items: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markAllAsRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(
  null,
);

type NotificationProviderProps = {
  children: ReactNode;
};

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const data = await fetchDriverNotifications();

      const nextUnread = Number(data.unreadCount || 0);

      setItems(data.items);
      setUnreadCount(nextUnread);

      // 🔴 SYNC BADGE ICON
      try {
        if (Platform.OS === "ios" || Platform.OS === "android") {
          await Notifications.setBadgeCountAsync(nextUnread);
        }
      } catch (err) {
        console.warn("[Notification] set badge error:", err);
      }
    } catch (err: any) {
      const message = String(err?.message || "").toLowerCase();

      if (message.includes("thiếu token")) {
        console.log(
          "[NotificationContext] bỏ qua load notifications vì chưa có token tài xế",
        );
        setItems([]);
        setUnreadCount(0);
        return;
      }

      console.error("load notifications error", err);
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    void load();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (!isMounted) return;

      if (nextState === "active") {
        void load();
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [load]);

  const markAllAsRead = useCallback(async () => {
    try {
      await markAllDriverNotificationsAsRead();

      setItems((current) =>
        current.map((item) => ({
          ...item,
          isRead: true,
          readAt: item.readAt || new Date().toISOString(),
        })),
      );
      setUnreadCount(0);

      // 🔴 CLEAR BADGE ICON
      try {
        if (Platform.OS === "ios" || Platform.OS === "android") {
          await Notifications.setBadgeCountAsync(0);
        }
      } catch (err) {
        console.warn("[Notification] clear badge error:", err);
      }
    } catch (err) {
      console.error("markAllAsRead notifications error", err);
      throw err;
    }
  }, []);

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      loading,
      refresh: load,
      markAllAsRead,
    }),
    [items, unreadCount, loading, load, markAllAsRead],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);

  if (!ctx) {
    throw new Error("useNotifications must be inside NotificationProvider");
  }

  return ctx;
}
