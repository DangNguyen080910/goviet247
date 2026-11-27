import {quoteHistoryPickupAddresses, QUOTE_HISTORY_SOURCES as sources} from "../../api/src/shared/quoteHistoryRoute.js";
import TripVehicleButton from "../components/TripVehicleButton";
import TripCode from "../components/TripCode";
import {useCallback,useEffect,useState} from 'react';
import {router,useFocusEffect} from 'expo-router';
import {ActivityIndicator,Pressable,RefreshControl,ScrollView,StyleSheet,Switch,Text,TextInput,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import ClearableSearchInput from '../../mobile-chat/ClearableSearchInput';
import TripHistoryButton from '../components/TripHistoryButton';
import {getAdminUser} from '../services/storage';
import {fetchQuoteHistory,fetchQuoteHistorySettings,setQuoteHistoryEnabled,type QuoteFilters} from '../services/quoteHistoryApi';
import {historyTime,vietnamDay,historyDateInput,parseHistoryDateInput} from '../../api/src/shared/adminHistory.js';

const cars:Record<string,string>={CAR_5:'Xe 5 chỗ',CAR_7:'Xe 7 chỗ',CAR_16:'Xe 16 chỗ'};
const fuels:Record<string,string>={ANY:'Không yêu cầu',ELECTRIC:'Xe điện',GASOLINE:'Xe xăng'};
const money=(value:any)=>Number(value||0).toLocaleString('vi-VN');
const initial=():QuoteFilters=>({from:vietnamDay(),to:vietnamDay(),q:'',source:'',carType:''});
export default function QuoteHistoryScreen(){
  const [allowed,setAllowed]=useState(false),[filters,setFilters]=useState(initial),[draft,setDraft]=useState(()=>({...initial(),from:historyDateInput(vietnamDay()),to:historyDateInput(vietnamDay())}));
  const [page,setPage]=useState(1),[refresh,setRefresh]=useState(0),[data,setData]=useState<any>(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[validation,setValidation]=useState('');
  const [enabled,setEnabled]=useState<boolean|null>(null),[saving,setSaving]=useState(false),[settingError,setSettingError]=useState(''),[expanded,setExpanded]=useState('');
  useFocusEffect(useCallback(()=>{
    let active=true;
    getAdminUser().then(user=>{if(!active)return;if(user?.role?.toUpperCase()!=='ADMIN'){router.replace('/home');return;}setAllowed(true);setRefresh(n=>n+1);});
    return()=>{active=false;};
  },[]));
  useEffect(()=>{
    if(!allowed)return;
    let active=true;setBusy(true);setError('');setData(null);
    fetchQuoteHistory(filters,page).then(next=>{if(active)setData(next);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[allowed,filters,page,refresh]);
  useEffect(()=>{
    if(!allowed)return;let active=true;
    fetchQuoteHistorySettings().then(next=>{if(active){setEnabled(next.enabled);setSettingError('');}}).catch(e=>{if(active)setSettingError(e.message);});
    return()=>{active=false;};
  },[allowed,refresh]);
  function apply(){try{
    const from=parseHistoryDateInput(draft.from),to=parseHistoryDateInput(draft.to);
    if(from>to)throw Error('Từ ngày phải trước hoặc bằng Đến ngày.');
    setValidation('');setPage(1);setFilters({...draft,from,to,q:draft.q.trim()});setExpanded('');
  }catch(e:any){setValidation(e.message);}}
  function quickDays(offset:number){const next={...filters,from:vietnamDay(offset),to:vietnamDay()};setDraft({...next,from:historyDateInput(next.from),to:historyDateInput(next.to)});setFilters(next);setPage(1);setValidation('');}
  async function toggle(next:boolean){if(saving)return;setSaving(true);setSettingError('');try{const result=await setQuoteHistoryEnabled(next);setEnabled(result.enabled);}catch(e:any){setSettingError(e.message);}finally{setSaving(false);}}
  if(!allowed)return <SafeAreaView style={styles.screen}><ActivityIndicator/></SafeAreaView>;
  const stats=data?.stats || {};
  return <SafeAreaView style={styles.screen} edges={['top','bottom']}>
    <View style={styles.header}><Pressable accessibilityRole="button" onPress={()=>router.back()}><Text style={styles.link}>‹ Quay lại</Text></Pressable><Text style={styles.title}>Lịch sử tính giá</Text></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={busy} onRefresh={()=>setRefresh(n=>n+1)}/>}>
      <Text>Lượt khách tính giá thành công, kể cả chưa đặt chuyến. Thời gian Việt Nam.</Text>
      <View style={styles.card}><View style={styles.row}><Text style={styles.bold}>Ghi lịch sử: {enabled===null?'Đang tải':enabled?'Bật':'Tắt'}</Text><Switch value={enabled===true} disabled={enabled===null || saving} onValueChange={next=>void toggle(next)}/></View>
        <Text style={styles.hint}>Tắt chỉ ngừng ghi mới. Khách vẫn tính giá bình thường; lịch sử cũ xem được và tự dọn sau 90 ngày.</Text>
        {!!settingError && <Text style={styles.error}>{settingError}</Text>}
      </View>
      <View style={styles.card}>
        <View style={styles.row}><Pressable style={styles.button} onPress={()=>quickDays(0)}><Text style={styles.link}>Hôm nay</Text></Pressable><Pressable style={styles.button} onPress={()=>quickDays(-6)}><Text style={styles.link}>7 ngày gần đây</Text></Pressable><Pressable style={styles.button} onPress={()=>setRefresh(n=>n+1)}><Text style={styles.link}>Làm mới</Text></Pressable></View>
        <Text>Từ ngày (dd/mm/yyyy)</Text><TextInput accessibilityLabel="Từ ngày" value={draft.from} onChangeText={from=>setDraft(v=>({...v,from}))} placeholder="dd/mm/yyyy" style={styles.input}/>
        <Text>Đến ngày (dd/mm/yyyy)</Text><TextInput accessibilityLabel="Đến ngày" value={draft.to} onChangeText={to=>setDraft(v=>({...v,to}))} placeholder="dd/mm/yyyy" style={styles.input}/>
        <ClearableSearchInput accessibilityLabel="Tìm lịch sử tính giá" placeholder="Tên, SĐT, điểm đón, mã chuyến" value={draft.q} onChangeText={q=>setDraft(v=>({...v,q}))}
          onClear={()=>{setDraft(v=>({...v,q:''}));setFilters(v=>({...v,q:''}));setPage(1);}} style={styles.input} onSubmitEditing={apply}/>
        <Text style={styles.bold}>Nguồn</Text><View style={styles.row}>{[['','Tất cả'],...Object.entries(sources)].map(([value,label])=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:draft.source===value}} onPress={()=>setDraft(v=>({...v,source:value}))} style={[styles.pill,draft.source===value&&styles.selected]}><Text style={draft.source===value?styles.white:styles.link}>{label}</Text></Pressable>)}</View>
        <Text style={styles.bold}>Loại xe</Text><View style={styles.row}>{[['','Tất cả'],...Object.entries(cars)].map(([value,label])=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:draft.carType===value}} onPress={()=>setDraft(v=>({...v,carType:value}))} style={[styles.pill,draft.carType===value&&styles.selected]}><Text style={draft.carType===value?styles.white:styles.link}>{label}</Text></Pressable>)}</View>
        {!!validation&&<Text style={styles.error}>{validation}</Text>}<Pressable accessibilityRole="button" onPress={apply} style={[styles.button,styles.selected]}><Text style={styles.white}>Áp dụng bộ lọc</Text></Pressable>
      </View>
      {busy&&<ActivityIndicator color="#1976d2"/>}{!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {data&&<>
        <View style={styles.row}>{[['Lượt tính giá',stats.total],['Lượt hôm nay trong bộ lọc',stats.todayQuotes],['Khách/thiết bị nhận diện',stats.uniqueCustomers],['Tài khoản đã đăng nhập',stats.loggedInCustomers],['Lượt đã đặt chuyến',stats.bookedQuotes]].map(([label,value])=><View key={label} style={styles.stat}><Text>{label}</Text><Text style={styles.number}>{money(value)}</Text></View>)}</View>
        <Text style={styles.notice}>Đây là lượt tính giá thành công, không phải số người mở app. Một khách có thể tính nhiều lần. Khách/thiết bị là ước tính; không tính thêm {stats.unidentifiedQuotes||0} lượt chưa nhận diện. Tên/SĐT trong form do khách nhập. “Đã đặt” chỉ tính chuyến liên kết trực tiếp với lần tính giá.</Text>
        {!data.items?.length&&<Text>Chưa có lịch sử phù hợp.</Text>}
        {data.items?.map((item:any)=><View key={item.id} style={styles.card}>
          <Text style={styles.time}>{historyTime(item.createdAt)} · {sources[item.source as keyof typeof sources] || 'Chưa xác định'}</Text>
          <Text selectable style={styles.bold}>{item.customerName || 'Khách chưa xác định'}{item.customerPhone?` · ${item.customerPhone}`:''}</Text>
          <Text>{item.identityVerified?'Đã đăng nhập':'Khách vãng lai'}</Text>
          {item.pickupAddress ? quoteHistoryPickupAddresses(item).map((address,index)=>
            <Text key={index}>Điểm đón{item.additionalPickups?.length > 0 ? ` ${index+1}` : ''}: {address}</Text>)
            : <Text>Điểm đón: Chưa được cung cấp</Text>}
          <Text style={styles.price}>{money(item.finalPrice)} đ · {cars[item.carType] || item.carType}</Text>
          <Text>{item.tripId?'Đã liên kết chuyến đặt':'Chưa ghi nhận đặt chuyến'}</Text>
          <Pressable accessibilityRole="button" onPress={()=>setExpanded(expanded===item.id?'':item.id)} style={styles.button}><Text style={styles.link}>{expanded===item.id?'Thu gọn':'Xem chi tiết lần tính giá'}</Text></Pressable>
          {expanded===item.id&&<>
            {item.stops?.length?item.stops.map((stop:string,index:number)=><Text key={index}>Điểm đến {index+1}: {stop}</Text>):<Text>Điểm đến: Chưa được cung cấp</Text>}
            <Text>{item.direction==='ROUND_TRIP'?'Khứ hồi':'Một chiều'} · {fuels[item.fuelPreference] || item.fuelPreference}</Text>
            <Text>Giờ đón: {historyTime(item.pickupTime)}{item.returnTime?` · Giờ về: ${historyTime(item.returnTime)}`:''}</Text>
            <Text>{Number(item.distanceKm).toLocaleString('vi-VN',{maximumFractionDigits:1})} km · Lái dự kiến: {item.driveMinutes??'—'} phút</Text>
            <Text selectable>Tài khoản: {item.userId || 'Khách vãng lai'}</Text>
            {item.tripId&&<><TripCode tripId={item.tripId}/><Text>Đặt lúc: {historyTime(item.bookedAt)}</Text>
              <View style={styles.row}><Pressable style={styles.button} onPress={()=>router.push({pathname:'/assigned-trips',params:{tripId:item.tripId,focusRequest:String(Date.now())}})}><Text style={styles.link}>Xem chuyến</Text></Pressable><TripHistoryButton tripId={item.tripId}/><TripVehicleButton tripId={item.tripId}/></View></>}
          </>}
        </View>)}
        <View style={styles.row}><Pressable accessibilityRole="button" disabled={busy||page<=1} style={styles.button} onPress={()=>{setPage(p=>p-1);setExpanded('');}}><Text style={[styles.link,page<=1&&styles.disabled]}>Trước</Text></Pressable><Text>Trang {page}/{Math.max(1,data.totalPages || 0)} · {money(stats.total)} lượt</Text><Pressable accessibilityRole="button" disabled={busy||page>=data.totalPages} style={styles.button} onPress={()=>{setPage(p=>p+1);setExpanded('');}}><Text style={[styles.link,page>=data.totalPages&&styles.disabled]}>Sau</Text></Pressable></View>
      </>}
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:'#f8fafc'},header:{padding:16,gap:12},title:{fontSize:24,fontWeight:'800',color:'#0f172a'},content:{padding:16,gap:14,paddingBottom:40},card:{backgroundColor:'white',padding:16,gap:12,borderRadius:12,borderWidth:1,borderColor:'#e2e8f0'},row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:10},bold:{fontWeight:'700',fontSize:16},hint:{fontSize:13,lineHeight:20,color:'#475569'},link:{color:'#1d4ed8',fontWeight:'700'},button:{padding:10,borderRadius:8,borderWidth:1,borderColor:'#bfdbfe',alignSelf:'flex-start'},pill:{padding:9,borderRadius:20,borderWidth:1,borderColor:'#bfdbfe'},selected:{backgroundColor:'#1976d2'},white:{color:'white',fontWeight:'700'},input:{borderWidth:1,borderColor:'#cbd5e1',borderRadius:8,padding:12,color:'#0f172a'},error:{color:'#b91c1c',lineHeight:22},notice:{backgroundColor:'#eff6ff',padding:14,lineHeight:21,color:'#334155'},stat:{backgroundColor:'white',borderWidth:1,borderColor:'#e2e8f0',borderRadius:10,padding:12,minWidth:140,flexGrow:1},number:{fontSize:24,fontWeight:'800',color:'#0f172a',marginTop:8},time:{color:'#1d4ed8',fontWeight:'700'},price:{fontWeight:'800',fontSize:18,color:'#c2410c'},disabled:{color:'#94a3b8'}});
