import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, usePathname, useRootNavigationState, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDriverContract } from "../services/driverProfileApi";
import { getDriverToken } from "../services/storage";
import { createContractEntryChecker, requiresContractEntryCheck, type ContractEntryState } from "../services/contractEntryGate";

export default function DriverContractGate({ children }: { children: ReactNode }) {
  const path = usePathname();
  const navigationKey = useRootNavigationState()?.key;
  const [state, setState] = useState<ContractEntryState>({ path: "", phase: "checking" });
  const checker = useMemo(() => createContractEntryChecker({
    getToken: getDriverToken,
    loadAgreement: getDriverContract,
    onState: next => {
      setState(next);
      if (next.destination) router.replace(next.destination as Href);
    },
  }), []);

  useEffect(() => {
    if (!navigationKey || !requiresContractEntryCheck(path)) {
      checker.cancel();
      return;
    }
    // Hide the retained screen while backgrounded, before it becomes interactive again.
    const suspend = () => {
      checker.cancel();
      setState({ path, phase: "checking" });
    };
    if (AppState.currentState === "active" || AppState.currentState === null) void checker.check(path);
    else suspend();
    const subscription = AppState.addEventListener("change", next => {
      if (next === "active") void checker.check(path);
      else suspend();
    });
    return () => { checker.cancel(); subscription.remove(); };
  }, [checker, navigationKey, path]);

  const blocked = requiresContractEntryCheck(path) && (state.path !== path || state.phase !== "allowed");
  const failed = state.path === path && state.phase === "error";
  return <View style={styles.container}>
    {/* The navigator must stay mounted even while its screen is being checked. */}
    <View style={[styles.container, blocked && styles.hidden]} pointerEvents={blocked ? "none" : "auto"}
      accessibilityElementsHidden={blocked} importantForAccessibility={blocked ? "no-hide-descendants" : "auto"}>
      {children}
    </View>
    {blocked && <SafeAreaView style={styles.cover}>
      {failed ? <>
        <Text style={styles.title}>Chưa kiểm tra được hợp đồng</Text>
        <Text style={styles.description}>Vui lòng kiểm tra kết nối và thử lại. Bạn không cần đăng xuất hoặc yêu cầu OTP mới.</Text>
        <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => void checker.check(path)}>
          <Text style={styles.buttonText}>Thử lại</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.support} onPress={() => router.push("/support")}>
          <Text style={styles.supportText}>Liên hệ hỗ trợ</Text>
        </TouchableOpacity>
      </> : <>
        <ActivityIndicator size="large" color="#1676D2" />
        <Text style={styles.description}>Đang kiểm tra hợp đồng tài xế…</Text>
      </>}
    </SafeAreaView>}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hidden: { opacity: 0 },
  cover: { ...StyleSheet.absoluteFillObject, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", padding: 24 },
  title: { fontSize: 20, fontWeight: "700", color: "#17202a", textAlign: "center" },
  description: { fontSize: 16, lineHeight: 24, color: "#475569", textAlign: "center", marginVertical: 20 },
  button: { backgroundColor: "#1676D2", paddingVertical: 14, paddingHorizontal: 30, borderRadius: 10 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  support: { padding: 16 },
  supportText: { color: "#1676D2", fontSize: 16, fontWeight: "600" },
});
