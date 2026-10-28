import { useEffect, useRef, useState } from "react";
import { Animated, AppState, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchAdminDashboard } from "../services/dashboardApi";
import { getAdminToken } from "../services/storage";
import { connectAdminSocket, onAdminRealtimeEvent, offAdminRealtimeEvent } from "../services/adminSocket";

type Milestone = { id: string; message: string; level: number };
const key = "goviet247:seen-trip-milestones";
export default function TripMilestoneCelebration() {
  const path = usePathname();
  const [items, setItems] = useState<Milestone[]>([]);
  const [seen, setSeen] = useState<string[] | null>(null);
  const fall = useRef(new Animated.Value(0)).current;
  const current = seen ? items.find(item => !seen.includes(item.id)) : undefined;
  useEffect(() => {
    let active = true;
    let busy = false;
    async function load() {
      if (busy || AppState.currentState !== "active") return;
      busy = true;
      try {
        if (!(await getAdminToken())) { if (active) setItems([]); return; }
        const data = await fetchAdminDashboard();
        const saved = await AsyncStorage.getItem(key);
        if (active) { setItems(data?.milestones || []); setSeen(JSON.parse(saved || "[]")); }
      } catch { /* Retry on next refresh. */ } finally { busy = false; }
    }
    load();
    const refresh = () => { void load(); };
    let subscribed = false;
    void (async () => {
      if (!(await getAdminToken())) return;
      const socket = await connectAdminSocket();
      if (active && socket) {
        onAdminRealtimeEvent("admin:dashboard_changed", refresh);
        subscribed = true;
      }
    })().catch(() => {});
    const timer = setInterval(load, 30000);
    const sub = AppState.addEventListener("change", state => { if (state === "active") load(); });
    return () => { active = false; clearInterval(timer); sub.remove(); if (subscribed) offAdminRealtimeEvent("admin:dashboard_changed", refresh); };
  }, [path]);
  useEffect(() => {
    if (!current) return;
    fall.setValue(0);
    const animation = Animated.timing(fall, { toValue: 1, duration: 3000, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [current?.id, fall]);
  async function dismiss() {
    if (!current) return;
    const next = [...(seen || []), current.id];
    setSeen(next);
    try { await AsyncStorage.setItem(key, JSON.stringify(next)); } catch {}
  }
  const visible = Boolean(current) && path !== "/login" && path !== "/";
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
    <View style={styles.overlay}><View style={styles.card}>
      {Array.from({ length: 24 }, (_, i) => <Animated.View key={i} pointerEvents="none" style={{ position:"absolute", top:0, left:`${i*4}%`, width:8, height:14, backgroundColor:["#ff9800", "#26a69a", "#ec407a", "#42a5f5"][i%4], opacity:fall.interpolate({ inputRange:[0,0.8,1], outputRange:[1,1,0] }), transform:[{ translateY:fall.interpolate({ inputRange:[0,1], outputRange:[-30,340+i%4*15] }) }, { rotate:fall.interpolate({ inputRange:[0,1], outputRange:["0deg","300deg"] }) }] }} />)}
      <Text style={styles.emoji}>🎉 🎊</Text>
      <Text style={styles.title}>GoViet247 sắp đạt mốc mới!</Text>
      <Text style={styles.message}>{current?.message}</Text>
      <Text style={styles.note}>Thông báo chuẩn bị mốc chuyến. Admin tự xem xét phần thưởng; chuyến và thanh toán vẫn xử lý bình thường.</Text>
      <Pressable accessibilityRole="button" onPress={dismiss} style={styles.button}><Text style={styles.buttonText}>Đã biết — cùng chờ mốc mới!</Text></Pressable>
    </View></View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay:{ flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"center", padding:24 },
  card:{ backgroundColor:"white", borderRadius:24, padding:24, overflow:"hidden" },
  emoji:{ fontSize:44, textAlign:"center", marginBottom:16 },
  title:{ color:"#00695c", fontSize:23, fontWeight:"800", textAlign:"center" },
  message:{ fontSize:19, fontWeight:"600", textAlign:"center", marginTop:20, color:"#172b36" },
  note:{ fontSize:14, color:"#52616b", textAlign:"center", marginTop:16 },
  button:{ backgroundColor:"#00695c", padding:15, borderRadius:12, marginTop:24 },
  buttonText:{ color:"white", textAlign:"center", fontWeight:"700" },
});
