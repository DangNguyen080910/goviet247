import {useEffect,useState} from 'react';
import {AppState,Text,TouchableOpacity,View} from 'react-native';
import {router} from 'expo-router';
import {getDriverContract,type DriverContractResponse} from '../services/driverProfileApi';
import {getDriverToken} from '../services/storage';
export default function ContractReminder(){
 const [data,setData]=useState<DriverContractResponse|null>(null);
 useEffect(()=>{let alive=true;async function load(){try{const token=await getDriverToken();if(!token)return;const next=await getDriverContract(token);if(alive)setData(next);}catch{if(alive)setData(null);}}
 void load();const sub=AppState.addEventListener('change',s=>{if(s==='active')void load();});const timer=setInterval(()=>void load(),60000);return()=>{alive=false;sub.remove();clearInterval(timer);};},[]);
 if(!data?.release||!data.needsAcceptance)return null;
 return <View style={{padding:16,marginBottom:14,borderRadius:12,backgroundColor:'#FFF4DB',borderColor:'#E8C16C',borderWidth:1}}><Text style={{fontWeight:'800',fontSize:17,color:'#713F12'}}>Hợp đồng hợp tác đã được cập nhật</Text><Text style={{marginTop:8,color:'#713F12'}}>Phiên bản {data.contract.version}. {data.release.changeSummary}</Text><Text style={{marginVertical:8,color:'#713F12'}}>{data.release.requireForNewTrips?'Vui lòng xác nhận trước '+new Date(data.release.deadline).toLocaleString('vi-VN', { timeZone: "Asia/Ho_Chi_Minh", hour12: false, day: "2-digit", month: "2-digit", year: "numeric" })+' để tiếp tục nhận chuyến mới. Các chuyến đã nhận vẫn tiếp tục.':'Vui lòng đọc và xác nhận nội dung mới. Bạn vẫn có thể nhận chuyến.'}</Text><TouchableOpacity accessibilityRole="button" onPress={()=>router.push('/driver-contract' as any)} style={{padding:12,backgroundColor:'#1676D2',borderRadius:8}}><Text style={{color:'white',fontWeight:'700',textAlign:'center'}}>Xem và xác nhận hợp đồng</Text></TouchableOpacity></View>;
}
