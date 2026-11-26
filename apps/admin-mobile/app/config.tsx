import {useCallback,useRef,useState} from 'react';
import {router,useFocusEffect} from 'expo-router';
import {ActivityIndicator,Pressable,ScrollView,Switch,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {getAdminUser} from '../services/storage';
import {AutoApprovalConfig,AutoApprovalField,getAutoApprovalConfig,setAutoApprovalConfig} from '../services/tripAutoApprovalApi';

const controls:[AutoApprovalField,string,string][]=[
  ['autoApproveNewTrips','Tự duyệt chuyến mới','Sau khi khách xác thực và đặt chuyến thành công.'],
  ['autoApproveRequeuedTrips','Tự duyệt lại chuyến tài xế huỷ','Khi tài xế huỷ hoặc điều hành đưa chuyến tài xế huỷ về chờ duyệt để tìm tài xế khác.'],
];
export default function ConfigScreen() {
  const [config,setConfig]=useState<AutoApprovalConfig|null>(null),[busy,setBusy]=useState(true),[allowed,setAllowed]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
  const active=useRef(false),mutation=useRef(false),generation=useRef(0);
  const load=useCallback(async()=>{
    if(mutation.current)return;
    const current=++generation.current;setBusy(true);
    try {
      const user=await getAdminUser();const admin=user?.role === 'ADMIN';
      if(!active.current || current !== generation.current)return;setAllowed(admin);
      if(!admin){setConfig(null);return;}
      const latest=await getAutoApprovalConfig();if(active.current && current === generation.current){setConfig(latest);setError('');}
    }catch(e:any){if(active.current && current === generation.current){setConfig(null);setError(e.message || 'Không tải được cấu hình.');}}
    finally{if(active.current && current === generation.current)setBusy(false);}
  },[]);
  useFocusEffect(useCallback(()=>{active.current=true;void load();return()=>{active.current=false;};},[load]));
  async function toggle(field:AutoApprovalField,value:boolean) {
    if(!allowed || !config || mutation.current)return;
    const current=++generation.current;mutation.current=true;setBusy(true);setError('');setSaved('');
    try{const latest=await setAutoApprovalConfig(field,value,config.updatedAt);if(active.current && current === generation.current){setConfig(latest);setSaved('Đã lưu. Áp dụng cho yêu cầu phát sinh từ bây giờ.');}}
    catch(e:any){if(active.current && current === generation.current)setError(e.message || 'Chưa xác nhận được thay đổi. Hãy tải lại để kiểm tra.');try{const latest=await getAutoApprovalConfig();if(active.current && current === generation.current)setConfig(latest);}catch{if(active.current && current === generation.current)setConfig(null);}}
    finally{mutation.current=false;if(active.current && current === generation.current)setBusy(false);}
  }
  return <SafeAreaView style={{flex:1,backgroundColor:'#f8fafc'}}><ScrollView contentContainerStyle={{padding:16,gap:16}}>
    <Pressable accessibilityRole="button" onPress={()=>router.back()}><Text style={{color:'#2563eb'}}>‹ Trở về</Text></Pressable>
    <Text style={{fontSize:24,fontWeight:'800'}}>Cấu Hình · Chuyến Đi</Text>
    {busy && <ActivityIndicator/>}
    {!busy && !allowed ? <Text>Chỉ Admin được xem và thay đổi cấu hình này.</Text> : allowed ? <>
      <Text>Phát cho tài xế đã xác nhận khu vực thuộc miền của điểm đón. Hai công tắc lưu ngay, hoạt động độc lập và mặc định tắt. Không tự xử lý chuyến cũ đang chờ.</Text>
      {!!error && <Text accessibilityRole="alert" style={{padding:12,color:'#b91c1c',backgroundColor:'#fef2f2',borderRadius:10}}>{error}</Text>}
      {!!saved && <Text style={{padding:12,color:'#166534',backgroundColor:'#f0fdf4',borderRadius:10}}>{saved}</Text>}
      {controls.map(([field,label,description])=><View key={field} style={{padding:16,backgroundColor:'#fff',borderRadius:14,borderWidth:1,borderColor:'#e2e8f0',gap:10}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:12}}><Text style={{fontWeight:'700',fontSize:17,flex:1}}>{label}</Text><Switch accessibilityLabel={label} disabled={busy || !config} value={config?.[field] === true} onValueChange={value=>toggle(field,value)}/></View>
        <Text style={{color:config?.[field] ? '#15803d' : '#64748b'}}>{!config ? 'Chưa tải' : config[field] ? 'Đang bật' : 'Đang tắt'}</Text><Text>{description}</Text>
      </View>)}
      <Text style={{padding:14,backgroundColor:'#eff6ff',color:'#1e3a5f',borderRadius:12}}>Chỉ tự duyệt khi xác minh được mọi điểm đón/đến: số nhà, địa điểm cụ thể, hoặc ấp/thôn kèm xã và tỉnh. Địa chỉ quá chung, chưa rõ miền hoặc chưa có tài xế trong miền sẽ giữ chờ duyệt và báo điều hành. Bước sàng lọc không bảo đảm địa chỉ thực tế chính xác.</Text>
      <Text>Mỗi lần tự duyệt thành công đều có thông báo cập nhật chuyến và lưu lịch sử. Hoàn ví/ghi phạt khi huỷ giữ theo lựa chọn hiện tại.</Text>
      <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void load()} style={{padding:14,backgroundColor:'#2563eb',borderRadius:10,opacity:busy?0.5:1}}><Text style={{textAlign:'center',color:'white',fontWeight:'700'}}>Tải lại trạng thái</Text></Pressable>
    </> : null}
  </ScrollView></SafeAreaView>;
}
