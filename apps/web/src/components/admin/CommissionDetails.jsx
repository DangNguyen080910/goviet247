import { useEffect, useRef, useState } from "react";
import { Alert, Button, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import AccountingPdfButton from "./AccountingPdfButton";
import AdminTableScroll from "./AdminTableScroll";
import { getAdminToken } from "../../utils/adminAuth";
const api = `${import.meta.env.VITE_API_BASE || "http://localhost:5050"}/api/admin`;
const money = value => `${Number(value || 0).toLocaleString("vi-VN")} đ`;
const today = () => new Date(Date.now()+7*3600000).toISOString().slice(0,10);
async function read(res) { const body=await res.json();if(!res.ok||!body.success)throw new Error(body.message||"Không tải được dữ liệu hóa đơn.");return body; }
export default function CommissionDetails() {
  const initialDay = new URLSearchParams(window.location.search).get('commissionDay') || today();
  const [mode,setMode]=useState('day'),[day,setDay]=useState(initialDay);
  const [month,setMonth]=useState(Number(today().slice(5,7))),[quarter,setQuarter]=useState(Math.ceil(Number(today().slice(5,7))/3)),[year,setYear]=useState(Number(today().slice(0,4)));
  const [pendingOnly,setPendingOnly]=useState(true),[data,setData]=useState(null),[summary,setSummary]=useState(null);
  const [error,setError]=useState(''),[loading,setLoading]=useState(false),[downloading,setDownloading]=useState(false),[refresh,setRefresh]=useState(0);
  const [selected,setSelected]=useState(null),[invoiceNumber,setInvoiceNumber]=useState(''),[issuedDay,setIssuedDay]=useState(today()),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState('');
  const version=useRef(0);
  const query=new URLSearchParams({...(mode==='day'?{day}:mode==='month'?{month,year}:{quarter,year}),pendingOnly:String(pendingOnly)}).toString();
  useEffect(()=>{
    const id=++version.current,controller=new AbortController();setData(null);setSummary(null);setError('');setLoading(true);
    const headers={Authorization:`Bearer ${getAdminToken()}`};
    Promise.all([fetch(`${api}/commission-details?${query}`,{headers,signal:controller.signal}).then(read),fetch(`${api}/commission-invoices/summary`,{headers,signal:controller.signal}).then(read)])
      .then(([body,status])=>{if(id===version.current){setData(body);setSummary(status.summary);}})
      .catch(e=>{if(e.name!=='AbortError'&&id===version.current)setError(e.message);})
      .finally(()=>{if(id===version.current)setLoading(false);});
    return()=>controller.abort();
  },[query,refresh]);
  useEffect(()=>{const update=()=>setRefresh(n=>n+1);const timer=setInterval(update,60000);window.addEventListener('admin:dashboard_changed',update);return()=>{clearInterval(timer);window.removeEventListener('admin:dashboard_changed',update);};},[]);
  useEffect(()=>{setSelected(null);},[query]);
  async function download(){
    setDownloading(true);setError('');
    try{
      const res=await fetch(`${api}/commission-details?${query}&format=invoice-xlsx`,{headers:{Authorization:`Bearer ${getAdminToken()}`}});
      if(!res.ok){const body=await res.json();throw new Error([body.message,...(body.issues||[]).slice(0,5).map(i=>`${i.driverName}: ${i.missing.join(', ')}`)].join(' '));}
      const url=URL.createObjectURL(await res.blob()),link=document.createElement('a');link.href=url;link.download=`hoa_don_hoa_hong_${data.periodKey}.xlsx`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){setError(e.message);}finally{setDownloading(false);}
  }
  async function confirm(){
    setSaving(true);setSaveError('');
    try{await fetch(`${api}/commission-invoices/${encodeURIComponent(selected.tripId)}/confirm`,{method:'POST',headers:{Authorization:`Bearer ${getAdminToken()}`,'Content-Type':'application/json'},body:JSON.stringify({invoiceNumber,issuedDay})}).then(read);setSelected(null);setRefresh(n=>n+1);}
    catch(e){setSaveError(e.message);}finally{setSaving(false);}
  }
  return <Stack spacing={2}>
    <Typography variant="h5" fontWeight={800}>Chi tiết hoa hồng</Typography>
    {summary&&<Alert severity={summary.totalPending?'warning':'success'}>Hôm nay ({summary.day}, giờ Việt Nam): {summary.todayTotal} chuyến cần kiểm tra hóa đơn · Chưa xác nhận: {summary.pendingToday} · Đã xác nhận: {summary.confirmedToday} · Kỳ trước chưa xác nhận: {summary.earlierPending}. Nhắc lúc 21:00; chuyến sau giờ nhắc vẫn được giữ trong danh sách chưa xác nhận.</Alert>}
    <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
      <TextField select label="Xem theo" value={mode} onChange={e=>setMode(e.target.value)} sx={{minWidth:140}}><MenuItem value="day">Ngày</MenuItem><MenuItem value="month">Tháng</MenuItem><MenuItem value="quarter">Quý</MenuItem></TextField>
      {mode==='day'?<TextField type="date" label="Ngày (giờ Việt Nam)" value={day} onChange={e=>setDay(e.target.value)} InputLabelProps={{shrink:true}}/>:<>
        <TextField select label={mode==='month'?'Tháng':'Quý'} value={mode==='month'?month:quarter} onChange={e=>mode==='month'?setMonth(Number(e.target.value)):setQuarter(Number(e.target.value))} sx={{minWidth:100}}>{Array.from({length:mode==='month'?12:4},(_,i)=><MenuItem key={i+1} value={i+1}>{i+1}</MenuItem>)}</TextField>
        <TextField label="Năm" type="number" value={year} onChange={e=>setYear(e.target.value)} sx={{width:120}}/></>}
      <TextField select label="Hóa đơn" value={String(pendingOnly)} onChange={e=>setPendingOnly(e.target.value==='true')} sx={{minWidth:200}}><MenuItem value="true">Chưa xác nhận phát hành</MenuItem><MenuItem value="false">Tất cả</MenuItem></TextField>
      <Button onClick={()=>setRefresh(n=>n+1)} disabled={loading}>Làm mới</Button>
      <Button variant="contained" onClick={download} disabled={loading||downloading||!data?.items?.some(i=>!i.invoice&&(i.commissionGross>0||i.note))}>{downloading?'Đang xuất…':'Xuất mẫu VIN-HOADON (chưa xác nhận)'}</Button>
      <AccountingPdfButton period={{year,quarter,month:mode==='month'?month:null}} dateRange={{...(mode==='day'?{day}:{}),pendingOnly:String(pendingOnly)}} reportType="commission"/>
    </Stack>
    <Alert severity="info">Một chuyến một dòng. File mẫu điền số định danh vào MST và CCCD, họ tên tài xế vào tên bên mua/người mua; địa chỉ lấy từ hồ sơ. Loại dịch vụ 1, thanh toán TM/CK/Bù trừ. Đối chiếu thông tin đăng ký thuế, VAT và cách thanh toán trước khi nhập VIN-HOADON.</Alert>
    <Alert severity="warning">Tải Excel không phải phát hành hóa đơn. Chỉ xác nhận sau khi hóa đơn đã ký/phát hành trên VIN-HOADON, nhập ký hiệu/số và ngày lập thực tế. Dữ liệu cũ lấy mốc cập nhật tại thời điểm nâng cấp, cần đối chiếu kỳ trước; không tự lùi ngày hóa đơn.</Alert>
    {error&&<Alert severity="error">{error}</Alert>}
    {loading?<CircularProgress/>:data&&<>
      <Typography fontWeight={700}>{data.items.length} chuyến · Hoa hồng gồm VAT: {money(data.totals.gross)} · Trước VAT: {money(data.totals.net)} · VAT: {money(data.totals.vat)}</Typography>
      <AdminTableScroll><Table size="small"><TableHead><TableRow>{['Ngày ghi nhận (VN)','Mã chuyến','Tài xế','SĐT','MST / CCCD','Địa chỉ','Giá chuyến','% hoa hồng','Phí gồm VAT','Trước VAT','VAT','Hóa đơn / hành động'].map(h=><TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead><TableBody>
        {!data.items.length?<TableRow><TableCell colSpan={12}>Không có chuyến phù hợp bộ lọc.</TableCell></TableRow>:data.items.map(i=><TableRow key={i.tripId}>
          <TableCell>{new Date(i.eventAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh', hour12: false, day: "2-digit", month: "2-digit", year: "numeric" })}{i.recognitionEstimated&&<Typography variant="caption" display="block">Mốc dữ liệu cũ, cần đối chiếu</Typography>}</TableCell>
          <TableCell>{i.tripId}</TableCell><TableCell>{i.driverName}<br/>{i.driverId}</TableCell><TableCell>{i.driverPhone||'Chưa cập nhật'}</TableCell><TableCell>{i.citizenId||'Chưa cập nhật'}</TableCell><TableCell sx={{minWidth:220}}>{i.residentialAddress||'Chưa cập nhật'}</TableCell>
          <TableCell>{money(i.totalPrice)}</TableCell><TableCell>{i.commissionPercent??'—'}</TableCell><TableCell>{money(i.commissionGross)}</TableCell><TableCell>{money(i.commissionNet)}</TableCell><TableCell>{money(i.commissionVat)}</TableCell>
          <TableCell sx={{minWidth:210}}>{i.invoice?<>Đã xác nhận: {i.invoice.invoiceNumber}<br/>{new Date(i.invoice.issuedAt).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh', day: "2-digit", month: "2-digit", year: "numeric" })}</>:i.commissionGross>0?<Button size="small" onClick={()=>{setSelected(i);setInvoiceNumber('');setIssuedDay(today());setSaveError('');}}>Xác nhận đã phát hành</Button>:i.note||'Không phát sinh phí'}</TableCell>
        </TableRow>)}
      </TableBody></Table></AdminTableScroll>
    </>}
    <Dialog open={!!selected} onClose={()=>!saving&&setSelected(null)} fullWidth><DialogTitle>Xác nhận hóa đơn đã phát hành</DialogTitle><DialogContent><Stack spacing={2} sx={{pt:1}}><Typography>{selected?.driverName} · {money(selected?.commissionGross)}. Chỉ ghi nhận hóa đơn thực tế đã phát hành cho chuyến này; thao tác này không ký hay gửi cơ quan thuế.</Typography><TextField label="Ký hiệu / số hóa đơn" value={invoiceNumber} onChange={e=>setInvoiceNumber(e.target.value)} inputProps={{maxLength:100}}/><TextField type="date" label="Ngày lập trên hóa đơn" value={issuedDay} onChange={e=>setIssuedDay(e.target.value)} InputLabelProps={{shrink:true}} inputProps={{max:today()}}/>{saveError&&<Alert severity="error">{saveError}</Alert>}</Stack></DialogContent><DialogActions><Button disabled={saving} onClick={()=>setSelected(null)}>Hủy</Button><Button disabled={saving||!invoiceNumber.trim()||!issuedDay} onClick={confirm}>Lưu xác nhận</Button></DialogActions></Dialog>
  </Stack>;
}
