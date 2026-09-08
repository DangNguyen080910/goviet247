// Path: goviet247/apps/admin-mobile/app/index.tsx
import { useEffect, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getAdminToken } from "../services/storage";
import * as Notifications from "expo-notifications";
import { getAdminNotificationResponseRoute } from "../services/adminNotificationNavigation";

export default function IndexScreen() {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const token = await getAdminToken();

        if (!active) return;

        if (token) {
          const response = await Notifications.getLastNotificationResponseAsync().catch(() => null);
          const route = response
            ? getAdminNotificationResponseRoute(response)
            : "/home";
          if (response) {
            await Notifications.clearLastNotificationResponseAsync().catch(() => {});
          }
          router.replace(route as any);
          return;
        }

        router.replace("/login");
      } catch {
        if (!active) return;
        setFailed(true);
      }
    }

    bootstrap();

    return () => {
      active = false;
    };
  }, [attempt]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>GoViet247 Admin</Text>
        {failed ? <Pressable accessibilityRole="button" style={{ padding: 16 }}
          onPress={() => { setFailed(false); setAttempt(value => value + 1); }}>
          <Text>Chưa thể khôi phục phiên. Nhấn để thử lại.</Text>
        </Pressable> : <>
          <ActivityIndicator size="large" />
          <Text style={styles.subtitle}>Đang khởi động...</Text>
        </>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f8fa",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1565c0",
    marginBottom: 20,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
});
