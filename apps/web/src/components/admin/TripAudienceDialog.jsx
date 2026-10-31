import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Checkbox, FormControlLabel, Alert, Stack, Typography } from '@mui/material';
import { fetchAudienceCandidates, verifyTrip } from '../../api/adminTrips';
import { matchesAudienceFilters, audienceFilterIds } from '../../../../api/src/shared/audienceFilters.js';
const CARS = { CAR_5:'Xe 5 chỗ', CAR_7:'Xe 7 chỗ', CAR_16:'Xe 16 chỗ' };
const FUELS = { ELECTRIC:'Xe điện', GASOLINE:'Xe xăng' };
export default function TripAudienceDialog({tripId,onClose,onDone}) {
  const [items,setItems]=useState([]),[selected,setSelected]=useState([]),[q,setQ]=useState('');
  const [carType,setCarType]=useState(''),[fuelType,setFuelType]=useState('');
  const [error,setError]=useState(''),[info,setInfo]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');setInfo('');setItems([]);setSelected([]);setCarType('');setFuelType('');setQ('');
    fetchAudienceCandidates(tripId).then(data=>{if(active){setItems(data.items);setInfo(`Gợi ý: ${data.config.radiusKm} km / ${data.config.days} ngày. ${data.warning}`);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[tripId]);
  function selectFilters(car,fuel){setCarType(car);setFuelType(fuel);setQ('');setError('');setSelected(audienceFilterIds(items,car,fuel));}
  const filtered=items.filter(d=>matchesAudienceFilters(d,carType,fuelType));
  const visible=filtered.filter(d=>`${d.name} ${d.phone} ${d.plateNumber}`.toLocaleLowerCase('vi').includes(q.toLocaleLowerCase('vi')));
  const limit=carType||fuelType?10000:100;
  const label=[CARS[carType],FUELS[fuelType]].filter(Boolean).join(' + ');
  async function submit(){
    if(busy||loading||!selected.length||selected.length>limit)return;
    setBusy(true);setError('');
    try{await verifyTrip(tripId,label?`Duyệt nhóm ${label}, ${selected.length} tài xế`:'Duyệt cho tài xế chỉ định',selected,carType||undefined,fuelType||undefined);onDone();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <Dialog open fullWidth onClose={busy?undefined:onClose}>
    <DialogTitle>Duyệt cho tài xế chỉ định</DialogTitle>
    <DialogContent><Stack spacing={1.5}>
      <Alert severity="info">{info||'Đang tải tài xế…'} Chỉ tài xế được chọn thấy chuyến. Người nhận trước chạy chuyến.</Alert>
      {!!error&&<Alert severity="error">{error}</Alert>}
      <Typography fontWeight={700}>1. Số chỗ</Typography>
      <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
        <Button disabled={busy||loading} variant={!carType?'contained':'outlined'} onClick={()=>selectFilters('',fuelType)}>Tất cả số chỗ</Button>
        {Object.entries(CARS).map(([value,text])=>{
          const count=items.filter(d=>matchesAudienceFilters(d,value,fuelType)).length;
          return <Button key={value} disabled={busy||loading||!count} variant={carType===value?'contained':'outlined'} onClick={()=>selectFilters(value,fuelType)}>{text} ({count})</Button>;
        })}
      </Stack>
      <Typography fontWeight={700}>2. Nhiên liệu</Typography>
      <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
        <Button disabled={busy||loading} variant={!fuelType?'contained':'outlined'} onClick={()=>selectFilters(carType,'')}>Tất cả nhiên liệu</Button>
        {Object.entries(FUELS).map(([value,text])=>{
          const count=items.filter(d=>matchesAudienceFilters(d,carType,value)).length;
          return <Button key={value} disabled={busy||loading||!count} variant={fuelType===value?'contained':'outlined'} onClick={()=>selectFilters(carType,value)}>{text} ({count})</Button>;
        })}
      </Stack>
      <Typography variant="body2">Chọn đồng thời sẽ lấy tài xế đáp ứng đủ cả hai điều kiện. Đổi bộ lọc sẽ chọn lại toàn bộ nhóm phù hợp; có thể bỏ chọn từng người.</Typography>
      <Button disabled={busy||loading} onClick={()=>selectFilters('','')}>Chọn từng tài xế — xoá bộ lọc</Button>
      <Typography fontWeight={700}>Đã chọn: {selected.length} tài xế{label?' · '+label:''}</Typography>
      <Button disabled={busy||loading||!filtered.length} onClick={()=>setSelected(filtered.map(d=>d.userId))}>Chọn tất cả trong bộ lọc</Button>
      <Button disabled={busy||loading||!selected.length} onClick={()=>setSelected([])}>Bỏ chọn hết</Button>
      {selected.length>limit&&<Alert severity="warning">Tối đa {limit} tài xế mỗi lần.</Alert>}
      <TextField disabled={busy||loading} label="Tìm tên, SĐT, biển số" value={q} onChange={e=>setQ(e.target.value)}/>
      {!loading&&!visible.length&&<Alert severity="warning">Không có tài xế đáp ứng đủ điều kiện.</Alert>}
      {visible.map(d=><FormControlLabel key={d.userId} control={<Checkbox disabled={busy||loading} checked={selected.includes(d.userId)} onChange={(_,checked)=>setSelected(s=>checked?[...new Set([...s,d.userId])]:s.filter(id=>id!==d.userId))}/>} label={`${d.name} • ${CARS[d.carType]||d.vehicleType||'Chưa rõ số chỗ'} • ${FUELS[d.vehicleFuelType]||'Chưa cập nhật nhiên liệu'} • ${d.phone} • ${d.plateNumber||''}${d.suggestion?' — Gợi ý: cách '+d.suggestion.distanceKm+' km':''}`}/>)}
      <Typography variant="caption">Danh sách được chốt khi duyệt; tài xế đăng ký sau không tự được thêm.</Typography>
    </Stack></DialogContent>
    <DialogActions><Button disabled={busy} onClick={onClose}>Đóng</Button><Button variant="contained" disabled={busy||loading||!selected.length||selected.length>limit} onClick={submit}>{busy?'Đang duyệt…':`Duyệt cho ${selected.length} tài xế`}</Button></DialogActions>
  </Dialog>;
}
