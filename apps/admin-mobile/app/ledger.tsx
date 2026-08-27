import { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchCashSummary, fetchRevenueReport } from "../services/adminLedgerApi";
import { getAdminToken, getAdminUser } from "../services/storage";

const EXPENSE_LABELS: Record<string, string> = {
  MARKETING: "Marketing", AWS: "AWS", SERVER: "Máy chủ", SALARY: "Lương",
  OPERATIONS: "Vận hành", OWNER_WITHDRAW: "Chủ sở hữu rút", OTHER_OUT: "Chi khác", REFUND: "Hoàn tiền",
};

function money(value: unknown) {
  return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
}

function quarterRange(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3;
  const from = new Date(Date.UTC(year, startMonth, 1));
  const to = new Date(Date.UTC(year, startMonth + 3, 1));
  to.setUTCMilliseconds(to.getUTCMilliseconds() - 1);
  return { fromDate: from.toISOString(), toDate: to.toISOString() };
}

export default function LedgerScreen() {
  const now = new Date();
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [cash, setCash] = useState({ totalIn: 0, totalOut: 0, balance: 0 });
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const token = await getAdminToken();
      const user = await getAdminUser();
      if (!token || String(user?.role || "").toUpperCase() !== "ADMIN") {
        router.replace("/home");
        return;
      }
      const range = quarterRange(year, quarter);
      const [cashData, reportData] = await Promise.all([
        fetchCashSummary(range.fromDate, range.toDate),
        fetchRevenueReport(quarter, year),
      ]);
      setCash(cashData);
      setReport(reportData);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [quarter, year]);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => [
    { label: "Phí môi giới", value: report?.revenue?.commission },
    { label: "Phạt huỷ chuyến", value: report?.revenue?.penalty },
    ...Object.entries(report?.expense?.byCategory || {}).map(([key, value]) => ({
      label: EXPENSE_LABELS[key] || key, value: -(Number(value) || 0),
    })),
  ], [report]);

  const cards = [
    ["Tổng thu", cash.totalIn, "#15803d"], ["Tổng chi", cash.totalOut, "#dc2626"],
    ["Chênh lệch", cash.balance, "#0f172a"], ["Doanh thu công ty", report?.revenue?.total, "#0369a1"],
    ["Chi phí công ty", report?.expense?.total, "#dc2626"], ["Lợi nhuận tạm tính", report?.profit?.amount, Number(report?.profit?.amount || 0) >= 0 ? "#15803d" : "#ea580c"],
  ] as const;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
        <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹</Text></Pressable><View><Text style={styles.title}>Sổ Sách</Text><Text style={styles.subtitle}>Chỉ dành cho Admin</Text></View></View>
        <View style={styles.filter}>
          <View style={styles.filterGroup}><Text style={styles.filterLabel}>Quý</Text><View style={styles.pills}>{[1,2,3,4].map((q) => <Pressable key={q} style={[styles.pill, q === quarter && styles.pillActive]} onPress={() => setQuarter(q)}><Text style={[styles.pillText, q === quarter && styles.pillTextActive]}>Q{q}</Text></Pressable>)}</View></View>
          <View style={styles.yearRow}><Pressable style={styles.yearButton} onPress={() => setYear((v) => v - 1)}><Text>−</Text></Pressable><Text style={styles.year}>{year}</Text><Pressable style={styles.yearButton} onPress={() => setYear((v) => v + 1)}><Text>+</Text></Pressable></View>
        </View>
        {loading ? <ActivityIndicator size="large" style={{ marginTop: 60 }} /> : <>
          <View style={styles.grid}>{cards.map(([label, value, color]) => <View key={label} style={styles.card}><Text style={styles.cardLabel}>{label}</Text><Text style={[styles.cardValue, { color }]}>{money(value)}</Text></View>)}</View>
          <Text style={styles.sectionTitle}>Danh sách doanh thu / chi phí</Text>
          <View style={styles.list}>{rows.length ? rows.map((row) => <View key={row.label} style={styles.row}><Text style={styles.rowLabel}>{row.label}</Text><Text style={[styles.rowValue, { color: Number(row.value || 0) < 0 ? "#dc2626" : "#15803d" }]}>{money(row.value)}</Text></View>) : <Text style={styles.empty}>Chưa có dữ liệu trong quý này.</Text>}</View>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#f5f7fb"},content:{padding:16,paddingBottom:40},header:{flexDirection:"row",alignItems:"center",gap:12,marginBottom:18},back:{fontSize:42,lineHeight:44,color:"#0f172a"},title:{fontSize:28,fontWeight:"900",color:"#0f172a"},subtitle:{color:"#64748b",marginTop:2},filter:{backgroundColor:"white",padding:14,borderRadius:16,marginBottom:14,gap:14},filterGroup:{gap:8},filterLabel:{fontWeight:"700",color:"#475569"},pills:{flexDirection:"row",gap:8},pill:{flex:1,paddingVertical:10,borderRadius:10,backgroundColor:"#eef2f7",alignItems:"center"},pillActive:{backgroundColor:"#1677d2"},pillText:{fontWeight:"800",color:"#475569"},pillTextActive:{color:"white"},yearRow:{flexDirection:"row",justifyContent:"center",alignItems:"center",gap:20},yearButton:{width:40,height:36,borderRadius:10,backgroundColor:"#eef2f7",alignItems:"center",justifyContent:"center"},year:{fontSize:18,fontWeight:"900"},grid:{flexDirection:"row",flexWrap:"wrap",gap:10},card:{width:"48.5%",backgroundColor:"white",padding:14,borderRadius:14,minHeight:96,justifyContent:"space-between"},cardLabel:{color:"#64748b",fontWeight:"700"},cardValue:{fontSize:18,fontWeight:"900",marginTop:10},sectionTitle:{fontSize:20,fontWeight:"900",color:"#0f172a",marginTop:24,marginBottom:10},list:{backgroundColor:"white",borderRadius:14,overflow:"hidden"},row:{flexDirection:"row",justifyContent:"space-between",gap:12,padding:14,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:"#e2e8f0"},rowLabel:{flex:1,color:"#334155",fontWeight:"600"},rowValue:{fontWeight:"900"},empty:{padding:20,textAlign:"center",color:"#64748b"},
});
