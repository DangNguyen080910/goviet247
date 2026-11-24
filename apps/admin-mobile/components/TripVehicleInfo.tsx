import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { tripVehicleRows } from "../utils/tripVehicle";

export default function TripVehicleInfo({ trip }: { trip: unknown }) {
  const info = tripVehicleRows(trip);
  async function copyPlate(plate: string) {
    try { if (await Clipboard.setStringAsync(plate) === false) throw new Error("Clipboard unavailable"); Alert.alert("Đã sao chép", `Biển số: ${plate}`); }
    catch { Alert.alert("Chưa sao chép được biển số", "Vui lòng thử lại."); }
  }
  return <View style={styles.card}>
    <Text style={styles.title}>Xe tài xế đang đăng ký</Text>
    <Text style={styles.request}>Khách yêu cầu: {info.request}</Text>
    {!info.hasDriver ? <Text style={styles.value}>Chưa có tài xế nhận chuyến.</Text>
      : !info.rows.length ? <Text style={styles.value}>Chưa có thông tin xe trong hồ sơ tài xế.</Text>
      : info.rows.map(([label,value]) => <View key={label} style={styles.row}>
          <View style={styles.field}><Text style={styles.label}>{label}</Text><Text selectable style={styles.value}>{value}</Text></View>
          {label === "Biển số" && value !== "Chưa cập nhật" && <Pressable accessibilityRole="button" accessibilityLabel={`Sao chép biển số ${value}`} onPress={event=>{event.stopPropagation();void copyPlate(value);}} style={styles.copy}><Text style={styles.link}>Copy</Text></Pressable>}
        </View>)}
    {info.hasDriver && <Text style={styles.note}>Thông tin theo hồ sơ hiện tại của tài xế.</Text>}
  </View>;
}
const styles=StyleSheet.create({
  card:{padding:14,gap:10,borderRadius:12,borderWidth:1,borderColor:"#bfdbfe",backgroundColor:"#f0f7ff"},
  title:{fontSize:16,fontWeight:"800",color:"#0f172a"},request:{fontSize:14,fontWeight:"700",color:"#1d4ed8",lineHeight:21},
  row:{flexDirection:"row",gap:8,alignItems:"center"},field:{flex:1,gap:3},label:{fontSize:12,color:"#64748b"},
  value:{fontSize:15,color:"#0f172a",lineHeight:22},note:{fontSize:12,color:"#64748b",lineHeight:18},
  copy:{padding:10,backgroundColor:"white",borderRadius:8},link:{fontWeight:"700",color:"#1d4ed8"},
});
