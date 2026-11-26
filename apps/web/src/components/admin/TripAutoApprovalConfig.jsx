import {useEffect,useRef,useState} from 'react';
import {Alert,Box,Button,CircularProgress,FormControlLabel,Paper,Stack,Switch,Typography} from '@mui/material';
import {getAdminToken} from '../../utils/adminAuth';

const endpoint=(import.meta.env.VITE_API_BASE || 'http://localhost:5050')+'/api/admin/trip-config/auto-approval';
async function request(options={}) {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try {
    const response=await fetch(endpoint,{...options,signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+getAdminToken()},cache:'no-store'});
    const data=await response.json();
    if(!response.ok || !data.success)throw new Error(data.message || 'Không tải được cấu hình tự duyệt.');
    return data.item;
  } catch(error) {if(error.name === 'AbortError')throw new Error('Chưa nhận được phản hồi. Hãy tải lại để kiểm tra trạng thái đã lưu.');throw error;}
  finally {clearTimeout(timer);}
}
const switches=[['autoApproveNewTrips','Tự duyệt chuyến mới','Sau khi khách xác thực và đặt chuyến thành công.'],
 ['autoApproveRequeuedTrips','Tự duyệt lại chuyến tài xế huỷ','Khi tài xế huỷ hoặc điều hành đưa chuyến tài xế huỷ về chờ duyệt để tìm tài xế khác.']];
export default function TripAutoApprovalConfig() {
  const [config,setConfig]=useState(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[saved,setSaved]=useState('');
  const alive=useRef(true),generation=useRef(0);
  async function load() {const current=++generation.current;setBusy(true);try{const value=await request();if(alive.current && current === generation.current){setConfig(value);setError('');}}catch(e){if(alive.current && current === generation.current){setConfig(null);setError(e.message);}}finally{if(alive.current && current === generation.current)setBusy(false);}}
  useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;};},[]);
  async function toggle(field,value) {
    const current=++generation.current;setBusy(true);setError('');setSaved('');
    try {const next=await request({method:'PATCH',body:JSON.stringify({[field]:value,expectedUpdatedAt:config.updatedAt})});if(alive.current && current === generation.current){setConfig(next);setSaved('Đã lưu công tắc. Áp dụng cho yêu cầu phát sinh từ bây giờ.');}}
    catch(e){if(alive.current && current === generation.current)setError(e.message);try{const latest=await request();if(alive.current && current === generation.current)setConfig(latest);}catch{if(alive.current && current === generation.current)setConfig(null);}}
    finally{if(alive.current && current === generation.current)setBusy(false);}
  }
  return <Paper variant="outlined" sx={{p:{xs:2,sm:3},borderRadius:3}}><Stack spacing={2}>
    <Typography variant="h6">Duyệt chuyến tự động</Typography>
    <Typography variant="body2" color="text.secondary">Phát cho tài xế đã xác nhận khu vực thuộc miền của điểm đón. Hai công tắc lưu ngay và hoạt động độc lập; mặc định tắt. Không tự xử lý các chuyến cũ đang chờ.</Typography>
    {error && <Alert severity="error">{error}</Alert>}{saved && <Alert severity="success">{saved}</Alert>}
    {switches.map(([field,label,description])=><Box key={field} sx={{pb:1,borderBottom:'1px solid',borderColor:'divider'}}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Typography fontWeight={700}>{label}</Typography>
        <FormControlLabel sx={{mr:0,flexShrink:0}} label={<><Box component="span" sx={{position:'absolute',width:1,height:1,p:0,m:-1,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap',border:0}}>{label}: </Box>{!config ? 'Chưa tải' : config[field] ? 'Đang bật' : 'Đang tắt'}</>} control={<Switch slotProps={{input:{'aria-label':label}}} checked={config?.[field] === true} disabled={busy || !config} onChange={(_,checked)=>toggle(field,checked)}/>} />
      </Stack><Typography variant="body2" color="text.secondary">{description}</Typography>
    </Box>)}
    <Alert severity="info">Chỉ tự duyệt khi xác minh được điểm đón và tất cả điểm đến: số nhà, địa điểm cụ thể, hoặc ấp/thôn kèm xã và tỉnh. Địa chỉ quá chung, chưa rõ miền hoặc chưa có tài xế trong miền sẽ giữ chờ duyệt và thông báo điều hành. Đây là bước sàng lọc, không bảo đảm địa chỉ thực tế chính xác.</Alert>
    <Typography variant="body2">Mỗi lần tự duyệt thành công đều có thông báo cập nhật chuyến và lưu lịch sử. Hoàn ví/ghi phạt khi huỷ giữ theo lựa chọn hiện tại.</Typography>
    <Box><Button disabled={busy} onClick={load}>{busy ? <CircularProgress size={18}/> : 'Tải lại trạng thái'}</Button></Box>
  </Stack></Paper>;
}
