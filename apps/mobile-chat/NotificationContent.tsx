import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

export type NotificationPreferenceChange = { isPinned?: boolean; isCollapsed?: boolean };
export default function NotificationContent({ item, message, onChange }: {
  item: { id: string; isPinned?: boolean; isCollapsed?: boolean };
  message: string;
  onChange: (id: string, changes: NotificationPreferenceChange) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [collapsed, setCollapsed] = useState(item.isCollapsed ?? true);
  useEffect(() => setCollapsed(item.isCollapsed ?? true), [item.id, item.isCollapsed]);
  async function save(changes: NotificationPreferenceChange) {
    if (inFlight.current) return;
    // Reading cached text must still work offline; persist the choice when possible.
    if (changes.isCollapsed !== undefined) setCollapsed(changes.isCollapsed);
    inFlight.current = true; setBusy(true);
    try { await onChange(item.id, changes); }
    catch (error: any) { Alert.alert("Chưa lưu được lựa chọn", error?.message || "Vui lòng thử lại."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <View>
    <Text numberOfLines={collapsed ? 3 : undefined} style={{ color: "#374151", fontSize: 15, lineHeight: 23 }}>{message || "Không có nội dung."}</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: !collapsed, disabled: busy }} disabled={busy} onPress={() => void save({ isCollapsed: !collapsed })} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={{ color: "#2563eb", fontWeight: "700" }}>{collapsed ? "Xem thêm" : "Thu gọn"}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: Boolean(item.isPinned), disabled: busy }} disabled={busy} onPress={() => void save({ isPinned: !item.isPinned })} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={{ color: "#2563eb", fontWeight: "700" }}>{item.isPinned ? "📌 Bỏ ghim" : "Ghim"}</Text>
      </Pressable>
    </View>
  </View>;
}
