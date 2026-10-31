import { useEffect, useState } from "react";
import { Alert, Button, Stack, TextField, Typography } from "@mui/material";
import { getAdminToken } from "../../utils/adminAuth";
const BASE = String(import.meta.env.VITE_API_BASE || "http://localhost:5050").replace(/\/api\/?$/, "");
export default function TripDriverNoteEditor({tripId}) {
  const [text,setText]=useState("");const [version,setVersion]=useState("");const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [saved,setSaved]=useState(false);
  async function request(method="GET",body) {
    const response=await fetch(`${BASE}/api/admin/trips/${encodeURIComponent(tripId)}${method==="PATCH"?"/driver-note":""}`,{method,headers:{Authorization:`Bearer ${getAdminToken()}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
    const data=await response.json();if(!response.ok||!data.success)throw new Error(data.message||"Không tải/lưu được ghi chú.");return data;
  }
  async function load(){setBusy(true);setError("");setSaved(false);try{const data=await request();setText(data.trip.dispatcherNote||"");setVersion(data.trip.updatedAt);setStatus(data.trip.status);}catch(e){setError(e.message);}finally{setBusy(false);}}
  useEffect(()=>{void load();},[tripId]);
  async function save(){setBusy(true);setError("");setSaved(false);try{const data=await request("PATCH",{dispatcherNote:text,expectedUpdatedAt:version});setText(data.dispatcherNote||"");setVersion(data.updatedAt);setSaved(true);}catch(e){setError(e.message);}finally{setBusy(false);}}
  const ended=["COMPLETED","CANCELLED"].includes(status);
  return <Stack spacing={1} sx={{my:2,p:1.5,border:"1px solid #f59e0b",borderRadius:2,bgcolor:"#fffbeb",color:"#78350f"}}>
    <Typography fontWeight={700}>Ghi chú điều hành — gửi tài xế</Typography>
    <Typography variant="body2">Tài xế sẽ thấy nội dung này. Không hiển thị cho khách; khác với ghi chú xác nhận nội bộ.</Typography>
    <TextField multiline minRows={2} value={text} onChange={e=>{setText(e.target.value);setSaved(false);}} disabled={busy||ended} inputProps={{maxLength:2000}} placeholder="Ví dụ: Gọi khách xác nhận trước khi đến điểm đón."/>
    {!!error&&<Alert severity="error">{error}</Alert>}{saved&&<Alert severity="success">Đã lưu ghi chú gửi tài xế.</Alert>}
    <Stack direction="row" spacing={1}><Button onClick={save} disabled={busy||ended||!version} variant="contained">Lưu ghi chú gửi tài xế</Button><Button disabled={busy} onClick={load}>Tải lại ghi chú</Button></Stack>
  </Stack>;
}
