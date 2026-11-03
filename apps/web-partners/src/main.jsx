import {partnerTokenKey,enablePartnerSessionRefresh,storePartnerToken,clearPartnerToken,notifyPartnerStorageChange} from '../../web/src/components/partners/partnerSession';
import {StrictMode,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Link,Navigate,Route,Routes,useNavigate,useParams} from 'react-router-dom';
import {Checkbox,FormControlLabel,Alert,AppBar,Box,Button,CircularProgress,Container,CssBaseline,MenuItem,Paper,Stack,TextField,ThemeProvider,Toolbar,Typography,createTheme} from '@mui/material';
import BookingCard from '../../web/src/components/customer/BookingCard';
import TripChatHub from '../../web/src/components/TripChatHub';
import {FloatingActionsProvider} from '../../web/src/components/FloatingActionsContext';
import {PartnerMembers,PartnerSettings,PartnerTrips,partnerRequest} from '../../web/src/components/partners/PartnerConsole';
enablePartnerSessionRefresh();
const key=partnerTokenKey;
const theme=createTheme({palette:{primary:{main:'#087f80'},background:{default:'#f4f7f9'}},typography:{fontFamily:'Arial, sans-serif'},components:{MuiButton:{styleOverrides:{root:{textTransform:'none'}}}}});
function App(){
  const [token,setToken]=useState(()=>localStorage.getItem(key)||''),[session,setSession]=useState(null),[loading,setLoading]=useState(Boolean(token)),[error,setError]=useState('');
  const navigate=useNavigate();
  useEffect(()=>{
    const sync=()=>{const next=localStorage.getItem(key)||'';setToken(next);if(!next)setSession(null);};
    const onStorage=event=>{if(event.key===key || event.key===null){notifyPartnerStorageChange();sync();}};
    window.addEventListener('partner-session-changed',sync);window.addEventListener('storage',onStorage);
    return()=>{window.removeEventListener('partner-session-changed',sync);window.removeEventListener('storage',onStorage);};
  },[]);
  useEffect(()=>{
    if(!token){setSession(null);setLoading(false);return;}
    let alive=true;const c=new AbortController();
    async function check(){try{const d=await partnerRequest('/me',{token,signal:c.signal});if(alive){if(d.superAdmin){clearPartnerToken();setSession(null);setError('Vui lòng đăng nhập bằng tài khoản đối tác.');return;}setSession(d);setError('');}}catch(e){if(alive&&e.name!=='AbortError'){if(e.status===401){clearPartnerToken();setToken('');setSession(null);}setError(e.message);}}finally{if(alive)setLoading(false);}}
    void check();const timer=setInterval(check,30000);return()=>{alive=false;c.abort();clearInterval(timer);};
  },[token]);
  const acceptToken=t=>{storePartnerToken(t);setToken(t);};
  async function logout(){try{await partnerRequest('/logout',{token,method:'POST'});}catch(e){setError(e.message);return;}clearPartnerToken();setToken('');setSession(null);navigate('/dang-nhap');}
  async function login(e){e.preventDefault();setLoading(true);setError('');const f=new FormData(e.currentTarget);try{const d=await partnerRequest('/login',{method:'POST',body:{...Object.fromEntries(f),rememberMe:f.get('rememberMe')==='on'}});acceptToken(d.token);setSession(d);navigate(d.member.mustChangePassword?'/cai-dat':'/chuyen-xe');}catch(e){setError(e.message);}finally{setLoading(false);}}
  if(!token)return <Container maxWidth="xs" sx={{py:8}}><Paper component="form" onSubmit={login} sx={{p:4}}><Stack spacing={3}><Typography variant="h5">Cổng đối tác GoViet247</Typography><Typography color="text.secondary">Đăng nhập tài khoản điều phối của công ty.</Typography>{error&&<Alert severity="error">{error}</Alert>}<TextField name="companyCode" required label="Mã công ty" autoComplete="organization"/><TextField name="username" required label="Username" autoComplete="username"/><TextField name="password" required type="password" label="Mật khẩu" autoComplete="current-password"/><FormControlLabel control={<Checkbox name="rememberMe"/>} label="Ghi nhớ đăng nhập trên thiết bị này"/><Button variant="contained" type="submit" disabled={loading}>{loading?'Đang đăng nhập…':'Đăng nhập'}</Button></Stack></Paper></Container>;
  if(loading||!session)return <Container sx={{py:5}}>{error?<Alert severity="error" action={<Button onClick={()=>{clearPartnerToken();setToken('');}}>Đăng nhập lại</Button>}>{error}</Alert>:<CircularProgress/>}</Container>;
  const company=session.company,canManage=session.member?.role==='ADMIN',mustChange=session.member?.mustChangePassword;
  const api=(path,options={})=>partnerRequest(path,{token,...options});
  const booking={quote:async payload=>(await api('/quote',{method:'POST',body:payload})).data,createTrip:payload=>api('/trips',{method:'POST',body:payload})};
  return <FloatingActionsProvider>
    {!mustChange&&<TripChatHub partnerTokenKey={key}/>}
    <AppBar position="sticky"><Toolbar sx={{gap:2,flexWrap:'wrap',py:1}}>{company?.logoUrl&&<Box component="img" src={company.logoUrl} alt="Logo công ty" sx={{width:70,height:42,objectFit:'contain',bgcolor:'#fff',borderRadius:1}}/>}<Typography sx={{flexGrow:1,fontWeight:700}}>{company?.name} · GoViet247</Typography><Typography variant="body2">{session.member?.displayName}</Typography><Button color="inherit" onClick={logout}>Đăng xuất</Button></Toolbar></AppBar>
    <Container maxWidth="xl" sx={{py:3}}><Stack spacing={3}>
      {error&&<Alert severity="error">{error}</Alert>}
      {!mustChange&&<Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">{[['/dat-xe','Đặt xe'],['/chuyen-xe','Chuyến xe'],...(canManage?[['/nhan-vien','Nhân viên']]:[]),['/cai-dat','Cài đặt']].map(([to,label])=><Button key={to} component={Link} to={to} variant="outlined">{label}</Button>)}</Stack>}
      {mustChange?<><Alert severity="info">Vui lòng đổi mật khẩu ban đầu trước khi sử dụng.</Alert><PartnerSettings token={token} passwordOnly onPasswordChanged={acceptToken}/></>:<Routes>
        <Route path="/dat-xe" element={<><Alert severity="info">Tài xế trao đổi với điều phối viên qua chat GoViet247. Đối tác liên hệ khách; không cần nhập thông tin khách.</Alert><BookingCard partner={booking}/></>}/>
        <Route path="/chuyen-xe" element={<TripPage token={token}/>}/><Route path="/chuyen-xe/:id" element={<TripPage token={token}/>}/>
        <Route path="/nhan-vien" element={canManage?<PartnerMembers token={token}/>:<Navigate to="/chuyen-xe" replace/>}/>
        <Route path="/cai-dat" element={<PartnerSettings token={token} canManage={canManage} onPasswordChanged={acceptToken}/>}/>
        <Route path="*" element={<Navigate to="/chuyen-xe" replace/>}/>
      </Routes>}
    </Stack></Container>
  </FloatingActionsProvider>;
}
function TripPage({token}){const {id}=useParams(),navigate=useNavigate();return <PartnerTrips token={token} tripId={id} onSelect={id=>navigate('/chuyen-xe/'+id)} onClose={()=>navigate('/chuyen-xe')}/>;}
createRoot(document.getElementById('root')).render(<StrictMode><ThemeProvider theme={theme}><CssBaseline/><BrowserRouter><App/></BrowserRouter></ThemeProvider></StrictMode>);
