import {useEffect,useState} from 'react';
import BookingCard from '../../components/customer/BookingCard';
import {Alert,Button,Dialog,DialogContent,DialogTitle,MenuItem,Paper,Stack,Tab,Tabs,TextField,Typography} from '@mui/material';
import {getAdminToken,getAdminUser} from '../../utils/adminAuth';
import {PartnerMembers,PartnerSettings,PartnerTrips,partnerRequest} from '../../components/partners/PartnerConsole';
const blank={code:'',name:'',managementName:'',managementPhone:'',adminUsername:'',adminName:'',password:'',greeting:''};
export default function AdminPartners({sessionToken,sessionUser,onCompanyChange,portal=false}={}){
  const token=sessionToken || getAdminToken();
  const user=sessionUser || getAdminUser();
  const [companies,setCompanies]=useState([]),[companyId,setCompanyId]=useState(''),[tab,setTab]=useState('trips'),[form,setForm]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0),[tripId,setTripId]=useState(''),[members,setMembers]=useState([]),[assignedToId,setAssignedToId]=useState('');
  useEffect(()=>{let alive=true;partnerRequest('/companies',{token}).then(d=>{if(alive)setCompanies(d.items);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[token,revision]);
  useEffect(()=>{setAssignedToId('');if(!companyId)return;let alive=true;partnerRequest('/members',{token,companyId}).then(d=>{if(alive)setMembers(d.items.filter(m=>m.isActive));}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[token,companyId,revision]);
  const booking={quote:async body=>(await partnerRequest('/quote',{token,companyId,method:'POST',body})).data,
    createTrip:async body=>{if(!assignedToId)throw new Error('Vui lòng chọn điều phối viên.');return partnerRequest('/trips',{token,companyId,method:'POST',body:{...body,assignedToId}});},successPath:portal?'/chuyen-xe':'/admin/partners',onSuccessClosed:portal?()=>setTab('trips'):undefined};
  async function create(e){e.preventDefault();setBusy(true);setError('');try{const d=await partnerRequest('/companies',{token,method:'POST',body:form});setForm(null);setCompanyId(d.company.id);setRevision(v=>v+1);}catch(e){setError(e.message);}finally{setBusy(false);}}
  useEffect(()=>{onCompanyChange?.(companies.find(c=>c.id===companyId)||null);},[companyId,companies,onCompanyChange]);
  if(user?.role!=='ADMIN')return <Alert severity="error">Chỉ Admin GoViet247 được quản lý đối tác.</Alert>;
  const company=companies.find(c=>c.id===companyId);
  return <Stack spacing={3}><Typography variant="h4">Đối tác</Typography><Typography color="text.secondary">Quản lý công ty, nhân viên, chuyến xe và lịch sử hỗ trợ.</Typography>
    {error&&<Alert severity="error">{error}</Alert>}
    <Stack direction={{xs:'column',sm:'row'}} spacing={2}><TextField select label="Công ty" value={companyId} onChange={e=>{setCompanyId(e.target.value);setTripId('');}} sx={{minWidth:280}}><MenuItem value="">Chọn công ty</MenuItem>{companies.map(c=><MenuItem key={c.id} value={c.id}>{c.name} ({c.code}){c.isActive?'':' · Đã khóa'}</MenuItem>)}</TextField><Button variant="contained" onClick={()=>setForm({...blank})}>Thêm đối tác</Button></Stack>
    {company&&<><Paper sx={{p:2}}><Typography fontWeight={700}>{company.name}</Typography><Typography>Liên hệ quản lý: {company.managementName} · <a href={'tel:'+company.managementPhone.replace(/[^+0-9]/g,'')}>{company.managementPhone}</a></Typography></Paper>
      <Tabs value={tab} onChange={(_,v)=>setTab(v)}><Tab value="trips" label="Chuyến xe"/><Tab value="booking" label="Đặt xe hỗ trợ"/><Tab value="members" label="Nhân viên"/><Tab value="settings" label="Cấu hình & lịch sử"/></Tabs>
      <div key={companyId}>{tab==='booking'&&<Stack spacing={2}><Alert severity="info">Chuyến sẽ ghi nhận do GoViet247 tạo hỗ trợ.</Alert><TextField select label="Điều phối viên phụ trách" value={assignedToId} onChange={e=>setAssignedToId(e.target.value)}>{members.map(m=><MenuItem key={m.id} value={m.id}>{m.displayName}</MenuItem>)}</TextField>{assignedToId&&<BookingCard partner={booking}/>}</Stack>}{tab==='trips'&&<PartnerTrips token={token} companyId={companyId} tripId={tripId} onSelect={setTripId} onClose={()=>setTripId('')}/>}{tab==='members'&&<PartnerMembers token={token} companyId={companyId}/>} {tab==='settings'&&<PartnerSettings token={token} companyId={companyId} superAdmin canManage/>}</div>
    </>}
    <Dialog open={Boolean(form)} onClose={()=>!busy&&setForm(null)} fullWidth><DialogTitle>Thêm công ty đối tác</DialogTitle><DialogContent>{form&&<Stack component="form" spacing={2} onSubmit={create} sx={{pt:1}}>{[['code','Mã công ty cố định'],['name','Tên công ty'],['managementName','Founder / Admin liên hệ'],['managementPhone','Số điện thoại quản lý'],['adminUsername','Username Admin đầu tiên'],['adminName','Tên Admin đầu tiên'],['password','Mật khẩu ban đầu'],['greeting','Hướng dẫn chào khách (tùy chọn)']].map(([k,label])=><TextField key={k} required={!['greeting','adminName'].includes(k)} label={label} type={k==='password'?'password':'text'} autoComplete={k==='password'?'new-password':'off'} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/>)}<Alert severity="info">Số quản lý chỉ dành cho GoViet247. Admin đối tác phải đổi mật khẩu ban đầu.</Alert>{error&&<Alert severity="error">{error}</Alert>}<Button type="submit" variant="contained" disabled={busy}>{busy?'Đang tạo…':'Tạo đối tác'}</Button><Button disabled={busy} onClick={()=>setForm(null)}>Đóng</Button></Stack>}</DialogContent></Dialog>
  </Stack>;
}
