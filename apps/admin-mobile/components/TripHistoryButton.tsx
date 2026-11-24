import TripVehicleButton from "./TripVehicleButton";
import TripCode from "./TripCode";
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminRequest } from '../services/adminRequest';
import { tripEventTitles, historyResolutions, historySources, historyTime, historyActor, historyStatus, historyValue, historyEventColor } from '../../api/src/shared/adminHistory.js';

export default function TripHistoryButton({tripId}: {tripId?: string | null}) {
  const [open,setOpen] = useState(false), [refresh,setRefresh] = useState(0);
  const [data,setData] = useState<any>(null), [error,setError] = useState(''), [busy,setBusy] = useState(false);
  useEffect(()=>{
    if (!open || !tripId) return;
    let active = true; setBusy(true); setData(null); setError('');
    adminRequest(`/api/admin/trips/${encodeURIComponent(tripId)}/history`,{cache:'no-store'})
      .then(next=>{if(active)setData(next);}).catch(e=>{if(active)setError(e.message || 'Không tải được lịch sử.');})
      .finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[open,tripId,refresh]);
  if (!tripId) return null;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Lịch sử chuyến ${tripId}`}
      onPress={e=>{e.stopPropagation();setOpen(true);}} style={styles.button}><Text style={styles.link}>Lịch sử chuyến</Text></Pressable>
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setOpen(false)}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}><Text style={styles.title}>Lịch sử chuyến</Text><Pressable accessibilityRole="button" onPress={()=>setOpen(false)} style={styles.button}><Text style={styles.link}>Đóng</Text></Pressable></View>
        <ScrollView contentContainerStyle={styles.content}>
          <TripCode tripId={tripId}/><TripVehicleButton tripId={tripId}/>
          <Text>Thời gian Việt Nam · Mới nhất trước</Text>
          <Pressable accessibilityRole="button" disabled={busy} onPress={()=>setRefresh(n=>n+1)} style={styles.button}><Text style={styles.link}>Tải lại</Text></Pressable>
          {busy && <ActivityIndicator color="#1976d2"/>}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {data && <><Text style={styles.notice}>{data.notice}</Text>
            {data.limited && <Text style={styles.error}>Lịch sử dài; đang hiển thị các bản ghi gần nhất còn tra cứu được.</Text>}
            {!data.items?.length && <Text>Chưa có lịch sử cho chuyến này.</Text>}
            {data.items?.map((item:any)=><View key={item.id} style={[styles.card,{borderLeftColor:historyEventColor(item)}]}>
              <Text style={styles.event}>{tripEventTitles[item.kind as keyof typeof tripEventTitles] || item.kind}</Text>
              <Text style={styles.time}>{historyTime(item.createdAt)}</Text>
              {item.driverId && <Text selectable style={styles.name}>{item.driverName || 'Chưa lưu tên tài xế'}</Text>}
              {item.driverPhone && <Text selectable>{item.driverPhone}</Text>}
              {item.driverId && <Text selectable style={styles.code}>Mã tài xế: {item.driverId}</Text>}
              <Text>Thực hiện: {historyActor(item)}</Text>
              {item.fromStatus && item.toStatus && item.fromStatus !== item.toStatus && <Text>{historyStatus(item.fromStatus)} → {historyStatus(item.toStatus)}</Text>}
              {item.amount != null && <Text style={styles.name}>Số tiền: {Number(item.amount).toLocaleString('vi-VN')} đ</Text>}
              {item.changes?.map((change:any,index:number)=><View key={index} style={{backgroundColor:'#f8fafc',padding:10,gap:6}}><Text style={styles.name}>{change.label}</Text><Text selectable>Trước: {historyValue(change.before)}</Text><Text selectable>Sau: {historyValue(change.after)}</Text></View>)}
              {item.reason && <Text>Lý do/Ghi chú: {item.reason}</Text>}
              {item.resolution && <Text>{historyResolutions[item.resolution as keyof typeof historyResolutions] || item.resolution}</Text>}
              <Text style={styles.source}>{historySources[item.source as keyof typeof historySources] || item.source}</Text>
            </View>)}
          </>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#f8fafc'},header:{padding:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  title:{fontSize:19,fontWeight:'800',flex:1,color:'#0f172a'},content:{padding:16,gap:12,paddingBottom:40},
  button:{paddingVertical:8,paddingHorizontal:10,alignSelf:'flex-start',borderWidth:1,borderColor:'#bfdbfe',backgroundColor:'#eff6ff',borderRadius:8},
  link:{color:'#1d4ed8',fontSize:12,fontWeight:'700'},code:{fontSize:12,color:'#64748b'},error:{color:'#b91c1c'},
  notice:{backgroundColor:'#eff6ff',padding:12,color:'#334155',lineHeight:21},card:{padding:14,gap:8,backgroundColor:'white',borderRadius:10,borderLeftWidth:4},
  event:{fontSize:17,fontWeight:'800',color:'#0f172a'},time:{color:'#1d4ed8',fontWeight:'700'},name:{fontSize:16,fontWeight:'700'},source:{fontSize:12,color:'#64748b'},
});
