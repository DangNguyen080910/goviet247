import { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { enableIncomingCalls, supportsIncomingCalls } from "./TripCalls";

export function NotificationPermissionActions({ enablePush }: { enablePush: () => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  if (Platform.OS === "web") return null;

  async function enable(label: string, action: () => Promise<boolean>) {
    if (busy) return;
    setBusy(true);
    try {
      if (await action()) Alert.alert(label, "Đã bật trên thiết bị này.");
    } catch (error) {
      Alert.alert("Chưa bật được", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void enable("Thông báo", enablePush)} style={styles.button}>
        <Text style={styles.label}>Bật thông báo</Text>
      </Pressable>
      {supportsIncomingCalls && (
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void enable("Cuộc gọi trong app", enableIncomingCalls)} style={styles.button}>
          <Text style={styles.label}>Bật nhận cuộc gọi</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 8 },
  button: { minHeight: 44, justifyContent: "center", backgroundColor: "#eff6ff", borderRadius: 8, paddingHorizontal: 12 },
  label: { color: "#1d4ed8", fontWeight: "600" },
});
