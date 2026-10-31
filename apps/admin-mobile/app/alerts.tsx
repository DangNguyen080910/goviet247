import { useCallback, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdminAlert, blockedAlertDriverId, fetchAdminAlerts, markAdminAlertRead } from "../services/adminAlertsApi";
import { connectAdminSocket, offAdminRealtimeEvent, onAdminRealtimeEvent } from "../services/adminSocket";
export default function AlertsScreen() {
  const [items,setItems]=useState<AdminAlert[]>([]);
  const [read,setRead]=useState<"all"|"unread"|"read">("unread");
  const [q,setQ]=useState(""); const [loading,setLoading]=useState(false);
  const [error,setError]=useState(""); const [saving,setSaving]=useState("");
  const request=useRef(0);
  const load=useCallback(async()=>{
    const id=++request.current; setLoading(true); setError("");
    try {const rows=await fetchAdminAlerts(read);if(id===request.current)setItems(rows);}
    catch(e:any){if(id===request.current)setError(e.message||"Không tải được cảnh báo.");}
    finally{if(id===request.current)setLoading(false);}
  },[read]);
  useFocusEffect(useCallback(()=>{
    let active=true; let subscribed=false;
    const refresh=()=>{void load();}; void load();
    void connectAdminSocket().then(socket=>{
      if(!active||!socket)return;
      onAdminRealtimeEvent("admin:blocked_trip_accept_attempt",refresh);
      onAdminRealtimeEvent("admin:alerts_read",refresh);
      onAdminRealtimeEvent("admin:dashboard_changed",refresh);subscribed=true;
    }).catch(()=>{});
    const timer=setInterval(refresh,30000);
    return()=>{active=false;request.current++;clearInterval(timer);if(subscribed){
      offAdminRealtimeEvent("admin:blocked_trip_accept_attempt",refresh);offAdminRealtimeEvent("admin:alerts_read",refresh);offAdminRealtimeEvent("admin:dashboard_changed",refresh);
    }};
  },[load]));
  const visible=useMemo(()=>items.filter(item=>`${item.tripId} ${item.message}`.toLocaleLowerCase().includes(q.trim().toLocaleLowerCase())),[items,q]);
  async function mark(item:AdminAlert){
    if(saving)return;setSaving(item.id);
    try{await markAdminAlertRead(item.id);await load();}catch(e:any){Alert.alert("Chưa lưu được",e.message);}finally{setSaving("");}
  }
  return <SafeAreaView style={{flex:1,backgroundColor:"#f1f5f9"}}>
    <View style={{padding:16,flexDirection:"row",alignItems:"center",gap:16}}><Pressable onPress={()=>router.replace("/home")} accessibilityRole="button"><Text style={{fontSize:28}}>‹</Text></Pressable><Text style={{fontSize:23,fontWeight:"800"}}>Cảnh Báo</Text></View>
    <ScrollView contentContainerStyle={{padding:16,gap:12,paddingBottom:70}} refreshControl={<RefreshControl refreshing={loading} onRefresh={load}/>}>
      <Text>Chuyến chờ lâu và tài xế bị khoá bấm nhận chuyến. Trạng thái đã xem dùng chung với Admin Web.</Text>
      <TextInput accessibilityLabel="Tìm cảnh báo" placeholder="Tìm mã chuyến hoặc tài xế" value={q} onChangeText={setQ} style={{backgroundColor:"white",padding:12,borderRadius:10}}/>
      <View style={{flexDirection:"row",gap:8}}>{([['unread','Chưa xem'],['read','Đã xem'],['all','Tất cả']] as const).map(([value,label])=><Pressable accessibilityRole="button" key={value} onPress={()=>setRead(value)} style={{padding:10,borderRadius:8,backgroundColor:read===value?"#1976d2":"#e2e8f0"}}><Text style={{color:read===value?"white":"#334155"}}>{label}</Text></Pressable>)}</View>
      <Text style={{color:"#64748b"}}>Hiển thị tối đa 200 cảnh báo mới nhất theo bộ lọc. Số trên Trang chủ chỉ đếm cảnh báo chưa xem trong 24 giờ.</Text>
      {!!error&&<Text style={{color:"#b91c1c"}}>{error}</Text>}
      {loading&&!items.length&&<ActivityIndicator/>}
      {!loading&&!visible.length&&!error&&<Text>Không có cảnh báo phù hợp.</Text>}
      {visible.map(item=>{
        const driverId=blockedAlertDriverId(item);
        return <View key={item.id} style={{backgroundColor:"white",padding:16,borderRadius:12,gap:10,borderLeftWidth:4,borderLeftColor:item.readAt?"#16a34a":"#f97316"}}>
          <Text style={{fontWeight:"800",fontSize:16}}>{driverId?"Tài xế bị khoá bấm nhận chuyến":item.alertType==="TRIP_MILESTONE"?"Mốc chuyến GoViet247":"Cảnh báo chuyến"}</Text>
          <Text selectable>Mã chuyến: {item.tripId}</Text><Text>{new Date(item.sentAt).toLocaleString("vi-VN")}</Text>
          <Text style={{fontSize:15,lineHeight:23}}>{item.message}</Text>
          {!!driverId&&<Pressable accessibilityRole="button" onPress={()=>router.push({pathname:"/drivers",params:{driverProfileId:driverId}})} style={{backgroundColor:"#1976d2",padding:12,borderRadius:8}}><Text style={{color:"white",fontWeight:"700"}}>Mở hồ sơ tài xế để kiểm tra / mở khoá</Text></Pressable>}
          {item.readAt?<Text style={{color:"#15803d"}}>Đã xem • {item.readBy||"Admin"} • {new Date(item.readAt).toLocaleString("vi-VN")}</Text>:<Pressable disabled={!!saving} onPress={()=>void mark(item)} style={{padding:10}}><Text style={{color:"#1976d2",fontWeight:"700"}}>{saving===item.id?"Đang lưu…":"Đánh dấu đã xem"}</Text></Pressable>}
        </View>;
      })}
    </ScrollView>
  </SafeAreaView>;
}
