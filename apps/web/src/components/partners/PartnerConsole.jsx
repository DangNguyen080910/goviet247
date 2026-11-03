import {isRiderChatEnded,RIDER_CHAT_ENDED_NOTICE} from '../../../../api/src/shared/tripChat.js';
import {partnerFetch} from './partnerSession';
import {useEffect,useState} from 'react';
import {Alert,Box,Button,Chip,Dialog,DialogContent,DialogTitle,MenuItem,Pagination,Paper,Stack,Table,TableBody,TableCell,TableContainer,TableHead,TableRow,TextField,Typography} from '@mui/material';
import {openTripChat} from '../TripChatHub';
export const partnerBase=import.meta.env.VITE_API_BASE || 'http://localhost:5050';
export async function partnerRequest(path,{token,companyId,method='GET',body,signal}={}) {
  const url=new URL(`${partnerBase}/api/partners${path}`);
  if(companyId) url.searchParams.set('companyId',companyId);
  const request=token ? (url,options)=>partnerFetch(partnerBase,url,options) : fetch;
  const res=await request(url,{method,signal,credentials:'include',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await res.json();
  if(!res.ok || !data.success) {const e=new Error(data.message || 'Chưa xử lý được yêu cầu.');e.status=res.status;throw e;}
  return data;
}
export const statuses={PENDING:'Tất cả chuyến đang chờ',PENDING_REVIEW:'Chờ duyệt',PENDING_DRIVER:'Chờ tài xế',ACCEPTED:'Đã nhận',CONTACTED:'Đã xác nhận',IN_PROGRESS:'Đang thực hiện',COMPLETED:'Hoàn thành',CANCELLED:'Đã hủy'};
const tripStatusLabel=t=>t.status==='PENDING'?(t.isVerified||t.verifiedAt?'Chờ tài xế':'Chờ duyệt'):statuses[t.status];
const actions={CREATE_COMPANY:'Tạo công ty',UPDATE_COMPANY:'Cập nhật công ty',CREATE_MEMBER:'Thêm nhân viên',UPDATE_MEMBER:'Cập nhật nhân viên',CHANGE_PASSWORD:'Đổi mật khẩu',CREATE_TRIP:'Tạo chuyến',ASSIGN_TRIP:'Chuyển điều phối',CANCEL_TRIP:'Hủy chuyến'};
const money=n=>Number(n||0).toLocaleString('vi-VN')+' đ';
const time=t=>t?new Date(t).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—';
const vehicles={CAR_5:'Xe 5 chỗ',CAR_7:'Xe 7 chỗ',CAR_16:'Xe 16 chỗ'};
function usePartnerApi(token,companyId) {
  return (path,options={})=>partnerRequest(path,{token,companyId,...options});
}
export function PartnerTrips({token,companyId,tripId,onSelect,onClose}) {
  const api=usePartnerApi(token,companyId);
  const [items,setItems]=useState([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[status,setStatus]=useState(''),[date,setDate]=useState(''),[search,setSearch]=useState('');
  const [selected,setSelected]=useState(null),[members,setMembers]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{
    let alive=true;const controller=new AbortController();
    async function load(){try{
      const q=new URLSearchParams({page:String(page),status,date,search});
      const d=await api('/trips?'+q,{signal:controller.signal});if(alive){setItems(d.items);setTotal(d.total);setError('');}
    }catch(e){if(alive && e.name!=='AbortError') setError(e.message);}}
    void load();const timer=setInterval(load,10000);
    return()=>{alive=false;controller.abort();clearInterval(timer);};
  },[token,companyId,page,status,date,search,revision]);
  useEffect(()=>{
    if(!tripId){setSelected(null);return;}
    let alive=true;const c=new AbortController();
    async function load(){try{const d=await api(`/trips/${encodeURIComponent(tripId)}`,{signal:c.signal});if(alive)setSelected(d.trip);}catch(e){if(alive&&e.name!=='AbortError'){setSelected(null);setError(e.message);}}}
    void load();void api('/members',{signal:c.signal}).then(d=>{if(alive)setMembers(d.items.filter(m=>m.isActive));}).catch(()=>{});
    const timer=setInterval(load,10000);return()=>{alive=false;c.abort();clearInterval(timer);};
  },[tripId,token,companyId,revision]);
  async function assign(id){setBusy(true);try{await api(`/trips/${selected.id}/assignment`,{method:'PATCH',body:{assignedToId:id}});setRevision(v=>v+1);}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function cancel(trip=selected){if(!window.confirm('Hủy chuyến đang chờ duyệt này?'))return;setBusy(true);try{await api(`/trips/${trip.id}/cancel`,{method:'POST'});setRevision(v=>v+1);}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <Stack spacing={2}>
    <Typography variant="h5">Chuyến xe</Typography>
    <Typography color="text.secondary">Quản lý theo giờ đón tại Việt Nam. Thông tin xe được ẩn khi chuyến kết thúc.</Typography>
    {error&&<Alert severity="error">{error}</Alert>}
    <Stack direction={{xs:'column',sm:'row'}} spacing={2}>
      <TextField label="Trạng thái" select value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}} sx={{minWidth:180}}><MenuItem value="">Tất cả</MenuItem>{Object.entries(statuses).map(([k,v])=><MenuItem key={k} value={k}>{v}</MenuItem>)}</TextField>
      <TextField label="Ngày đón" type="date" value={date} onChange={e=>{setDate(e.target.value);setPage(1);}} slotProps={{inputLabel:{shrink:true}}}/>
      <TextField label="Tìm mã chuyến" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
      <Button onClick={()=>setRevision(v=>v+1)}>Làm mới</Button>
    </Stack>
    <TableContainer component={Paper}><Table size="small"><TableHead><TableRow>{['Mã chuyến','Giờ đón','Lộ trình','Loại xe','Người tạo / Phụ trách','Thông tin xe','Trạng thái','Giá',''].map((v,i)=><TableCell key={i}>{v}</TableCell>)}</TableRow></TableHead>
      <TableBody>{items.map(t=><TableRow key={t.id} hover>
        <TableCell><Button onClick={()=>onSelect(t.id)}>{t.id.slice(-8).toUpperCase()}</Button></TableCell><TableCell sx={{minWidth:145}}>{time(t.pickupTime)}</TableCell>
        <TableCell sx={{minWidth:230}}>{t.pickupAddress}<br/>→ {t.dropoffAddress}</TableCell><TableCell>{vehicles[t.carType]}</TableCell>
        <TableCell>{t.createdBy?.displayName||'GoViet247'}<br/><strong>{t.assignedTo?.displayName||'—'}</strong></TableCell>
        <TableCell>{t.vehicle ? `${t.vehicle.brand||''} ${t.vehicle.model||''} · ${t.vehicle.plate||''}`:'—'}</TableCell>
        <TableCell><Chip size="small" label={tripStatusLabel(t)} color={t.status==='COMPLETED'?'success':'default'}/></TableCell><TableCell sx={{whiteSpace:'nowrap'}}>{money(t.totalPrice)}</TableCell>
        <TableCell>{t.canChat?<Button onClick={()=>openTripChat(t.id)}>Chat{t.unread?` (${t.unread})`:""}</Button>:isRiderChatEnded(t.status)?<Button sx={{color:"#64748b",bgcolor:"#f1f5f9"}} onClick={()=>window.alert(RIDER_CHAT_ENDED_NOTICE)}>Chat chuyến (đã kết thúc)</Button>:null}{t.canCancel&&<Button color="error" disabled={busy} onClick={()=>cancel(t)}>Hủy chuyến</Button>}</TableCell>
      </TableRow>)}{!items.length&&<TableRow><TableCell colSpan={9}>Chưa có chuyến phù hợp.</TableCell></TableRow>}</TableBody></Table></TableContainer>
    <Stack direction="row" spacing={2} alignItems="center"><Typography>{total} chuyến</Typography><Pagination count={Math.max(1,Math.ceil(total/50))} page={page} onChange={(_,n)=>setPage(n)}/></Stack>
    <Dialog open={Boolean(selected&&tripId)} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>Chi tiết chuyến #{selected?.id.slice(-8).toUpperCase()}</DialogTitle><DialogContent>
      {selected&&<Stack spacing={2} sx={{pt:1}}><Chip label={tripStatusLabel(selected)}/><Typography>{time(selected.pickupTime)} · {vehicles[selected.carType]} · {money(selected.totalPrice)}</Typography>
        <Typography>Đón: {selected.pickupAddress}</Typography>{selected.stops?.map(s=><Typography key={s.id}>Điểm {s.seq}: {s.address}</Typography>)}
        {selected.note&&<Typography>Ghi chú: {selected.note}</Typography>}
        <Typography>Người tạo: {selected.createdBy?.displayName||'GoViet247'}</Typography>
        <TextField select label="Điều phối phụ trách" disabled={busy||!selected.canReassign||['COMPLETED','CANCELLED'].includes(selected.status)} value={selected.assignedTo?.id||''} onChange={e=>assign(e.target.value)}>{members.map(m=><MenuItem key={m.id} value={m.id}>{m.displayName} ({m.username})</MenuItem>)}</TextField>
        {selected.vehicle&&<Typography>Xe: {selected.vehicle.brand} {selected.vehicle.model} · {selected.vehicle.color} · {selected.vehicle.plate}</Typography>}
        {selected.canChat?<Button variant="contained" onClick={()=>openTripChat(selected.id)}>Chat chuyến</Button>:isRiderChatEnded(selected.status)?<Button sx={{color:"#64748b",bgcolor:"#f1f5f9"}} onClick={()=>window.alert(RIDER_CHAT_ENDED_NOTICE)}>Chat chuyến (đã kết thúc)</Button>:null}
        {selected.canCancel&&<Button color="error" disabled={busy} onClick={()=>cancel(selected)}>Hủy chuyến chờ duyệt</Button>}
        {error&&<Alert severity="error">{error}</Alert>}<Button onClick={onClose}>Đóng</Button>
      </Stack>}
    </DialogContent></Dialog>
  </Stack>;
}
export function PartnerMembers({token,companyId}) {
  const api=usePartnerApi(token,companyId);
  const [items,setItems]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[form,setForm]=useState(null),[revision,setRevision]=useState(0);
  useEffect(()=>{let alive=true;api('/members').then(d=>{if(alive)setItems(d.items);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[token,companyId,revision]);
  async function save(e){e.preventDefault();setBusy(true);setError('');try{await api(form.id?`/members/${form.id}`:'/members',{method:form.id?'PATCH':'POST',body:form});setForm(null);setRevision(v=>v+1);}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function toggle(m){if(!window.confirm(`${m.isActive?'Khóa':'Mở khóa'} tài khoản ${m.username}?`))return;setBusy(true);try{await api(`/members/${m.id}`,{method:'PATCH',body:{isActive:!m.isActive}});setRevision(v=>v+1);setError('');}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <Stack spacing={2}><Typography variant="h5">Nhân viên</Typography><Typography color="text.secondary">Khóa tài khoản sẽ giữ nguyên lịch sử. Hãy chuyển chuyến đang phụ trách trước khi khóa.</Typography>
    {error&&<Alert severity="error">{error}</Alert>}<Button variant="contained" onClick={()=>setForm({username:'',displayName:'',phone:'',password:'',role:'DISPATCHER'})}>Thêm nhân viên</Button>
    <TableContainer component={Paper}><Table><TableHead><TableRow>{['Username','Họ tên','Số điện thoại Rider','Quyền','Trạng thái',''].map(v=><TableCell key={v}>{v}</TableCell>)}</TableRow></TableHead><TableBody>{items.map(m=><TableRow key={m.id}><TableCell>{m.username}</TableCell><TableCell>{m.displayName}</TableCell><TableCell>{m.phone||"Chưa cập nhật"}</TableCell><TableCell>{m.role==='ADMIN'?'Admin công ty':'Điều phối viên'}</TableCell><TableCell>{m.isActive?'Hoạt động':'Đã khóa'}</TableCell><TableCell><Button onClick={()=>setForm({...m,password:''})}>Sửa / Đặt lại mật khẩu</Button><Button color="warning" disabled={busy} onClick={()=>toggle(m)}>{m.isActive?'Khóa':'Mở khóa'}</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer>
    <Dialog open={Boolean(form)} onClose={()=>!busy&&setForm(null)} fullWidth><DialogTitle>{form?.id?'Cập nhật nhân viên':'Thêm nhân viên'}</DialogTitle><DialogContent>{form&&<Stack component="form" spacing={2} onSubmit={save} sx={{pt:1}}>
      <TextField required label="Username" disabled={Boolean(form.id)} value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/>
      <TextField required label="Họ tên" value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})}/>
      <TextField required label="Số di động đăng nhập Rider" type="tel" value={form.phone||""} onChange={e=>setForm({...form,phone:e.target.value})} helperText="Nhân viên đăng nhập app Rider bằng số này và xác thực OTP để xem chuyến, chat và nhận thông báo."/>
      <TextField required={!form.id} type="password" autoComplete="new-password" label={form.id?'Mật khẩu mới (bỏ trống để giữ nguyên)':'Mật khẩu ban đầu'} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} helperText="Ít nhất 10 ký tự. Nhân viên phải đổi khi đăng nhập."/>
      <TextField select label="Quyền" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><MenuItem value="DISPATCHER">Điều phối viên</MenuItem><MenuItem value="ADMIN">Admin công ty</MenuItem></TextField>
      {error&&<Alert severity="error">{error}</Alert>}<Button disabled={busy} type="submit" variant="contained">{busy?'Đang lưu…':'Lưu'}</Button><Button disabled={busy} onClick={()=>setForm(null)}>Đóng</Button>
    </Stack>}</DialogContent></Dialog>
  </Stack>;
}
export function PartnerSettings({token,companyId,superAdmin=false,canManage=false,passwordOnly=false,onPasswordChanged}) {
  const api=usePartnerApi(token,companyId);
  const [company,setCompany]=useState(null),[logs,setLogs]=useState([]),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[currentPassword,setCurrentPassword]=useState(''),[newPassword,setNewPassword]=useState('');
  useEffect(()=>{if(passwordOnly)return;let alive=true;api('/company').then(d=>{if(alive)setCompany(d.company);}).catch(e=>{if(alive)setError(e.message);});if(canManage)api('/audit').then(d=>{if(alive)setLogs(d.items);}).catch(()=>{});return()=>{alive=false;};},[token,companyId,canManage,passwordOnly]);
  async function save(body){setBusy(true);setError('');setMessage('');try{const d=await api('/company',{method:'PATCH',body});setCompany(d.company);setMessage('Đã lưu.');}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function logo(file){if(!file)return;if(file.size>2*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)){setError('Chọn ảnh PNG, JPEG hoặc WebP tối đa 2 MB.');return;}const reader=new FileReader();reader.onload=()=>save({logoUrl:reader.result});reader.onerror=()=>setError('Không đọc được ảnh.');reader.readAsDataURL(file);}
  async function changePassword(e){e.preventDefault();setBusy(true);setError('');try{const d=await api('/password',{method:'POST',body:{currentPassword,newPassword}});setCurrentPassword('');setNewPassword('');onPasswordChanged?.(d.token);setMessage('Đã đổi mật khẩu.');}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <Stack spacing={3}><Typography variant="h5">Cài đặt</Typography>{error&&<Alert severity="error">{error}</Alert>}{message&&<Alert severity="success">{message}</Alert>}
    {company&&<Paper sx={{p:3}}><Stack spacing={2}><Typography variant="h6">{company.name} · {company.code}</Typography>{company.logoUrl&&<Box component="img" src={company.logoUrl} alt="Logo công ty" sx={{width:160,height:80,objectFit:'contain'}}/>}
      {canManage&&<Button component="label" disabled={busy}>Cập nhật logo<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>logo(e.target.files?.[0])}/></Button>}
      {superAdmin&&<><Alert severity="info">Số quản lý chỉ dành cho Admin GoViet247, không chuyển cho tài xế hoặc gán vào thông tin khách.</Alert>{[['name','Tên công ty'],['managementName','Founder / Admin liên hệ'],['managementPhone','Số điện thoại quản lý'],['greeting','Hướng dẫn chào khách sau khi nhận chuyến']].map(([k,label])=><TextField key={k} label={label} value={company[k]||''} onChange={e=>setCompany({...company,[k]:e.target.value})}/>)}
        <Button variant="contained" disabled={busy} onClick={()=>save({name:company.name,managementName:company.managementName,managementPhone:company.managementPhone,greeting:company.greeting})}>Lưu thông tin</Button>
        <Button color="warning" disabled={busy} onClick={()=>{if(window.confirm(`${company.isActive?'Khóa':'Mở khóa'} công ty này?`))save({isActive:!company.isActive});}}>{company.isActive?'Khóa công ty':'Mở khóa công ty'}</Button></>}
    </Stack></Paper>}
    {!superAdmin&&<Paper component="form" onSubmit={changePassword} sx={{p:3}}><Stack spacing={2}><Typography variant="h6">Đổi mật khẩu</Typography><TextField required type="password" autoComplete="current-password" label="Mật khẩu hiện tại" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/><TextField required type="password" autoComplete="new-password" label="Mật khẩu mới" value={newPassword} onChange={e=>setNewPassword(e.target.value)} helperText="Ít nhất 10 ký tự, tối đa 72 byte."/><Button type="submit" disabled={busy} variant="contained">Đổi mật khẩu</Button></Stack></Paper>}
    {canManage&&<Paper sx={{p:3}}><Typography variant="h6">Lịch sử thao tác gần đây</Typography>{logs.map(l=><Typography key={l.id} sx={{py:1,borderBottom:'1px solid #eee'}}>{time(l.createdAt)} · {l.actorLabel} · {actions[l.action]||'Cập nhật'}{l.targetId?' · '+l.targetId.slice(-8):''}</Typography>)}</Paper>}
  </Stack>;
}
