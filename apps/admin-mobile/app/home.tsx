// Path: goviet247/apps/admin-mobile/app/home.tsx
import { router, useFocusEffect } from "expo-router";
import * as Notifications from "expo-notifications";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchAdminDashboard } from "../services/dashboardApi";
import {
  clearAdminSession,
  getAdminToken,
  getAdminUser,
} from "../services/storage";
import {
  connectAdminSocket,
  offAdminRealtimeEvent,
  onAdminRealtimeEvent,
  disconnectAdminSocket
} from "../services/adminSocket";
import {
  playAdminNormalNotify,
  playAdminUrgentNotify,
  warmupAdminNotify,
} from "../services/adminNotify";

type DashboardData = {
  stats?: {
    pendingVerifyCount?: number;
    unassignedCount?: number;
    assignedCount?: number;
    recentAlertsCount?: number;
    driverKycPendingCount?: number;
    feedbackNewCount?: number;
  };
  adminOnly?: {
    finance?: {
      walletBalanceTotal?: number;
      driverCount?: number;
      withdrawPendingTotal?: number;
      withdrawPendingCount?: number;
      commissionNeedTransfer?: number;
      settlementPendingCount?: number;
    };
    risks?: {
      pendingVerifyTooLongCount?: number;
      unassignedTooLongCount?: number;
      withdrawPendingCount?: number;
      feedbackBacklogCount?: number;
      driverTripPenaltyPendingCount?: number;
    };
  };
};

type MenuCardItem = {
  key: string;
  title: string;
  badge?: number;
  subtitle?: string;
  icon: string;
  iconBg: string;
};

export default function HomeScreen() {
  const [adminUsername, setAdminUsername] = useState("");
  const [adminRole, setAdminRole] = useState("");

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const stats = dashboard?.stats || {};
  const adminOnly = dashboard?.adminOnly || {};
  const finance = adminOnly?.finance || {};
  const risks = adminOnly?.risks || {};

  const walletBadge =
    Number(risks?.withdrawPendingCount || 0) +
    Number(risks?.driverTripPenaltyPendingCount || 0);

  const totalNotificationCount =
    Number(stats?.pendingVerifyCount || 0) +
    Number(stats?.unassignedCount || 0) +
    Number(stats?.assignedCount || 0) +
    Number(stats?.driverKycPendingCount || 0) +
    Number(stats?.feedbackNewCount || 0) +
    Number(walletBadge || 0);

  const displayName = adminUsername?.trim() || "Admin";
  const displayRole = adminRole?.trim() || "Quản trị viên";
  const isStaff =
    String(adminRole || "")
      .trim()
      .toUpperCase() === "STAFF";
  const isAdmin =
    String(adminRole || "")
      .trim()
      .toUpperCase() === "ADMIN";

  const menuItems = useMemo<MenuCardItem[]>(() => {
    return [
      {
        key: "PENDING_VERIFY",
        title: "Chuyến (Chờ Duyệt)",
        badge: Number(stats?.pendingVerifyCount || 0),
        subtitle:
          Number(risks?.pendingVerifyTooLongCount || 0) > 0
            ? `${Number(risks?.pendingVerifyTooLongCount || 0)} chuyến chờ lâu`
            : "Xem danh sách chuyến chờ duyệt",
        icon: "⏱",
        iconBg: "#fbbf24",
      },
      {
        key: "UNASSIGNED",
        title: "Chuyến Chưa Có Tài Xế",
        badge: Number(stats?.unassignedCount || 0),
        subtitle:
          Number(risks?.unassignedTooLongCount || 0) > 0
            ? `${Number(risks?.unassignedTooLongCount || 0)} chuyến chưa có tài xế lâu`
            : "Xem danh sách chuyến chưa có tài xế",
        icon: "⌛",
        iconBg: "#f97316",
      },
      {
        key: "ASSIGNED",
        title: "Chuyến Tài Xế Đã Nhận",
        badge: Number(stats?.assignedCount || 0),
        subtitle: "Xem danh sách chuyến đã có tài xế nhận",
        icon: "✓",
        iconBg: "#22c55e",
      },
      {
        key: "DRIVERS",
        title: "Tài Xế",
        badge: Number(stats?.driverKycPendingCount || 0),
        subtitle:
          Number(stats?.driverKycPendingCount || 0) > 0
            ? "Đang chờ duyệt KYC"
            : "Quản lý tài xế",
        icon: "👥",
        iconBg: "#2563eb",
      },
      {
        key: "CUSTOMERS",
        title: "Khách Hàng",
        badge: 0,
        subtitle: "Quản lý khách hàng",
        icon: "👤",
        iconBg: "#7c3aed",
      },
      {
        key: "WALLETS",
        title: "Ví Tài Xế",
        badge: walletBadge,
        subtitle:
          walletBadge > 0
            ? `${Number(risks?.withdrawPendingCount || 0)} rút tiền • ${Number(
                risks?.driverTripPenaltyPendingCount || 0,
              )} phạt huỷ`
            : "Quản lý ví tài xế",
        icon: "💳",
        iconBg: "#0d9488",
      },
      {
        key: "LEDGER",
        title: "Sổ Sách",
        badge: 0,
        subtitle: "Xem nhanh thu chi và lợi nhuận theo quý",
        icon: "📖",
        iconBg: "#0284c7",
      },
      {
        key: "FEEDBACK",
        title: "Thư Góp Ý",
        badge: Number(stats?.feedbackNewCount || 0),
        subtitle:
          Number(risks?.feedbackBacklogCount || 0) > 0
            ? `${Number(risks?.feedbackBacklogCount || 0)} mục cần xử lý`
            : "Xem góp ý và phản hồi",
        icon: "💬",
        iconBg: "#ef4444",
      },
    ].filter((item) => {
      if (isStaff && ["WALLETS", "LEDGER", "FEEDBACK"].includes(item.key)) {
        return false;
      }

      if (item.key === "LEDGER" && !isAdmin) return false;

      return true;
    });
  }, [isAdmin, isStaff, risks, stats, walletBadge]);

  const loadDashboard = useCallback(async (showRefreshSpinner = false) => {
    try {
      if (showRefreshSpinner) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data = await fetchAdminDashboard();
      setDashboard(data || null);
    } catch (error) {
      console.error("load dashboard error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      Notifications.setBadgeCountAsync(0).catch(() => {});

      const receivedSub = Notifications.addNotificationReceivedListener(() => {
        loadDashboard(false);
      });

      const responseSub = Notifications.addNotificationResponseReceivedListener(
        () => {
          loadDashboard(false);
        },
      );

      return () => {
        receivedSub.remove();
        responseSub.remove();
      };
    }, [loadDashboard]),
  );

  const handleUrgentRealtime = useCallback(async () => {
    await playAdminUrgentNotify();
    await loadDashboard(false);
  }, [loadDashboard]);

  const handleNormalRealtime = useCallback(async () => {
    await playAdminNormalNotify();
    await loadDashboard(false);
  }, [loadDashboard]);

  async function handleLogoutConfirmed() {
     disconnectAdminSocket();
    await clearAdminSession();
    router.replace("/login");
  }

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const urgentEvents = ["admin:new_trip"] as const;
      const normalEvents = [
        "admin:dashboard_changed",
        "admin:trip_accepted",
        "admin:trip_status_changed",
        "admin:trip_cancelled",
      ] as const;

      async function bootstrap() {
        try {
          const token = await getAdminToken();
          const user = await getAdminUser();

          if (!active) return;

          if (!token) {
            router.replace("/login");
            return;
          }

          setAdminUsername(user?.username || "");
          setAdminRole(user?.role || "");

          await warmupAdminNotify();
          await loadDashboard(false);
          await connectAdminSocket();

          if (!active) return;

          urgentEvents.forEach((eventName) => {
            onAdminRealtimeEvent(eventName, handleUrgentRealtime);
          });

          normalEvents.forEach((eventName) => {
            onAdminRealtimeEvent(eventName, handleNormalRealtime);
          });
        } catch (error) {
          console.error("home bootstrap error:", error);

          if (!active) return;
          router.replace("/login");
        }
      }

      bootstrap();

      return () => {
        active = false;

        urgentEvents.forEach((eventName) => {
          offAdminRealtimeEvent(eventName, handleUrgentRealtime);
        });

        normalEvents.forEach((eventName) => {
          offAdminRealtimeEvent(eventName, handleNormalRealtime);
        });

        // Không disconnect socket ở Home.
        // Socket là kết nối toàn app, đang được quản lý ở app/_layout.tsx.
      };
    }, [handleNormalRealtime, handleUrgentRealtime, loadDashboard]),
  );

  async function handleLogout() {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const ok = window.confirm(
        "Bạn có muốn đăng xuất khỏi Admin Mobile không?",
      );
      if (!ok) return;
      await handleLogoutConfirmed();
      return;
    }

    await handleLogoutConfirmed();
  }

  function handlePressMenu(item: MenuCardItem) {
    if (item.key === "PENDING_VERIFY") {
      router.push("/pending-trips");
      return;
    }

    if (item.key === "UNASSIGNED") {
      router.push("/unassigned-trips");
      return;
    }

    if (item.key === "ASSIGNED") {
      router.push("/assigned-trips");
      return;
    }

    if (item.key === "DRIVERS") {
      router.push("/drivers");
      return;
    }

    if (item.key === "CUSTOMERS") {
      router.push("/customers");
      return;
    }

    if (item.key === "WALLETS") {
      router.push("/wallets");
      return;
    }

    if (item.key === "FEEDBACK") {
      router.push("/feedback");
      return;
    }

    if (item.key === "LEDGER") {
      router.push("/ledger" as any);
      return;
    }

    console.log("menu pressed:", item.key);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDashboard(true)}
          />
        }
      >
        <View style={styles.headerCard}>
          <View>
            <Text style={styles.helloText}>Xin chào,</Text>
            <Text style={styles.adminName}>{displayName}</Text>
            {/* <Text style={styles.roleText}>{displayRole}</Text> */}
          </View>

          <View style={styles.bellBox}>
            <Text style={styles.bellText}>🔔</Text>
            {totalNotificationCount > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {totalNotificationCount > 99 ? "99+" : totalNotificationCount}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Đang tải dashboard...</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {menuItems.map((item) => (
              <Pressable
                key={item.key}
                style={styles.card}
                onPress={() => handlePressMenu(item)}
              >
                <View
                  style={[styles.iconBox, { backgroundColor: item.iconBg }]}
                >
                  <Text style={styles.iconText}>{item.icon}</Text>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardText}>{item.title}</Text>

                    {Number(item.badge || 0) > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {Number(item.badge || 0)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {item.subtitle ? (
                    <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Đăng xuất</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f8fa",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#eef0f3",
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  helloText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#667085",
    marginBottom: 2,
  },
  adminName: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111827",
  },
  roleText: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "600",
    color: "#667085",
  },
  bellBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  bellText: {
    fontSize: 22,
  },
  bellBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: "#ef0000",
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
  },
  loadingBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#667085",
  },
  grid: {
    gap: 12,
  },
  card: {
    minHeight: 98,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#fff",
  },
  cardBody: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardText: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2937",
  },
  cardSubtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "500",
    color: "#667085",
  },
  badge: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "#ef0000",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
  },
  logoutButton: {
    marginTop: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d0d7de",
    backgroundColor: "#fff",
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#dc2626",
  },
});
