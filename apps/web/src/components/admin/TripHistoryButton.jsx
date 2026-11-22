import {useEffect,useState} from 'react';
import {Alert,Button,Chip,CircularProgress,Dialog,DialogActions,DialogContent,DialogTitle,Paper,Stack,Typography} from '@mui/material';
import {getAdminToken} from '../../utils/adminAuth';
import {tripEventTitles,historyResolutions,historySources,historyTime,historyActor,historyStatus,historyValue,historyEventColor} from '../../../../api/src/shared/adminHistory.js';
const base = import.meta.env.VITE_API_BASE || 'http://localhost:5050';
export default function TripHistoryButton({tripId}) {
  const [open,setOpen]=useState(false),[refresh,setRefresh]=useState(0),[data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    if(!open || !tripId)return;
    let active=true;setBusy(true);setData(null);setError('');
    async function load(){try{
      const res=await fetch(`${base}/api/admin/trips/${encodeURIComponent(tripId)}/history`,{headers:{Authorization:`Bearer ${getAdminToken()}`},cache:'no-store'});
      const next=await res.json();if(!res.ok || !next.success)throw Error(next.message || 'Không tải được lịch sử.');
      if(active)setData(next);
    }catch(e){if(active)setError(e.message || 'Không tải được lịch sử.');}finally{if(active)setBusy(false);}}
    void load();return()=>{active=false;};
  },[open,tripId,refresh]);
  if(!tripId)return null;
  return <>
    <Button size="small" variant="outlined" onClick={e=>{e.stopPropagation();setOpen(true);}}>Lịch sử chuyến</Button>
    <Dialog open={open} onClose={()=>setOpen(false)} fullWidth maxWidth="sm" onClick={e=>e.stopPropagation()} sx={{zIndex:20000}}>
      <DialogTitle>Lịch sử chuyến</DialogTitle>
      <DialogContent dividers><Stack spacing={2}>
        <Typography sx={{overflowWrap:'anywhere'}}>{tripId}</Typography>
        <Typography variant="body2">Thời gian Việt Nam · Mới nhất trước</Typography>
        {busy && <CircularProgress size={24}/>}{error && <Alert severity="error">{error}</Alert>}
        {data && <><Alert severity="info">{data.notice}</Alert>
          {data.limited && <Alert severity="warning">Lịch sử dài; đang hiển thị các bản ghi gần nhất còn tra cứu được.</Alert>}
          {!data.items?.length && <Typography>Chưa có lịch sử cho chuyến này.</Typography>}
          {data.items?.map(item=><Paper variant="outlined" key={item.id} sx={{p:2,borderLeft:4,borderLeftColor:historyEventColor(item)}}><Stack spacing={1}>
            <Typography fontWeight={800}>{tripEventTitles[item.kind] || item.kind}</Typography>
            <Typography color="primary" fontWeight={700}>{historyTime(item.createdAt)}</Typography>
            {item.driverId && <Typography fontWeight={700}>{item.driverName || 'Chưa lưu tên tài xế'}{item.driverPhone ? ` · ${item.driverPhone}` : ''}</Typography>}
            {item.driverId && <Typography variant="caption" sx={{overflowWrap:'anywhere'}}>Mã tài xế: {item.driverId}</Typography>}
            <Typography variant="body2">Thực hiện: {historyActor(item)}</Typography>
            {item.fromStatus && item.toStatus && item.fromStatus !== item.toStatus && <Typography>{historyStatus(item.fromStatus)} → {historyStatus(item.toStatus)}</Typography>}
            {item.amount != null && <Typography fontWeight={700}>Số tiền: {Number(item.amount).toLocaleString('vi-VN')} đ</Typography>}
            {item.changes?.map((change,index)=><Paper key={index} variant="outlined" sx={{p:1,bgcolor:'grey.50'}}><Typography fontWeight={700}>{change.label}</Typography><Typography sx={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>Trước: {historyValue(change.before)}</Typography><Typography sx={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>Sau: {historyValue(change.after)}</Typography></Paper>)}
            {item.reason && <Typography sx={{whiteSpace:'pre-wrap'}}>Lý do/Ghi chú: {item.reason}</Typography>}
            {item.resolution && <Typography>{historyResolutions[item.resolution] || item.resolution}</Typography>}
            <Chip size="small" label={historySources[item.source] || item.source} sx={{alignSelf:'flex-start'}}/>
          </Stack></Paper>)}
        </>}
      </Stack></DialogContent>
      <DialogActions><Button disabled={busy} onClick={()=>setRefresh(n=>n+1)}>Tải lại</Button><Button onClick={()=>setOpen(false)}>Đóng</Button></DialogActions>
    </Dialog>
  </>;
}
