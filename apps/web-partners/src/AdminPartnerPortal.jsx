import {useState} from 'react';
import {Alert,AppBar,Button,Container,Stack,Toolbar,Typography} from '@mui/material';
import AdminPartners from '../../web/src/pages/admin/AdminPartners';
import TripChatHub from '../../web/src/components/TripChatHub';
import {FloatingActionsProvider} from '../../web/src/components/FloatingActionsContext';
import {partnerTokenKey} from '../../web/src/components/partners/partnerSession';

export default function AdminPartnerPortal({token,admin,onLogout,error}) {
  const [company,setCompany]=useState(null);
  return <FloatingActionsProvider>
    <TripChatHub partnerTokenKey={partnerTokenKey} adminMode/>
    <AppBar position="sticky"><Toolbar sx={{gap:2,flexWrap:'wrap',py:1}}>
      <Typography sx={{flexGrow:1,fontWeight:700}}>GoViet247 · Quản trị đối tác</Typography>
      <Typography>{admin?.username}</Typography><Button color="inherit" onClick={onLogout}>Đăng xuất</Button>
    </Toolbar></AppBar>
    <Container maxWidth="xl" sx={{py:3}}><Stack spacing={3}>
      <Alert severity="info">{company ? `GoViet247 đang hỗ trợ · ${company.name} (${company.code})` : 'Bạn đang dùng quyền quản trị GoViet247. Chọn công ty cần hỗ trợ bên dưới.'}</Alert>
      {error&&<Alert severity="error">{error}</Alert>}
      <AdminPartners sessionToken={token} sessionUser={admin} onCompanyChange={setCompany} portal/>
    </Stack></Container>
  </FloatingActionsProvider>;
}
