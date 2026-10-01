import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatBookingTime, setBookingClock } from "../utils/bookingTime";

export default function BookingTimePicker({ value, onChange, onClose }: {
  value: string; onChange: (value: string) => void; onClose: () => void;
}) {
  const initialHour = value ? Number(value.slice(11, 13)) : 6;
  const initialMinute = value ? Number(value.slice(14, 16)) : 0;
  const [hour, setHour] = useState(initialHour % 12 || 12);
  const [minute, setMinute] = useState(initialMinute);
  const [period, setPeriod] = useState<"AM" | "PM" | null>(null);
  const result = setBookingClock(value, hour, minute, period || "AM");
  return <Modal transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}><View style={styles.panel}>
      <ScrollView>
        <Text style={styles.title}>Chọn giờ (Việt Nam)</Text>
        <Text style={styles.label}>Giờ</Text>
        <View style={styles.grid}>{Array.from({ length: 12 }, (_, i) => i + 1).map(h =>
          <Pressable key={h} accessibilityRole="radio" accessibilityState={{ checked: hour === h }}
            onPress={() => setHour(h)} style={[styles.option, hour === h && styles.active]}>
            <Text>{String(h).padStart(2, "0")}</Text>
          </Pressable>)}</View>
        <Text style={styles.label}>Phút</Text>
        <View style={styles.grid}>{Array.from(new Set([...Array.from({ length: 12 }, (_, i) => i * 5), initialMinute])).sort((a,b) => a-b).map(m =>
          <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: minute === m }}
            onPress={() => setMinute(m)} style={[styles.option, minute === m && styles.active]}>
            <Text>{String(m).padStart(2, "0")}</Text>
          </Pressable>)}</View>
        <Text style={styles.label}>Buổi</Text>
        <View style={styles.row}>{(["AM", "PM"] as const).map(p =>
          <Pressable key={p} accessibilityRole="radio" accessibilityState={{ checked: period === p }}
            onPress={() => setPeriod(p)} style={[styles.period, period === p && styles.active]}>
            <Text>{p === "AM" ? "Sáng (AM)" : "Chiều / tối (PM)"}</Text>
          </Pressable>)}</View>
        <Text style={styles.summary}>{period ? formatBookingTime(result) : "Chọn buổi"}</Text>
        <View style={styles.row}>
          <Pressable onPress={onClose} style={styles.period}><Text>Huỷ</Text></Pressable>
          <Pressable disabled={!period} onPress={() => { onChange(result); onClose(); }}
            style={[styles.period, { backgroundColor: period ? "#F97316" : "#e5e7eb" }]}><Text>Xác nhận</Text></Pressable>
        </View>
      </ScrollView>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 16 },
  panel: { backgroundColor: "white", padding: 16, borderRadius: 8, maxHeight: "90%", width: "100%", maxWidth: 480, alignSelf: "center" },
  title: { fontSize: 18, fontWeight: "700" },
  label: { fontSize: 14, fontWeight: "600", marginTop: 16, marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { width: "14%", height: 44, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 4 },
  active: { backgroundColor: "#ffedd5", borderColor: "#ea580c" },
  row: { flexDirection: "row", gap: 8 },
  period: { flex: 1, minHeight: 48, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 4, padding: 8 },
  summary: { fontSize: 16, fontWeight: "700", textAlign: "center", marginVertical: 20 },
});
