import {tripCallActionLabel} from '../api/src/shared/tripCallLabels.js';
import {setChatCallActive} from './chatAlerts';
import React, {useEffect, useState} from 'react';
import {Alert, AppState, Modal, Platform, Pressable, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {requireOptionalNativeModule} from 'expo';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import {Feather} from '@expo/vector-icons';

type Config={base:string;getToken:()=>Promise<string|null>;role:'RIDER'|'DRIVER'|'ADMIN'};
type Call={id:string;tripId?:string;status:string;side?:string;callerLabel?:string;calleeLabel?:string;startedAt?:string};
type Snapshot={call?:Call;joined?:boolean;muted?:boolean;speaker?:boolean;error?:string;configured?:boolean};
const availableNative=Platform.OS!=='web'?requireOptionalNativeModule('GoVietTripCalling'):null;
const native=availableNative?.supported===false?null:availableNative;
let config:Config, device='', configuredToken='', declinedToken='', configuring:Promise<boolean>|null=null;
let sessionEpoch=0;
let current:Snapshot={};
const listeners=new Set<(value:Snapshot)=>void>();
const notice='Cuộc gọi được ghi âm để hỗ trợ xử lý chuyến. Chỉ admin GoViet247 được nghe lại. Bạn đồng ý bật cuộc gọi và ghi âm khi tham gia?';
const live=['RINGING','CONNECTING','CONNECTED'];
export function configureCalls(value:Config){config=value;}
function publish(value:Snapshot){setChatCallActive(!!value.call?.id);current=value;listeners.forEach(fn=>fn(value));}
async function deviceId(){
 if(device)return device;
 device=await SecureStore.getItemAsync('goviet_call_device_v1')||`call_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
 await SecureStore.setItemAsync('goviet_call_device_v1',device);return device;
}
async function request(path:string,body?:object){
 const token=await config.getToken();if(!token)throw new Error('Vui lòng đăng nhập lại.');
 const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),18000);
 try{
  const response=await fetch(`${config.base}/api/trip-calls${path}`,{method:body?'POST':'GET',signal:abort.signal,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.message||'Không kết nối được cuộc gọi.'),{code:data.code});return data;
 }finally{clearTimeout(timeout);}
}
async function ensureConfigured(force=false):Promise<boolean>{
 if(!native||!config||config.role==='ADMIN')return false;
 const token=await config.getToken();
 if(!token){await clearCallSession();return false;}
 if(configuredToken===token)return true;
 if(!force&&declinedToken===token)return false;
 if(configuring)return configuring;
 const epoch=sessionEpoch;
 configuring=(async()=>{
  const deviceIdValue=await deviceId();
  // Do not prompt or register until the API feature is deliberately enabled.
  await request(`/incoming?deviceId=${encodeURIComponent(deviceIdValue)}`);
  if(!await native.matchesSession(token)){
   const agree=await new Promise<boolean>(resolve=>Alert.alert('Bật cuộc gọi GoViet247',notice,[{text:'Để sau',style:'cancel',onPress:()=>resolve(false)},{text:'Đồng ý',onPress:()=>resolve(true)}],{cancelable:false}));
   if(!agree){declinedToken=token;return false;}
   if(!await native.microphone()){Alert.alert('Chưa đủ quyền gọi',Platform.OS==='android'?'Bạn mở Cài đặt để cho phép GoViet247 dùng micro và hiển thị thông báo cuộc gọi.':'Bạn mở Cài đặt để cho phép GoViet247 dùng micro khi gọi.');declinedToken=token;return false;}
  }
  // Consent dialogs and permission sheets can outlive a logout/account switch.
  if(epoch!==sessionEpoch||await config.getToken()!==token)return false;
  const androidToken=Platform.OS==='android'?(await Notifications.getExpoPushTokenAsync({projectId:Constants.easConfig?.projectId||Constants.expoConfig?.extra?.eas?.projectId})).data:undefined;
  if(epoch!==sessionEpoch||await config.getToken()!==token)return false;
  await native.configure({...(androidToken?{pushToken:androidToken}:{}),base:config.base.replace(/\/$/,''),token,deviceId:deviceIdValue,appKind:config.role,environment:Platform.OS==='android'?'android-expo':process.env.EXPO_PUBLIC_TRIP_CALL_APNS_ENV||(__DEV__?'sandbox':'production')});
  if(epoch!==sessionEpoch){await native.clear();return false;}
  configuredToken=token;return true;
 })().finally(()=>{configuring=null;});
 return configuring;
}
export async function clearCallSession(){
 sessionEpoch++;configuredToken='';declinedToken='';publish({});if(native)await native.clear();
}
function useSnapshot(){const [value,setValue]=useState(current);useEffect(()=>{listeners.add(setValue);return()=>{listeners.delete(setValue);};},[]);return value;}
export function useTripCallActive(){return !!useSnapshot().call?.id;}
export function TripCallButton({tripId}:{tripId:string}){
 const [eligible,setEligible]=useState<{canCall:boolean;label?:string;reason?:string;showUnavailable?:boolean}|null>(null),[starting,setStarting]=useState(false);
 const snapshot=useSnapshot();
 useEffect(()=>{
  let alive=true,loading=false;setEligible(null);
  async function check(){if(!native||!tripId||!config||config.role==='ADMIN'||AppState.currentState!=='active'||loading)return;loading=true;try{const result=await request(`/trip/${encodeURIComponent(tripId)}`);if(alive)setEligible(result);}catch{if(alive)setEligible(null);}finally{loading=false;}}
  void check();const timer=setInterval(check,10000);const sub=AppState.addEventListener('change',state=>{if(state==='active')void check();});
  return()=>{alive=false;clearInterval(timer);sub.remove();};
 },[tripId]);
 if(!native||!eligible || (!eligible.canCall&&!eligible.showUnavailable))return null;
 if(!eligible.canCall)return <View style={{maxWidth:170,padding:4}}><Text style={{fontSize:11,color:"#64748b"}}>☎ {eligible.reason}</Text></View>;
 async function start(){
  if(starting||snapshot.call?.id)return;
  setStarting(true);
  try{
   if(!await ensureConfigured(true))return;
   const yes=await new Promise<boolean>(resolve=>Alert.alert(`Gọi ${eligible?.label||'liên hệ chuyến'}`,'Cuộc gọi qua internet có ghi âm. Chỉ admin GoViet247 được nghe lại.',[{text:'Hủy',style:'cancel',onPress:()=>resolve(false)},{text:'Gọi',onPress:()=>resolve(true)}],{cancelable:false}));
   if(!yes)return;
   const deviceIdValue=await deviceId(),token=await config.getToken();
   if(!token||token!==configuredToken)return;
   const data=await request(`/trip/${encodeURIComponent(tripId)}`,{deviceId:deviceIdValue,clientId:`call_${Date.now()}_${Math.random().toString(36).slice(2,14)}`,consent:true});
   try{await native.outgoing(data.call);publish(await native.snapshot());}
   catch(error){await request(`/${encodeURIComponent(data.call.id)}/end`,{deviceId:deviceIdValue}).catch(()=>{});throw error;}
  }catch(error:any){Alert.alert('Chưa gọi được',error.message||'Vui lòng thử lại.');}
  finally{setStarting(false);}
 }
 return <Pressable accessibilityRole="button" accessibilityLabel={`${tripCallActionLabel(eligible.label)} qua Internet`} disabled={starting||!!snapshot.call?.id} onPress={()=>void start()} style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center',gap:3,paddingHorizontal:4,opacity:starting||snapshot.call?.id?0.4:1}}><Feather name="phone" size={23} color="#2563eb"/><Text style={{fontSize:11,color:'#2563eb',fontWeight:'600'}}>{tripCallActionLabel(eligible.label)}</Text></Pressable>;
}
export function TripCallOverlay(){
 const snapshot=useSnapshot(),[now,setNow]=useState(Date.now());
 useEffect(()=>{
  if(!native)return;
  let alive=true,reading=false,syncing=false,lastError='';
  async function read(){if(reading||AppState.currentState!=='active')return;reading=true;try{const value:Snapshot=await native.snapshot();if(alive){publish(value);setNow(Date.now());if(value.error&&value.error!==lastError){lastError=value.error;Alert.alert('Cuộc gọi',value.error);}}}finally{reading=false;}}
  async function sync(){if(syncing||AppState.currentState!=='active'||!config)return;syncing=true;try{await ensureConfigured();}catch{/* Feature remains hidden while API is disabled/offline. */}finally{syncing=false;}}
  void sync();void read().catch(()=>{});const readTimer=setInterval(()=>void read().catch(()=>{}),1000),syncTimer=setInterval(()=>void sync(),10000);
  const sub=AppState.addEventListener('change',s=>{if(s==='active'){void sync();void read().catch(()=>{});}});
  return()=>{alive=false;clearInterval(readTimer);clearInterval(syncTimer);sub.remove();};
 },[]);
 const call=snapshot.call,visible=!!call?.id&&live.includes(call.status);
 if(!visible||!call)return null;
 const incoming=call.side==='callee'&&call.status==='RINGING';
 const seconds=call.startedAt?Math.max(0,Math.floor((now-Date.parse(call.startedAt))/1000)):0;
 const status=call.status==='CONNECTED'?`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:incoming?'Cuộc gọi đến':call.status==='RINGING'?'Đang gọi…':'Đang kết nối…';
 const action=async(fn:()=>Promise<unknown>)=>{try{await fn();}catch(error:any){Alert.alert('Cuộc gọi',error.message||'Vui lòng thử lại.');}};
 const circle=(label:string,icon:React.ComponentProps<typeof Feather>['name'],onPress:()=>void,color='#334155',selected=false)=><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected}} onPress={onPress} style={{alignItems:'center',gap:10,minWidth:85}}><View style={{width:66,height:66,borderRadius:33,alignItems:'center',justifyContent:'center',backgroundColor:color}}><Feather name={icon} size={27} color="white"/></View><Text style={{color:'white',fontSize:14}}>{label}</Text></Pressable>;
 return <Modal visible animationType="fade" onRequestClose={()=>{}}><SafeAreaView style={{flex:1,backgroundColor:'#0f172a',padding:24,justifyContent:'space-between'}}><Text style={{color:'#fb923c',fontSize:22,fontWeight:'800',textAlign:'center'}}>GoViet247</Text><View style={{alignItems:'center',gap:20}}><View style={{backgroundColor:'#334155',padding:30,borderRadius:70}}><Feather name="user" color="white" size={58}/></View><Text style={{color:'white',fontSize:28,fontWeight:'700',textAlign:'center'}}>{call.side==='caller'?call.calleeLabel:call.callerLabel}</Text><Text accessibilityLiveRegion="polite" style={{color:'#cbd5e1',fontSize:19}}>{status}</Text><Text style={{color:'#cbd5e1',textAlign:'center',lineHeight:22}}>Cuộc gọi qua internet · Có ghi âm{`\n`}Chỉ admin GoViet247 được nghe lại</Text></View><View style={{gap:35,paddingBottom:24}}>{!incoming&&<View style={{flexDirection:'row',justifyContent:'space-evenly'}}>{circle(snapshot.muted?'Bật micro':'Tắt micro',snapshot.muted?'mic-off':'mic',()=>void action(()=>native.mute(!snapshot.muted)),snapshot.muted?'#ea580c':'#334155',!!snapshot.muted)}{circle('Loa ngoài','volume-2',()=>void action(()=>native.speaker(!snapshot.speaker)),snapshot.speaker?'#ea580c':'#334155',!!snapshot.speaker)}</View>}<View style={{flexDirection:'row',justifyContent:'space-evenly'}}>{circle(incoming?'Từ chối':'Kết thúc','phone-off',()=>void action(()=>native.end()),'#dc2626')}{incoming&&circle('Nghe máy','phone',()=>void action(()=>native.answer()),'#16a34a')}</View></View></SafeAreaView></Modal>;
}
