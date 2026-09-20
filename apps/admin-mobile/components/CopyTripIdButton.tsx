import * as Clipboard from "expo-clipboard";
import { Alert, Pressable, StyleSheet, Text } from "react-native";

export default function CopyTripIdButton({ tripId }: { tripId?: string | null }) {
  const value = String(tripId || "").trim();
  if (!value || value === "-" || value === "--") return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sao chép mã chuyến ${value}`}
      hitSlop={8}
      style={styles.button}
      onPress={async () => {
        try {
          await Clipboard.setStringAsync(value);
          Alert.alert("Đã sao chép", `Mã chuyến: ${value}`);
        } catch {
          Alert.alert("Không thể sao chép", "Vui lòng thử lại.");
        }
      }}
    >
      <Text style={styles.text}>Copy</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: { color: "#1d4ed8", fontSize: 12, fontWeight: "700" },
});
