import ClearableSearchField from "../common/ClearableSearchField.jsx";
import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Checkbox, FormControlLabel, Alert, Stack, Typography, Box } from '@mui/material';
import { fetchAudienceCandidates, verifyTrip } from '../../api/adminTrips';
import { AUDIENCE_REGIONS, matchesAudienceFilters, audienceFilterIds } from '../../../../api/src/shared/audienceFilters.js';
import provinces from '../../../../api/src/data/vietnam-provinces.json';
const CARS = { CAR_5:'Xe 5 chỗ', CAR_7:'Xe 7 chỗ', CAR_16:'Xe 16 chỗ' };
const FUELS = { ELECTRIC:'Xe điện', GASOLINE:'Xe xăng' };
const ALL_REGIONS = AUDIENCE_REGIONS.map(region => region.value);
export default function TripAudienceDialog({tripId,onClose,onDone}) {
  const [items,setItems]=useState([]),[selected,setSelected]=useState([]),[q,setQ]=useState('');
  const [carType,setCarType]=useState(''),[fuelType,setFuelType]=useState(''),[regions,setRegions]=useState([]);
  const [showDrivers,setShowDrivers]=useState(false),[showProvinces,setShowProvinces]=useState(false);
  const [error,setError]=useState(''),[info,setInfo]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');setInfo('');setItems([]);setSelected([]);setCarType('');setFuelType('');setRegions([]);setQ('');setShowDrivers(false);setShowProvinces(false);
    fetchAudienceCandidates(tripId).then(data=>{if(active){setItems(data.items);setInfo(`Gợi ý: ${data.config.radiusKm} km / ${data.config.days} ngày. ${data.warning}`);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[tripId]);
  const locked=busy||loading;
  function selectFilters(car,fuel,nextRegions=regions){
    setCarType(car);setFuelType(fuel);setRegions(nextRegions);setQ('');setError('');
    setSelected(audienceFilterIds(items,car,fuel,nextRegions));
  }
  function toggleRegion(value){selectFilters(carType,fuelType,regions.includes(value)?regions.filter(region=>region!==value):[...regions,value]);}
  const filtered=items.filter(d=>matchesAudienceFilters(d,carType,fuelType,regions));
  const visible=filtered.filter(d=>`${d.name} ${d.phone} ${d.plateNumber}`.toLocaleLowerCase('vi').includes(q.toLocaleLowerCase('vi')));
  const hasFilters=!!(carType||fuelType||regions.length);
  const limit=hasFilters?10000:100;
  const label=[...AUDIENCE_REGIONS.filter(region=>regions.includes(region.value)).map(region=>region.label),CARS[carType],FUELS[fuelType]].filter(Boolean).join(' + ');
  const provinceCounts = items.reduce((counts, driver) => {
    const code = driver.operatingProvinceCode;
    if (code && driver.operatingProvinceConfirmedAt && matchesAudienceFilters(driver, carType, fuelType)) {
      counts[code] = (counts[code] || 0) + 1;
    }
    return counts;
  }, {});
  function provinceText(code) {
    const name = provinces.find(province => province.code === code)?.name || code;
    return `${name} (${provinceCounts[code] || 0})`;
  }
  async function submit(){
    if(locked||!selected.length||selected.length>limit)return;
    setBusy(true);setError('');
    try{await verifyTrip(tripId,label?`Duyệt nhóm ${label}, ${selected.length} tài xế`:'Duyệt cho tài xế chỉ định',selected,carType||undefined,fuelType||undefined,regions);onDone();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  function provinceLabel(driver){
    const name=provinces.find(province=>province.code===driver.operatingProvinceCode)?.name;
    return driver.operatingProvinceConfirmedAt && name ? name : 'Chưa xác nhận khu vực';
  }
  return <Dialog open fullWidth maxWidth="sm" onClose={busy?undefined:onClose}>
    <DialogTitle>Duyệt cho tài xế chỉ định</DialogTitle>
    <DialogContent dividers><Stack spacing={1.5}>
      <Alert severity="info">{info||'Đang tải tài xế…'} Chỉ tài xế được chọn thấy chuyến. Người nhận trước chạy chuyến.</Alert>
      {!!error&&<Alert severity="error">{error}</Alert>}
      <Typography fontWeight={700}>1. Miền nhận chuyến — chọn được nhiều miền</Typography>
      <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
        <Button disabled={locked} variant={regions.length===ALL_REGIONS.length?'contained':'outlined'} onClick={()=>selectFilters(carType,fuelType,ALL_REGIONS)}>Tất cả khu vực</Button>
        {AUDIENCE_REGIONS.map(region=>{
          const count=items.filter(d=>matchesAudienceFilters(d,carType,fuelType,[region.value])).length;
          return <Button key={region.value} disabled={locked} aria-pressed={regions.includes(region.value)} variant={regions.includes(region.value)?'contained':'outlined'} onClick={()=>toggleRegion(region.value)}>{region.label} ({count})</Button>;
        })}
      </Stack>
      <Typography variant="body2">Miền nhận chuyến được xác định từ tỉnh/thành tài xế đã cập nhật và xác nhận trong hồ sơ. Khi tài xế sang miền khác, cần cập nhật lại tỉnh/thành nhận chuyến. “Tất cả khu vực” gồm cả nhóm chưa xác nhận.</Typography>
      <Button onClick={()=>setShowProvinces(value=>!value)} aria-expanded={showProvinces}>{showProvinces?'Ẩn':'Xem'} tỉnh/thành theo miền</Button>
      {showProvinces&&<Typography variant="caption">Số trong ngoặc là tài xế đủ điều kiện theo số chỗ và nhiên liệu đang chọn.</Typography>}
      {showProvinces&&AUDIENCE_REGIONS.filter(region=>region.provinceCodes.length).map(region=><Typography variant="body2" key={region.value}><b>{region.label}:</b> {region.provinceCodes.map(provinceText).join(', ')}.</Typography>)}
      <Typography fontWeight={700}>2. Số chỗ</Typography>
      <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
        <Button disabled={locked} variant={!carType?'contained':'outlined'} onClick={()=>selectFilters('',fuelType)}>Tất cả số chỗ</Button>
        {Object.entries(CARS).map(([value,text])=>{
          const count=items.filter(d=>matchesAudienceFilters(d,value,fuelType,regions)).length;
          return <Button key={value} disabled={locked||(!count&&carType!==value)} variant={carType===value?'contained':'outlined'} onClick={()=>selectFilters(value,fuelType)}>{text} ({count})</Button>;
        })}
      </Stack>
      <Typography fontWeight={700}>3. Nhiên liệu</Typography>
      <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
        <Button disabled={locked} variant={!fuelType?'contained':'outlined'} onClick={()=>selectFilters(carType,'')}>Tất cả nhiên liệu</Button>
        {Object.entries(FUELS).map(([value,text])=>{
          const count=items.filter(d=>matchesAudienceFilters(d,carType,value,regions)).length;
          return <Button key={value} disabled={locked||(!count&&fuelType!==value)} variant={fuelType===value?'contained':'outlined'} onClick={()=>selectFilters(carType,value)}>{text} ({count})</Button>;
        })}
      </Stack>
      <Typography variant="body2">Chọn nhiều miền sẽ gộp tài xế của các miền đó, đồng thời lọc theo số chỗ và nhiên liệu. Nếu chỉ chọn số chỗ hoặc nhiên liệu thì áp dụng toàn quốc. Đổi bộ lọc sẽ chọn lại toàn bộ nhóm phù hợp; có thể bỏ chọn từng người.</Typography>
      <Button disabled={locked} onClick={()=>selectFilters('','',[])}>Chọn từng tài xế — xoá bộ lọc</Button>
      <Button disabled={locked||!items.length} onClick={()=>selectFilters('','',ALL_REGIONS)}>Chọn tất cả tài xế đủ điều kiện</Button>
      <Typography fontWeight={700}>Đã chọn: {selected.length} tài xế{label?' · '+label:''}</Typography>
      <Stack direction="row" spacing={1}>
        <Button disabled={locked||!filtered.length} onClick={()=>{if(!hasFilters){selectFilters('','',ALL_REGIONS);}else{setSelected(filtered.map(d=>d.userId));}}}>Chọn tất cả trong bộ lọc</Button>
        <Button disabled={locked||!selected.length} onClick={()=>setSelected([])}>Bỏ chọn hết</Button>
      </Stack>
      {selected.length>limit&&<Alert severity="warning">Tối đa {limit} tài xế mỗi lần.</Alert>}
      {!loading&&!filtered.length&&<Alert severity="warning">Không có tài xế đáp ứng đủ điều kiện.</Alert>}
      <Button disabled={loading} onClick={()=>setShowDrivers(value=>!value)} aria-expanded={showDrivers}>{showDrivers?'Ẩn':'Hiện'} danh sách tài xế ({filtered.length})</Button>
      {showDrivers&&<>
        <ClearableSearchField onClear={() => setQ("")} disabled={locked} label="Tìm tên, SĐT, biển số" value={q} onChange={e=>setQ(e.target.value)}/>
        {!loading&&!visible.length&&!!filtered.length&&<Typography>Không tìm thấy tài xế.</Typography>}
        <Box sx={{maxHeight:320,overflowY:'auto'}}>
          {visible.map(d=><FormControlLabel key={d.userId} sx={{display:'flex'}} control={<Checkbox disabled={locked} checked={selected.includes(d.userId)} onChange={(_,checked)=>setSelected(s=>checked?[...new Set([...s,d.userId])]:s.filter(id=>id!==d.userId))}/>} label={`${d.name} • ${provinceLabel(d)} • ${CARS[d.carType]||d.vehicleType||'Chưa rõ số chỗ'} • ${FUELS[d.vehicleFuelType]||'Chưa cập nhật nhiên liệu'} • ${d.phone} • ${d.plateNumber||''}${d.suggestion?' — Gợi ý: cách '+d.suggestion.distanceKm+' km':''}`}/>)}
        </Box>
      </>}
      <Typography variant="caption">Danh sách được chốt khi duyệt; tài xế đăng ký sau không tự được thêm.</Typography>
    </Stack></DialogContent>
    <DialogActions><Button disabled={busy} onClick={onClose}>Đóng</Button><Button variant="contained" disabled={locked||!selected.length||selected.length>limit} onClick={submit}>{busy?'Đang duyệt…':`Duyệt cho ${selected.length} tài xế`}</Button></DialogActions>
  </Dialog>;
}
