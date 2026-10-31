import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { adminRequest } from '../services/adminRequest';
import { matchesAudienceFilters, audienceFilterIds } from '../../api/src/shared/audienceFilters.js';
const CARS:Record<string,string>={CAR_5:'Xe 5 chỗ',CAR_7:'Xe 7 chỗ',CAR_16:'Xe 16 chỗ'};
const FUELS:Record<string,string>={ELECTRIC:'Xe điện',GASOLINE:'Xe xăng'};
type Candidate={userId:string;name:string;phone:string;plateNumber?:string;vehicleType?:string;carType?:string|null;vehicleFuelType?:string|null;suggestion?:{distanceKm:number;tripId:string}|null};
export default function TripAudiencePicker({tripId,onDone,disabled,onBusy}:{tripId:string;onDone:()=>void;disabled:boolean;onBusy:(busy:boolean)=>void}) {
  const [open,setOpen]=useState(false),[items,setItems]=useState<Candidate[]>([]),[selected,setSelected]=useState<string[]>([]),[q,setQ]=useState('');
  const [carType,setCarType]=useState(''),[fuelType,setFuelType]=useState('');
  const [info,setInfo]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  useEffect(()=>{setOpen(false);setItems([]);setSelected([]);setCarType('');setFuelType('');setQ('');},[tripId]);
  useEffect(()=>{
    if(!open)return;let active=true;
    setLoading(true);setError('');setInfo('');setItems([]);setSelected([]);setCarType('');setFuelType('');setQ('');
    adminRequest(`/api/trips/admin/trips/${tripId}/audience-candidates`).then(data=>{if(active){setItems(data.items);setInfo(`${data.config.radiusKm} km / ${data.config.days} ngày. ${data.warning}`);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[tripId,open]);
  const locked=busy||disabled||loading;
  function selectFilters(car:string,fuel:string){setCarType(car);setFuelType(fuel);setQ('');setError('');setSelected(audienceFilterIds(items,car,fuel));}
  const filtered=items.filter(d=>matchesAudienceFilters(d,carType,fuelType));
  const visible=filtered.filter(d=>`${d.name} ${d.phone} ${d.plateNumber}`.toLocaleLowerCase('vi').includes(q.toLocaleLowerCase('vi')));
  const limit=carType||fuelType?10000:100;
  const label=[CARS[carType],FUELS[fuelType]].filter(Boolean).join(' + ');
  async function submit(){
    if(locked||!selected.length||selected.length>limit)return;setBusy(true);onBusy(true);
    try{await adminRequest(`/api/trips/admin/trips/${tripId}/verify`,{method:'POST',body:JSON.stringify({audienceMode:carType||fuelType?'VEHICLE_FILTER':'SELECTED',driverIds:selected,...(carType?{carType}:{}),...(fuelType?{fuelType}:{}),note:label?`Duyệt nhóm ${label}, ${selected.length} tài xế`:'Duyệt cho tài xế chỉ định'})});onDone();}
    catch(e:any){Alert.alert('Không thể duyệt',e.message);}finally{setBusy(false);onBusy(false);}
  }
  function choice(text:string,chosen:boolean,onPress:()=>void,extraDisabled=false){return <Pressable accessibilityRole="button" accessibilityState={{selected:chosen,disabled:locked||extraDisabled}} disabled={locked||extraDisabled} onPress={onPress} style={{padding:10,borderRadius:8,backgroundColor:chosen?'#145ea8':'#e8f0fa',opacity:locked||extraDisabled?0.5:1}}><Text style={{color:chosen?'white':'#145ea8'}}>{text}</Text></Pressable>;}
  return <View style={{padding:12,borderWidth:1,borderColor:'#ccc',borderRadius:8,gap:10}}>
    <Pressable disabled={busy||disabled} onPress={()=>setOpen(!open)}><Text style={{color:'#145ea8',fontWeight:'700'}}>Duyệt cho tài xế chỉ định {open?'▴':'▾'}</Text></Pressable>
    {open&&<>
      <Text>{info||'Đang tải tài xế…'}</Text><Text>Chỉ người được chọn thấy chuyến. Người nhận trước chạy chuyến.</Text>
      {!!error&&<Text style={{color:'#b42318'}}>{error}</Text>}
      <Text style={{fontWeight:'700'}}>1. Số chỗ</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
        {choice('Tất cả số chỗ',!carType,()=>selectFilters('',fuelType))}
        {Object.entries(CARS).map(([value,text])=>{const count=items.filter(d=>matchesAudienceFilters(d,value,fuelType)).length;return <View key={value}>{choice(`${text} (${count})`,carType===value,()=>selectFilters(value,fuelType),!count)}</View>;})}
      </View>
      <Text style={{fontWeight:'700'}}>2. Nhiên liệu</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
        {choice('Tất cả nhiên liệu',!fuelType,()=>selectFilters(carType,''))}
        {Object.entries(FUELS).map(([value,text])=>{const count=items.filter(d=>matchesAudienceFilters(d,carType,value)).length;return <View key={value}>{choice(`${text} (${count})`,fuelType===value,()=>selectFilters(carType,value),!count)}</View>;})}
      </View>
      <Text>Chọn đồng thời sẽ lấy tài xế đáp ứng đủ cả hai điều kiện. Đổi bộ lọc sẽ chọn lại toàn bộ nhóm phù hợp; có thể bỏ chọn từng người.</Text>
      {choice('Chọn từng tài xế — xoá bộ lọc',!carType&&!fuelType,()=>selectFilters('',''))}
      <Text style={{fontWeight:'700'}}>Đã chọn: {selected.length} tài xế{label?' · '+label:''}</Text>
      {choice('Chọn tất cả trong bộ lọc',false,()=>setSelected(filtered.map(d=>d.userId)),!filtered.length)}
      {choice('Bỏ chọn hết',false,()=>setSelected([]),!selected.length)}
      {selected.length>limit&&<Text style={{color:'#b42318'}}>Tối đa {limit} tài xế mỗi lần.</Text>}
      <TextInput editable={!locked} placeholder="Tên, SĐT, biển số" value={q} onChangeText={setQ} style={{borderWidth:1,borderColor:'#ccc',padding:10}}/>
      {!loading&&!visible.length&&<Text>Không có tài xế đáp ứng đủ điều kiện.</Text>}
      {visible.map(d=><Pressable key={d.userId} disabled={locked} accessibilityRole="checkbox" accessibilityState={{checked:selected.includes(d.userId)}} onPress={()=>setSelected(s=>s.includes(d.userId)?s.filter(id=>id!==d.userId):[...s,d.userId])} style={{paddingVertical:10}}>
        <Text>{selected.includes(d.userId)?'☑':'☐'} {d.name} • {CARS[d.carType||'']||d.vehicleType||'Chưa rõ số chỗ'} • {FUELS[d.vehicleFuelType||'']||'Chưa cập nhật nhiên liệu'} • {d.phone} • {d.plateNumber}</Text>
        {!!d.suggestion&&<Text style={{color:'#147348'}}>Gợi ý: cách {d.suggestion.distanceKm} km • {d.suggestion.tripId}</Text>}
      </Pressable>)}
      <Text>Danh sách được chốt khi duyệt; tài xế đăng ký sau không tự được thêm.</Text>
      <Pressable disabled={locked||!selected.length||selected.length>limit} onPress={submit} style={{backgroundColor:'#145ea8',padding:12,opacity:locked||!selected.length||selected.length>limit?0.5:1}}><Text style={{color:'white'}}>{busy?'Đang duyệt…':`Duyệt cho ${selected.length} tài xế`}</Text></Pressable>
    </>}
  </View>;
}
