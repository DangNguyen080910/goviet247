// Path: oviet247/apps/rider-mobile/context/NotificationContext.tsx
import { AppState } from "react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getSystemNotifications,
  type RiderSystemNotificationItem,
} from "../services/notificationApi";
import { onRiderSocketEvent } from "../services/riderSocket";
import {
  getRiderNotificationReadIds,
  getRiderNotificationUserId,
  saveRiderNotificationReadIds,
  setRiderNotificationUserId,
} from "../services/storage";

type NotificationContextValue = {
  items: RiderSystemNotificationItem[];
  unreadCount: number;
  loading: boolean;
  refreshing: boolean;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  markAllAsRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(
  null,
);

type NotificationProviderProps = {
  children: ReactNode;
  userId: string;
};

export function NotificationProvider({
  children,
  userId,
}: NotificationProviderProps) {
  const normalizedUserId = String(userId || "").trim();

  const [items, setItems] = useState<RiderSystemNotificationItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReadState = useCallback(async () => {
    if (!normalizedUserId) {
      setReadIds([]);
      return;
    }

    try {
      await setRiderNotificationUserId(normalizedUserId);
      const savedIds = await getRiderNotificationReadIds(normalizedUserId);
      setReadIds(Array.isArray(savedIds) ? savedIds : []);
    } catch (error) {
      console.error("load rider notification read state error:", error);
      setReadIds([]);
    }
  }, [normalizedUserId]);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);

    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const nextItems = await getSystemNotifications("RIDER", normalizedUserId);
      setItems(Array.isArray(nextItems) ? nextItems : []);
    } catch (error) {
      console.error("refresh rider notifications error:", error);

      if (!silent) {
        setItems([]);
      }
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadReadState();
    void refresh({ silent: false });
  }, [loadReadState, refresh]);

  useEffect(() => {
    const offNotificationChanged = onRiderSocketEvent(
      "rider:notification_changed",
      () => {
        void refresh({ silent: true });
      },
    );

    return () => {
      offNotificationChanged?.();
    };
  }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void refresh({ silent: true });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refresh]);

  const markAllAsRead = useCallback(async () => {
    if (!normalizedUserId) return;

    const nextReadIds = items
      .map((item) => String(item.id || "").trim())
      .filter(Boolean);

    try {
      await saveRiderNotificationReadIds(normalizedUserId, nextReadIds);
      setReadIds(nextReadIds);
    } catch (error) {
      console.error("mark rider notifications read error:", error);
      throw error;
    }
  }, [items, normalizedUserId]);

  const unreadCount = useMemo(() => {
    const readIdSet = new Set(readIds);

    return items.reduce((count, item) => {
      const id = String(item.id || "").trim();
      if (!id) return count;
      return readIdSet.has(id) ? count : count + 1;
    }, 0);
  }, [items, readIds]);

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      loading,
      refreshing,
      refresh,
      markAllAsRead,
    }),
    [items, unreadCount, loading, refreshing, refresh, markAllAsRead],
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
