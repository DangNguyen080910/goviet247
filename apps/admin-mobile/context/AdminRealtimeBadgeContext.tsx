// Path: goviet247/apps/admin-mobile/context/AdminRealtimeBadgeContext.tsx
import {
  createContext,
  ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

type AdminRealtimeBadgeContextValue = {
  hasNewRealtimeAlert: boolean;
  triggerRealtimeAlert: () => void;
  clearRealtimeAlert: () => void;
};

const AdminRealtimeBadgeContext =
  createContext<AdminRealtimeBadgeContextValue | null>(null);

export function AdminRealtimeBadgeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [hasNewRealtimeAlert, setHasNewRealtimeAlert] = useState(false);

  const value = useMemo(
    () => ({
      hasNewRealtimeAlert,

      triggerRealtimeAlert() {
        setHasNewRealtimeAlert(true);
      },

      clearRealtimeAlert() {
        setHasNewRealtimeAlert(false);
      },
    }),
    [hasNewRealtimeAlert],
  );

  return (
    <AdminRealtimeBadgeContext.Provider value={value}>
      {children}
    </AdminRealtimeBadgeContext.Provider>
  );
}

export function useAdminRealtimeBadge() {
  const context = useContext(AdminRealtimeBadgeContext);

  if (!context) {
    throw new Error(
      "useAdminRealtimeBadge must be used inside AdminRealtimeBadgeProvider",
    );
  }

  return context;
}