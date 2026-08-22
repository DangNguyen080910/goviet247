// Path: goviet247/apps/rider-mobile/app/notifications.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AppBrandHeader from "../components/AppBrandHeader";
import { useNotifications } from "../context/NotificationContext";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function RiderNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { items, loading, refreshing, refresh, markAllAsRead } =
    useNotifications();
  const [errorText, setErrorText] = useState("");

  const loadNotifications = useCallback(
    async (options?: { silent?: boolean }) => {
      try {
        setErrorText("");
        await refresh(options);
      } catch (error: any) {
        console.error("load rider notifications error:", error);
        setErrorText(error?.message || "Không tải được danh sách thông báo.");
      }
    },
    [refresh],
  );

  useFocusEffect(
    useCallback(() => {
      void loadNotifications({ silent: false });
    }, [loadNotifications]),
  );

  useEffect(() => {
    if (loading) return;
    if (!items.length) return;

    const timer = setTimeout(() => {
      void markAllAsRead();
    }, 1000);

    return () => clearTimeout(timer);
  }, [loading, items.length, markAllAsRead]);

  const hasItems = useMemo(() => items.length > 0, [items]);

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: Math.max(insets.top, 10),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AppBrandHeader title="Thông báo" />

        <View style={styles.topActions}>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              void loadNotifications({ silent: true });
            }}
            disabled={refreshing}
          >
            <Text style={styles.secondaryButtonText}>
              {refreshing ? "Đang tải..." : "Làm mới"}
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Đang tải thông báo...</Text>
          </View>
        ) : errorText ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Không tải được thông báo</Text>
            <Text style={styles.cardText}>{errorText}</Text>

            <Pressable
              style={styles.retryButton}
              onPress={() => {
                void loadNotifications({ silent: false });
              }}
            >
              <Text style={styles.retryButtonText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : !hasItems ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Chưa có thông báo nào</Text>
            <Text style={styles.cardText}>
              Khi hệ thống có thông báo mới cho rider, danh sách sẽ hiển thị tại
              đây.
            </Text>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {items.map((item, index) => {
              const notificationData = item as any;
              const tripId = String(
                notificationData?.data?.tripId ||
                  notificationData?.meta?.tripId ||
                  notificationData?.tripId ||
                  "",
              ).trim();

              const bodyText = String(item?.body || item?.message || "").trim();

              const isNewest = index === 0;

              return (
                <Pressable
                  key={item.id}
                  style={[
                    styles.notificationCard,
                    isNewest ? styles.notificationCardNewest : null,
                  ]}
                  onPress={() => {
                    if (!tripId) return;

                    router.push(
                      `/trip-history?focusTripId=${encodeURIComponent(tripId)}`,
                    );
                  }}
                >
                  <View style={styles.notificationHeader}>
                    <Text style={styles.notificationTitle}>{item.title}</Text>
                    <Text style={styles.notificationTime}>
                      {formatDateTime(item.createdAt)}
                    </Text>
                  </View>

                  <Text style={styles.notificationBody}>
                    {bodyText || "Không có nội dung."}
                  </Text>

                  {tripId ? (
                    <Text style={styles.notificationHint}>
                      Chạm để xem chuyến liên quan
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  topActions: {
    flexDirection: "row",
    marginBottom: 16,
  },
  secondaryButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#374151",
  },
  loadingCard: {
    minHeight: 220,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#6B7280",
  },
  retryButton: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  listWrap: {
    gap: 12,
  },
  notificationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  notificationCardNewest: {
    borderColor: "#F97316",
    backgroundColor: "#FFF7ED",
  },
  notificationHeader: {
    gap: 6,
    marginBottom: 10,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  notificationTime: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
  },
  notificationBody: {
    fontSize: 15,
    lineHeight: 23,
    color: "#374151",
  },
  notificationHint: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "800",
    color: "#F97316",
  },
});
