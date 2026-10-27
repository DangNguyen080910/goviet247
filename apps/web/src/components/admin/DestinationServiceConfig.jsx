import React from "react";
import { Box, TextField, Button, Typography, Switch, FormControlLabel, Alert } from "@mui/material";
import { fetchTripConfig, patchTripConfig } from "../../api/adminConfig";
import { destinationConfig, destinationDescription, destinationWindows } from "../../../../../packages/shared/destinationService.js";
import DestinationService, { ServiceSummary } from "../customer/DestinationService";
const numbers = {standardRadiusKm:"Tiêu chuẩn: phạm vi (km)",standardTripsPerDay:"Tiêu chuẩn: lượt khứ hồi/ngày",standardStartHour:"Tiêu chuẩn: giờ bắt đầu",standardEndHour:"Tiêu chuẩn: giờ kết thúc",charterRadiusKm:"Bao xe: phạm vi (km)",charterHoursPerDay:"Bao xe: giờ tối đa/ngày",charterStartHour:"Bao xe: giờ bắt đầu",charterEndHour:"Bao xe: giờ kết thúc",charterDailyFee:"Bao xe: phụ phí/ngày (đ)"};
const texts = {title:"Tiêu đề",introduction:"Giới thiệu",standardName:"Tên gói Tiêu chuẩn",standardDescription:"Nội dung Tiêu chuẩn — dùng {trips}, {radius}",charterName:"Tên gói Bao xe",charterDescription:"Nội dung Bao xe — dùng {radius}, {hours}, {start}, {end}",outsideNotice:"Hướng dẫn ngoài phạm vi",allInclusiveNotice:"Thông báo giá trọn gói cho mọi chuyến",paymentNotice:"Hướng dẫn thanh toán",scopeNotice:"Phạm vi áp dụng giá trọn gói"};
export default function DestinationServiceConfig() {
 const [c,setC]=React.useState(null), [error,setError]=React.useState(""), [saved,setSaved]=React.useState(false), [busy,setBusy]=React.useState(false);
 const [previewDates,setPreviewDates]=React.useState([]), [anchor,setAnchor]=React.useState("Khách sạn tại điểm đến");
 const load=()=>{setError("");fetchTripConfig().then(row=>setC(destinationConfig(row.destinationServiceConfig))).catch(e=>setError(e.message));};
 React.useEffect(()=>{load();},[]);
 const field=(key,value)=>{setC(old=>({...old,[key]:value}));setSaved(false);};
 if(!c) return <Box>{error?<Alert severity="error">{error}<Button onClick={load}>Thử lại</Button></Alert>:"Đang tải cấu hình…"}</Box>;
 return <Box><Typography variant="h6">Phục vụ tại điểm đến</Typography><Typography>Dùng chung cho mọi loại xe. Phụ phí này tách riêng phí nghỉ đêm. Thay đổi chỉ áp dụng cho báo giá mới.</Typography>
 <FormControlLabel control={<Switch checked={c.enabled} onChange={e=>field("enabled",e.target.checked)}/>} label="Cho chọn gói tại điểm đến (thông báo giá trọn gói vẫn hiển thị cho mọi chuyến)"/>
 <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",md:"1fr 1fr"},gap:2,my:2}}>{Object.entries(numbers).map(([key,label])=><TextField key={key} type="number" label={label} value={c[key]} onChange={e=>field(key,e.target.value === "" ? "" : Number(e.target.value))}/>)}</Box>
 {Object.entries(texts).map(([key,label])=><TextField fullWidth multiline key={key} sx={{mb:2}} label={label} value={c[key]} onChange={e=>field(key,e.target.value)}/>)}
 {error&&<Alert severity="error">{error}</Alert>}{saved&&<Alert severity="success">Đã lưu cấu hình.</Alert>}
 <Button variant="contained" disabled={busy} onClick={async()=>{setBusy(true);setError("");setSaved(false);try{const row=await patchTripConfig({destinationServiceConfig:c});setC(destinationConfig(row.destinationServiceConfig));setSaved(true);}catch(e){setError(e.message);}finally{setBusy(false);}}}>Lưu cấu hình phục vụ</Button>
 <Typography variant="h6" sx={{mt:3}}>Xem trước nội dung khách chọn</Typography>
 <DestinationService config={c} direction="ROUND_TRIP" pickup="2026-11-01T07:00:00+07:00" returnTime="2026-11-03T12:00:00+07:00" outboundMinutes={240} anchor={anchor} onAnchor={setAnchor} dates={previewDates} onDates={setPreviewDates}/>
 <Typography variant="h6">Xem trước nội dung chuyến Rider / Driver</Typography>
 <ServiceSummary snapshot={{eligible:c.enabled,title:c.title,anchorAddress:anchor,standardName:c.standardName,standardDescription:destinationDescription(c),standardWindow:`${c.standardStartHour}:00–${c.standardEndHour}:00`,charterName:c.charterName,charterDescription:destinationDescription(c,true),sessions:destinationWindows(c,"ROUND_TRIP","2026-11-01T07:00:00+07:00","2026-11-03T12:00:00+07:00",240).filter(w=>previewDates.includes(w.date)),dailyFee:c.charterDailyFee,fee:previewDates.length*c.charterDailyFee,outsideNotice:c.outsideNotice,allInclusiveNotice:c.allInclusiveNotice,paymentNotice:c.paymentNotice,scopeNotice:c.scopeNotice}} />
 </Box>;
}
