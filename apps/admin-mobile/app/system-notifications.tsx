import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { adminRequest } from "../services/adminRequest";
import { getAdminUser } from "../services/storage";

type Notice = { id: string; title: string; message: string; createdAt: string; isActive: boolean; isPinnedByDefault: boolean };
export default function SystemNotificationsScreen() {
  const [audience, setAudience] = useState<"DRIVER" | "RIDER">("DRIVER");
  const [items, setItems] = useState<Notice[]>([]);
  const [title, setTitle] = useState(""); const [message, setMessage] = useState("");
  const [active, setActive] = useState(true); const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const inFlight = useRef(false); const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current; setLoading(true); setError("");
    try {
      const user = await getAdminUser();
      if (user?.role?.toUpperCase() !== "ADMIN") { router.replace("/home"); return; }
      const data = await adminRequest(`/api/admin/system-notifications?audience=${audience}&limit=200`);
      if (generation.current === request) setItems(data.items || []);
    } catch (e: any) { if (generation.current === request) setError(e.message); }
    finally { if (generation.current === request) setLoading(false); }
  }, [audience]);
  useFocusEffect(useCallback(() => { void load(); return () => { generation.current++; }; }, [load]));
  async function mutate(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try { await action(); await load(); }
    catch (e: any) { setError(e.message || "Chưa lưu được thông báo."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  function create() {
    if (!title.trim() || !message.trim()) { setError("Vui lòng nhập tiêu đề và nội dung."); return; }
    void mutate(async () => {
      await adminRequest("/api/admin/system-notifications", { method: "POST", body: JSON.stringify({ audience, title: title.trim(), message: message.trim(), isActive: active, isPinnedByDefault: pinned }) });
      Alert.alert("Đã lưu", active ? "Đã gửi thông báo." : "Đã lưu thông báo ở trạng thái tắt.");
      setTitle(""); setMessage(""); setActive(true); setPinned(false);
    });
  }
  function update(item: Notice, changes: { isActive?: boolean; isPinnedByDefault?: boolean }) {
    void mutate(async () => { await adminRequest(`/api/admin/system-notifications/${encodeURIComponent(item.id)}`, { method: "PATCH", body: JSON.stringify(changes) }); });
  }
  const button = (label: string, onPress: () => void, disabled = busy) => <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={{ minHeight: 44, justifyContent: "center", padding: 10, opacity: disabled ? 0.5 : 1 }}><Text style={{ color: "#1565c0", fontWeight: "700" }}>{label}</Text></Pressable>;
  const toggle = (label: string, value: boolean, onValueChange: (value: boolean) => void) => <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}><Text style={{ flex: 1 }}>{label}</Text><Switch accessibilityLabel={label} disabled={busy} value={value} onValueChange={onValueChange} /></View>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: "#f3f4f6" }}>
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
      {button("← Trang chủ", () => router.back())}
      <Text style={{ fontSize: 24, fontWeight: "800" }}>Thông báo hệ thống</Text>
      <View style={{ flexDirection: "row", gap: 12 }}>{button(audience === "DRIVER" ? "✓ Tài xế" : "Tài xế", () => setAudience("DRIVER"))}{button(audience === "RIDER" ? "✓ Khách hàng" : "Khách hàng", () => setAudience("RIDER"))}</View>
      <View style={{ padding: 16, backgroundColor: "white", borderRadius: 12, gap: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>Tạo thông báo mới</Text>
        <TextInput accessibilityLabel="Tiêu đề" placeholder="Tiêu đề" value={title} onChangeText={setTitle} editable={!busy} style={{ borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12 }} />
        <TextInput accessibilityLabel="Nội dung" placeholder="Nội dung" multiline value={message} onChangeText={setMessage} editable={!busy} style={{ borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, minHeight: 120, textAlignVertical: "top" }} />
        {toggle("Kích hoạt ngay", active, setActive)}
        {toggle("Ghim mặc định cho người nhận", pinned, setPinned)}
        <Text style={{ color: "#6b7280" }}>Người nhận vẫn có thể tự bỏ ghim. Đổi ghim không gửi lại thông báo push.</Text>
        {button(active ? "Gửi thông báo" : "Lưu thông báo", create)}
      </View>
      {!!error && <Text accessibilityRole="alert" style={{ color: "#b91c1c" }}>{error}</Text>}
      {button("Làm mới", () => void load(), busy || loading)}
      {loading ? <ActivityIndicator /> : !items.length ? <Text>Chưa có thông báo.</Text> : items.map(item => <View key={item.id} style={{ padding: 16, gap: 8, backgroundColor: "white", borderRadius: 12 }}>
        <Text style={{ fontWeight: "800", fontSize: 16 }}>{item.isPinnedByDefault ? "📌 " : ""}{item.title}</Text>
        <Text style={{ color: "#6b7280" }}>{new Date(item.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</Text>
        <Text numberOfLines={expanded[item.id] ? undefined : 3} style={{ lineHeight: 23 }}>{item.message}</Text>
        {button(expanded[item.id] ? "Thu gọn" : "Xem thêm", () => setExpanded(current => ({ ...current, [item.id]: !current[item.id] })))}
        {toggle("Kích hoạt thông báo", item.isActive, value => update(item, { isActive: value }))}
        {toggle("Ghim mặc định", item.isPinnedByDefault, value => update(item, { isPinnedByDefault: value }))}
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}
