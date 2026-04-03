// Path: goviet247/apps/web/src/context/CustomerAuthContext.jsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getMe } from "../api/auth";
import { getPublicSystemNotifications } from "../api/systemNotificationsPublic";

const CustomerAuthContext = createContext(null);

const TOKEN_KEY = "gv247_customer_token";
const USER_KEY = "gv247_customer_user";

function normalizeCustomerUser(user) {
  if (!user) return null;

  const riderName = String(user?.riderName || "").trim() || null;
  const driverName = String(user?.driverName || "").trim() || null;
  const displayName =
    riderName ||
    String(user?.displayName || "").trim() ||
    String(user?.phone || "").trim() ||
    null;

  return {
    ...user,
    riderName,
    driverName,
    displayName,
  };
}

function getNotificationReadStorageKey(userId) {
  return `gv247_customer_notification_read_${userId}`;
}

function readStoredNotificationReadIds(userId) {
  if (!userId) return [];

  try {
    const raw = localStorage.getItem(getNotificationReadStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredNotificationReadIds(userId, ids = []) {
  if (!userId) return;

  localStorage.setItem(
    getNotificationReadStorageKey(userId),
    JSON.stringify(Array.from(new Set(ids))),
  );
}

async function playNotificationSound() {
  try {
    const audio = new Audio("/sounds/notification.mp3");
    audio.volume = 0.8;
    await audio.play().catch(() => {});
  } catch (err) {
    console.log("play notification sound error:", err);
  }
}

export function CustomerAuthProvider({ children }) {
  const [token, setToken] = useState(
    () => localStorage.getItem(TOKEN_KEY) || "",
  );

  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? normalizeCustomerUser(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const lastNotificationIdsRef = useRef(new Set());
  const daKhoiTaoThongBaoRef = useRef(false);

  useEffect(() => {
    async function restore() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const u = normalizeCustomerUser(await getMe(token));
        setUser(u);
        localStorage.setItem(USER_KEY, JSON.stringify(u));
      } catch (err) {
        console.error("restore session failed", err);

        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);

        setToken("");
        setUser(null);
      }

      setLoading(false);
    }

    restore();
  }, [token]);

  useEffect(() => {
    if (!token || !user?.id) {
      setNotifications([]);
      setNotificationsLoading(false);
      lastNotificationIdsRef.current = new Set();
      daKhoiTaoThongBaoRef.current = false;
      return;
    }

    let active = true;

    async function syncSystemNotifications(showLoading = false) {
      try {
        if (showLoading) {
          setNotificationsLoading(true);
        }

        const items = await getPublicSystemNotifications({
          audience: "RIDER",
        });

        if (!active) return;

        const safeItems = Array.isArray(items) ? items : [];
        const prevIds = lastNotificationIdsRef.current;
        const nextIds = new Set(safeItems.map((item) => item.id));

        const newItems = safeItems.filter((item) => !prevIds.has(item.id));

        if (daKhoiTaoThongBaoRef.current && newItems.length > 0) {
          await playNotificationSound();
        }

        lastNotificationIdsRef.current = nextIds;
        daKhoiTaoThongBaoRef.current = true;

        const storedReadIds = new Set(readStoredNotificationReadIds(user.id));

        setNotifications((prev) => {
          const prevReadIds = new Set(
            (Array.isArray(prev) ? prev : [])
              .filter((item) => item?.isRead)
              .map((item) => item.id),
          );

          const mergedReadIds = new Set([...storedReadIds, ...prevReadIds]);

          return safeItems.map((item) => ({
            ...item,
            isRead: mergedReadIds.has(item.id),
          }));
        });
      } catch (err) {
        console.error("sync system notifications failed", err);
      } finally {
        if (active && showLoading) {
          setNotificationsLoading(false);
        }
      }
    }

    syncSystemNotifications(true);

    const timer = window.setInterval(() => {
      syncSystemNotifications(false);
    }, 10000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [token, user?.id]);

  const markAllNotificationsRead = useCallback(() => {
    if (!user?.id) return;

    setNotifications((prev) => {
      const ids = (Array.isArray(prev) ? prev : []).map((item) => item.id);
      const oldIds = readStoredNotificationReadIds(user.id);

      saveStoredNotificationReadIds(user.id, [...oldIds, ...ids]);

      return (Array.isArray(prev) ? prev : []).map((item) => ({
        ...item,
        isRead: true,
      }));
    });
  }, [user?.id]);

  const login = useCallback((newToken, newUser) => {
    const normalizedUser = normalizeCustomerUser(newUser);

    setToken(newToken);
    setUser(normalizedUser);

    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
  }, []);

  const logout = useCallback(() => {
    setToken("");
    setUser(null);
    setNotifications([]);
    setNotificationsLoading(false);

    lastNotificationIdsRef.current = new Set();
    daKhoiTaoThongBaoRef.current = false;

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  return (
    <CustomerAuthContext.Provider
      value={{
        token,
        user,
        loading,
        login,
        logout,
        notifications,
        notificationsLoading,
        markAllNotificationsRead,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCustomerAuth() {
  return useContext(CustomerAuthContext);
}
