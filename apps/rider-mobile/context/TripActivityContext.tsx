// Path: goviet247/apps/rider-mobile/context/TripActivityContext.tsx
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
import { getMyTrips } from "../services/tripApi";
import { onRiderSocketEvent } from "../services/riderSocket";
import {
  getRiderTripActivitySeenAt,
  saveRiderTripActivitySeenAt,
} from "../services/storage";

type TripItem = {
  id: string;
  status: string;
  isVerified?: boolean;
  verifiedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type TripActivityContextValue = {
  unreadCount: number;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  markAllAsSeen: () => Promise<void>;
};

const TripActivityContext = createContext<TripActivityContextValue | null>(
  null,
);

function getActivityTime(item: TripItem) {
  const value = item?.updatedAt || item?.verifiedAt || item?.createdAt || null;

  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isTrackableTripActivity(item: TripItem) {
  const status = String(item?.status || "")
    .trim()
    .toUpperCase();

  if (status === "PENDING" && (item?.isVerified || item?.verifiedAt)) {
    return true;
  }

  return [
    "ACCEPTED",
    "CONTACTED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
  ].includes(status);
}

type TripActivityProviderProps = {
  children: ReactNode;
  userId: string;
};

export function TripActivityProvider({
  children,
  userId,
}: TripActivityProviderProps) {
  const normalizedUserId = String(userId || "").trim();

  const [items, setItems] = useState<TripItem[]>([]);
  const [seenAt, setSeenAt] = useState(0);

  const refresh = useCallback(
    async (_options?: { silent?: boolean }) => {
      if (!normalizedUserId) {
        setItems([]);
        return;
      }

      try {
        const trips = await getMyTrips();
        setItems(Array.isArray(trips) ? trips : []);
      } catch (error) {
        if (__DEV__) {
          console.warn("refresh trip activity error:", error);
        }
      }
    },
    [normalizedUserId],
  );

  useEffect(() => {
    let alive = true;

    async function loadSeenAt() {
      try {
        if (!normalizedUserId) {
          if (alive) {
            setSeenAt(0);
          }
          return;
        }

        const raw = await getRiderTripActivitySeenAt(normalizedUserId);
        const value = raw ? new Date(raw).getTime() : 0;

        if (!alive) return;
        setSeenAt(Number.isFinite(value) ? value : 0);
      } catch (error) {
        if (__DEV__) {
          console.warn("load trip activity seenAt error:", error);
        }

        if (alive) {
          setSeenAt(0);
        }
      }
    }

    void loadSeenAt();

    return () => {
      alive = false;
    };
  }, [normalizedUserId]);

  useEffect(() => {
    if (!normalizedUserId) {
      setItems([]);
      return;
    }

    void refresh();
  }, [normalizedUserId, refresh]);

  useEffect(() => {
    const offTripChanged = onRiderSocketEvent("rider:trip_changed", () => {
      void refresh({ silent: true });
    });

    return () => {
      offTripChanged?.();
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

  const unreadCount = useMemo(() => {
    return items.reduce((count, item) => {
      if (!isTrackableTripActivity(item)) {
        return count;
      }

      const activityTime = getActivityTime(item);

      if (!activityTime || activityTime <= seenAt) {
        return count;
      }

      return count + 1;
    }, 0);
  }, [items, seenAt]);

  const markAllAsSeen = useCallback(async () => {
    if (!normalizedUserId) return;

    const nowIso = new Date().toISOString();

    try {
      await saveRiderTripActivitySeenAt(normalizedUserId, nowIso);
      setSeenAt(new Date(nowIso).getTime());
    } catch (error) {
      if (__DEV__) {
        console.warn("mark trip activity seen error:", error);
      }
    }
  }, [normalizedUserId]);

  const value = useMemo(
    () => ({
      unreadCount,
      refresh,
      markAllAsSeen,
    }),
    [unreadCount, refresh, markAllAsSeen],
  );

  return (
    <TripActivityContext.Provider value={value}>
      {children}
    </TripActivityContext.Provider>
  );
}

export function useTripActivity() {
  const ctx = useContext(TripActivityContext);

  if (!ctx) {
    throw new Error("useTripActivity must be inside TripActivityProvider");
  }

  return ctx;
}
