import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, Modal, FlatList, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminRequest } from '../services/adminRequest';
import { AUDIENCE_REGIONS, matchesAudienceFilters, audienceFilterIds } from '../../api/src/shared/audienceFilters.js';
import provinces from '../../api/src/data/vietnam-provinces.json';
const CARS:Record<string,string>={CAR_5:'Xe 5 chỗ',CAR_7:'Xe 7 chỗ',CAR_16:'Xe 16 chỗ'};
const FUELS:Record<string,string>={ELECTRIC:'Xe điện',GASOLINE:'Xe xăng'};
const ALL_REGIONS:string[]=AUDIENCE_REGIONS.map((region:{value:string})=>region.value);
type Candidate={userId:string;name:string;phone:string;plateNumber?:string;vehicleType?:string;carType?:string|null;vehicleFuelType?:string|null;operatingProvinceCode?:string;operatingProvinceConfirmedAt?:string|null;suggestion?:{distanceKm:number;tripId:string}|null};
export default function TripAudiencePicker({tripId,onDone,disabled,onBusy}:{tripId:string;onDone:()=>void;disabled:boolean;onBusy:(busy:boolean)=>void}) {
  const [open,setOpen]=useState(false),[items,setItems]=useState<Candidate[]>([]),[selected,setSelected]=useState<string[]>([]),[q,setQ]=useState('');
  const [carType,setCarType]=useState(''),[fuelType,setFuelType]=useState(''),[regions,setRegions]=useState<string[]>([]);
  const [showDrivers,setShowDrivers]=useState(false),[showProvinces,setShowProvinces]=useState(false);
  const [info,setInfo]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  useEffect(()=>{setOpen(false);},[tripId]);
  useEffect(()=>{
    if(!open)return;let active=true;
    setLoading(true);setError('');setInfo('');setItems([]);setSelected([]);setCarType('');setFuelType('');setRegions([]);setQ('');setShowDrivers(false);setShowProvinces(false);
    adminRequest(`/api/trips/admin/trips/${tripId}/audience-candidates`).then(data=>{if(active){setItems(data.items);setInfo(`${data.config.radiusKm} km / ${data.config.days} ngày. ${data.warning}`);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[tripId,open]);
  const locked=busy||disabled||loading;
  function selectFilters(car:string,fuel:string,nextRegions:string[]=regions){setCarType(car);setFuelType(fuel);setRegions(nextRegions);setQ('');setError('');setSelected(audienceFilterIds(items,car,fuel,nextRegions));}
  function toggleRegion(value:string){selectFilters(carType,fuelType,regions.includes(value)?regions.filter(region=>region!==value):[...regions,value]);}
  const filtered=items.filter(d=>matchesAudienceFilters(d,carType,fuelType,regions));
  const visible=filtered.filter(d=>`${d.name} ${d.phone} ${d.plateNumber}`.toLocaleLowerCase('vi').includes(q.toLocaleLowerCase('vi')));
  const hasFilters=!!(carType||fuelType||regions.length);
  const limit=hasFilters?10000:100;
  const label=[...AUDIENCE_REGIONS.filter((region:{value:string})=>regions.includes(region.value)).map((region:{label:string})=>region.label),CARS[carType],FUELS[fuelType]].filter(Boolean).join(' + ');
  const provinceCounts = items.reduce<Record<string, number>>((counts, driver) => {
    const code = driver.operatingProvinceCode;
    if (code && driver.operatingProvinceConfirmedAt && matchesAudienceFilters(driver, carType, fuelType)) {
      counts[code] = (counts[code] || 0) + 1;
    }
    return counts;
  }, {});
  function provinceText(code: string) {
    const name = provinces.find(province => province.code === code)?.name || code;
    return `${name} (${provinceCounts[code] || 0})`;
  }
  async function submit(){
    if(locked||!selected.length||selected.length>limit)return;setBusy(true);onBusy(true);setError('');
    try{
      await adminRequest(`/api/trips/admin/trips/${tripId}/verify`,{method:'POST',body:JSON.stringify({audienceMode:regions.length?'AUDIENCE_FILTER':carType||fuelType?'VEHICLE_FILTER':'SELECTED',driverIds:selected,...(carType?{carType}:{}),...(fuelType?{fuelType}:{}),...(regions.length?{regions}:{}),note:label?`Duyệt nhóm ${label}, ${selected.length} tài xế`:'Duyệt cho tài xế chỉ định'})});
      setOpen(false);onDone();
    }catch(e:any){setError(e.message);Alert.alert('Không thể duyệt',e.message);}finally{setBusy(false);onBusy(false);}
  }
  function choice(text:string,chosen:boolean,onPress:()=>void,extraDisabled=false){return <Pressable accessibilityRole="button" accessibilityState={{selected:chosen,disabled:locked||extraDisabled}} disabled={locked||extraDisabled} onPress={onPress} style={[styles.choice,{backgroundColor:chosen?'#145ea8':'#e8f0fa',opacity:locked||extraDisabled?0.5:1}]}><Text style={{color:chosen?'white':'#145ea8'}}>{text}</Text></Pressable>;}
  function provinceLabel(driver:Candidate){
    const name=provinces.find(province=>province.code===driver.operatingProvinceCode)?.name;
    return driver.operatingProvinceConfirmedAt&&name?name:'Chưa xác nhận khu vực';
  }
  function close(){if(!busy)setOpen(false);}
  return <>
    <Pressable accessibilityRole="button" disabled={busy||disabled} onPress={()=>setOpen(true)} style={styles.trigger}><Text style={styles.whiteBold}>Duyệt cho tài xế chỉ định</Text></Pressable>
    <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}><Text style={styles.title}>Duyệt cho tài xế chỉ định</Text></View>
        <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS==='ios'?'padding':undefined}>
          <FlatList
            data={showDrivers?visible:[]}
            keyExtractor={driver=>driver.userId}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            ListHeaderComponent={<View style={styles.filters}>
              <Text>{info||'Đang tải tài xế…'}</Text>
              <Text>Chỉ tài xế được chọn thấy chuyến. Người nhận trước chạy chuyến.</Text>
              {!!error&&<Text style={styles.error}>{error}</Text>}
              <Text style={styles.section}>1. Miền hoạt động — chọn được nhiều miền</Text>
              <View style={styles.choices}>
                {choice('Tất cả khu vực',regions.length===ALL_REGIONS.length,()=>selectFilters(carType,fuelType,ALL_REGIONS))}
                {AUDIENCE_REGIONS.map((region:{value:string;label:string})=>{
                  const count=items.filter(d=>matchesAudienceFilters(d,carType,fuelType,[region.value])).length;
                  return <View key={region.value}>{choice(`${region.label} (${count})`,regions.includes(region.value),()=>toggleRegion(region.value))}</View>;
                })}
              </View>
              <Text>Dựa trên tỉnh/thành thường hoạt động đã xác nhận, không phải vị trí hiện tại. Hồ sơ chưa xác nhận không tự xếp vào miền Nam. “Tất cả khu vực” gồm cả nhóm chưa xác nhận.</Text>
              <Pressable accessibilityRole="button" accessibilityState={{expanded:showProvinces}} onPress={()=>setShowProvinces(value=>!value)} style={styles.choice}><Text style={styles.link}>{showProvinces?'Ẩn':'Xem'} tỉnh/thành theo miền</Text></Pressable>
              {showProvinces&&<Text>Số trong ngoặc là tài xế đủ điều kiện theo số chỗ và nhiên liệu đang chọn.</Text>}
              {showProvinces&&AUDIENCE_REGIONS.filter((region:{provinceCodes:string[]})=>region.provinceCodes.length).map((region:{value:string;label:string;provinceCodes:string[]})=><Text key={region.value}>{region.label}: {region.provinceCodes.map(provinceText).join(', ')}.</Text>)}
              <Text style={styles.section}>2. Số chỗ</Text>
              <View style={styles.choices}>
                {choice('Tất cả số chỗ',!carType,()=>selectFilters('',fuelType))}
                {Object.entries(CARS).map(([value,text])=>{const count=items.filter(d=>matchesAudienceFilters(d,value,fuelType,regions)).length;return <View key={value}>{choice(`${text} (${count})`,carType===value,()=>selectFilters(value,fuelType),!count&&carType!==value)}</View>;})}
              </View>
              <Text style={styles.section}>3. Nhiên liệu</Text>
              <View style={styles.choices}>
                {choice('Tất cả nhiên liệu',!fuelType,()=>selectFilters(carType,''))}
                {Object.entries(FUELS).map(([value,text])=>{const count=items.filter(d=>matchesAudienceFilters(d,carType,value,regions)).length;return <View key={value}>{choice(`${text} (${count})`,fuelType===value,()=>selectFilters(carType,value),!count&&fuelType!==value)}</View>;})}
              </View>
              <Text>Chọn nhiều miền sẽ gộp tài xế của các miền đó, đồng thời lọc theo số chỗ và nhiên liệu. Nếu chỉ chọn số chỗ hoặc nhiên liệu thì áp dụng toàn quốc. Đổi bộ lọc sẽ chọn lại toàn bộ nhóm phù hợp; có thể bỏ chọn từng người.</Text>
              {choice('Chọn từng tài xế — xoá bộ lọc',!hasFilters,()=>selectFilters('','',[]))}
              {choice('Chọn tất cả tài xế đủ điều kiện',false,()=>selectFilters('','',ALL_REGIONS),!items.length)}
              <Text style={styles.section}>Đã chọn: {selected.length} tài xế{label?' · '+label:''}</Text>
              {choice('Chọn tất cả trong bộ lọc',false,()=>{if(!hasFilters)selectFilters('','',ALL_REGIONS);else setSelected(filtered.map(d=>d.userId));},!filtered.length)}
              {choice('Bỏ chọn hết',false,()=>setSelected([]),!selected.length)}
              {selected.length>limit&&<Text style={styles.error}>Tối đa {limit} tài xế mỗi lần.</Text>}
              {!loading&&!filtered.length&&<Text>Không có tài xế đáp ứng đủ điều kiện.</Text>}
              <Pressable disabled={loading} accessibilityRole="button" accessibilityState={{expanded:showDrivers}} onPress={()=>setShowDrivers(value=>!value)} style={styles.choice}><Text style={styles.link}>{showDrivers?'Ẩn':'Hiện'} danh sách tài xế ({filtered.length})</Text></Pressable>
              {showDrivers&&<>
                <TextInput editable={!locked} accessibilityLabel="Tìm tên, SĐT, biển số" placeholder="Tìm tên, SĐT, biển số" value={q} onChangeText={setQ} style={styles.search}/>
                {!loading&&!visible.length&&!!filtered.length&&<Text>Không tìm thấy tài xế.</Text>}
              </>}
            </View>}
            renderItem={({item:d})=><Pressable disabled={locked} accessibilityRole="checkbox" accessibilityState={{checked:selected.includes(d.userId)}} onPress={()=>setSelected(s=>s.includes(d.userId)?s.filter(id=>id!==d.userId):[...s,d.userId])} style={styles.driver}>
              <Text>{selected.includes(d.userId)?'☑':'☐'} {d.name} • {provinceLabel(d)} • {CARS[d.carType||'']||d.vehicleType||'Chưa rõ số chỗ'} • {FUELS[d.vehicleFuelType||'']||'Chưa cập nhật nhiên liệu'} • {d.phone} • {d.plateNumber}</Text>
              {!!d.suggestion&&<Text style={{color:'#147348'}}>Gợi ý: cách {d.suggestion.distanceKm} km • {d.suggestion.tripId}</Text>}
            </Pressable>}
            ListFooterComponent={<Text style={styles.caption}>Danh sách được chốt khi duyệt; tài xế đăng ký sau không tự được thêm.</Text>}
          />
          <View style={styles.footer}>
            <Pressable accessibilityRole="button" disabled={busy} onPress={close} style={styles.choice}><Text style={styles.link}>Đóng</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={locked||!selected.length||selected.length>limit} onPress={submit} style={[styles.approve,{opacity:locked||!selected.length||selected.length>limit?0.5:1}]}><Text style={styles.whiteBold}>{busy?'Đang duyệt…':`Duyệt cho ${selected.length} tài xế`}</Text></Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  </>;
}
const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:'white'},header:{padding:16,borderBottomWidth:1,borderColor:'#e4e7ec'},title:{fontSize:18,fontWeight:'700'},
  content:{padding:16},filters:{gap:12},section:{fontWeight:'700'},choices:{flexDirection:'row',flexWrap:'wrap',gap:8},choice:{padding:10,borderRadius:8},
  trigger:{padding:14,borderRadius:8,backgroundColor:'#145ea8'},whiteBold:{color:'white',fontWeight:'700'},link:{color:'#145ea8'},error:{color:'#b42318'},
  search:{borderWidth:1,borderColor:'#ccc',padding:12,borderRadius:8},driver:{paddingVertical:12,borderBottomWidth:1,borderColor:'#e4e7ec'},caption:{paddingVertical:12,color:'#667085'},
  footer:{flexDirection:'row',alignItems:'center',gap:12,padding:12,borderTopWidth:1,borderColor:'#e4e7ec',backgroundColor:'white'},approve:{flex:1,padding:14,borderRadius:8,backgroundColor:'#145ea8',alignItems:'center'},
});
