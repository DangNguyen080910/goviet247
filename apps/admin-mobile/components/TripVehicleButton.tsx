import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CopyTripIdButton from "./CopyTripIdButton";
import TripVehicleInfo from "./TripVehicleInfo";
import { fetchAssignedTripDetail, type AssignedTripDetail } from "../services/assignedTripsApi";

// Load on demand, not one network request per trip reference in wallets/alerts/chat.
export default function TripVehicleButton({tripId}: {tripId?: string | null}) {
  const [open,setOpen]=useState(false), [refresh,setRefresh]=useState(0);
  const [result,setResult]=useState<{id:string; trip:AssignedTripDetail}|null>(null);
  const [busy,setBusy]=useState(false), [error,setError]=useState("");
  useEffect(()=>{
    if (!open || !tripId) return;
    let active=true; setBusy(true);setResult(null);setError("");
    void fetchAssignedTripDetail(tripId).then(trip=>{
      if (trip.id !== tripId) throw new Error("Thông tin chuyến chưa khớp. Vui lòng tải lại.");
      if (active) setResult({id:tripId,trip});
    }).catch(e=>{if(active)setError(e?.status === 404 ? "Không tìm thấy chuyến để xem thông tin xe." : e?.message || "Chưa tải được thông tin xe.");})
      .finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[open,tripId,refresh]);
  if (!tripId) return null;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Thông tin xe chuyến ${tripId}`} onPress={event=>{event.stopPropagation();setOpen(true);}} style={styles.button}><Text style={styles.link}>Thông tin xe</Text></Pressable>
    {open && <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setOpen(false)}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}><Text style={styles.title}>Thông tin xe</Text><Pressable accessibilityRole="button" onPress={()=>setOpen(false)} style={styles.button}><Text style={styles.link}>Đóng</Text></Pressable></View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text selectable style={styles.code}>{tripId}</Text><CopyTripIdButton tripId={tripId}/>
          {busy && <ActivityIndicator color="#1976d2"/>}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {result?.id === tripId && !busy && !error && <>
            <Text style={styles.driver}>Tài xế: {result.trip.driverId || result.trip.driverVehicle ? result.trip.driverName || "Chưa cập nhật tên" : "Chưa có tài xế"}{result.trip.driverPhone ? ` · ${result.trip.driverPhone}` : ""}</Text>
            <TripVehicleInfo trip={result.trip}/>
          </>}
          <Pressable accessibilityRole="button" disabled={busy} onPress={()=>setRefresh(n=>n+1)} style={styles.button}><Text style={styles.link}>Tải lại</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>}
  </>;
}
const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#f8fafc"},header:{padding:16,flexDirection:"row",gap:8,alignItems:"center",justifyContent:"space-between"},
  title:{fontSize:20,fontWeight:"800",color:"#0f172a",flex:1},content:{padding:16,gap:14,paddingBottom:40},
  button:{paddingHorizontal:10,paddingVertical:8,alignSelf:"flex-start",backgroundColor:"#eff6ff",borderWidth:1,borderColor:"#bfdbfe",borderRadius:8},
  link:{fontSize:12,fontWeight:"700",color:"#1d4ed8"},code:{fontSize:13,color:"#64748b"},driver:{fontSize:16,color:"#0f172a"},error:{color:"#b91c1c"},
});
