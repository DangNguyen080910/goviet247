import MoneyTextField from "../common/MoneyTextField";
import React from "react";
import { Box, TextField, Button, Typography, Switch, FormControlLabel, Alert } from "@mui/material";
import { fetchTripConfig, patchTripConfig } from "../../api/adminConfig";
import { destinationConfig, destinationDescription, destinationWindows, charterPricingHours, charterTripFee, wholeTripCharterTemplate } from "../../../../../packages/shared/destinationService.js";
import DestinationService, { ServiceSummary } from "../customer/DestinationService";
const numbers = {charterRadiusKm:"Bao xe: phạm vi (km)",charterHoursPerDay:"Bao xe: giờ sử dụng tối đa/ngày",charterStartHour:"Bao xe: mốc đầu quy đổi giá (giờ)",charterEndHour:"Bao xe: mốc cuối quy đổi giá (giờ)",charterDailyFee:"Bao xe: phí tối đa mỗi 24 giờ (đ)"};
const texts = {title:"Tiêu đề",introduction:"Giới thiệu",standardName:"Tên gói Không bao xe",standardDescription:"Nội dung Không bao xe",charterName:"Tên gói Bao xe",charterDescription:"Nội dung Bao xe (dùng {radius} và {hours})",outsideNotice:"Hướng dẫn ngoài phạm vi",allInclusiveNotice:"Thông báo giá trọn gói khi tính giá (mọi chuyến)",paymentNotice:"Hướng dẫn thanh toán",scopeNotice:"Phạm vi áp dụng giá trọn gói"};
const previewTrip = {
  direction: "ROUND_TRIP",
  pickup: "2026-11-01T07:00:00+07:00",
  returnTime: "2026-11-03T12:00:00+07:00",
  outboundMinutes: 240,
};
export default function DestinationServiceConfig() {
 const [c,setC]=React.useState(null), [error,setError]=React.useState(""), [saved,setSaved]=React.useState(false), [busy,setBusy]=React.useState(false);
 const [previewMode,setPreviewMode]=React.useState("STANDARD"), [anchor,setAnchor]=React.useState("Khách sạn tại điểm đến");
 const load=()=>{setError("");fetchTripConfig().then(row=>{
   const config = destinationConfig(row.destinationServiceConfig);
   setC({ ...config, charterDescription: wholeTripCharterTemplate(config.charterDescription) });
 }).catch(e=>setError(e.message));};
 React.useEffect(()=>{load();},[]);
 const field=(key,value)=>{setC(old=>({...old,[key]:value}));setSaved(false);};
 if(!c) return <Box>{error?<Alert severity="error">{error}<Button onClick={load}>Thử lại</Button></Alert>:"Đang tải cấu hình…"}</Box>;
 const pricingHours = charterPricingHours(c);
 const canPreviewFee = pricingHours !== null && Number.isInteger(c.charterDailyFee) && c.charterDailyFee >= 0;
 const previewSessions = previewMode === "CHARTER" && canPreviewFee
   ? destinationWindows(c, previewTrip.direction, previewTrip.pickup, previewTrip.returnTime, previewTrip.outboundMinutes, true)
   : [];
 return <Box><Typography variant="h6">Phục vụ tại điểm đến</Typography><Typography>Phí Bao xe tính từ lúc dự kiến đến điểm cuối đến lúc bắt đầu quay về. Hai mốc giờ dùng để quy đổi đơn giá. Phí đạt trần thì giữ nguyên đến hết chu kỳ 24 giờ tính từ lúc đến. Cước hai chặng và phí ăn nghỉ tài xế được tính riêng. Thay đổi áp dụng cho báo giá mới.</Typography>
 <FormControlLabel control={<Switch checked={c.enabled} onChange={e=>field("enabled",e.target.checked)}/>} label="Cho chọn gói tại điểm đến (chỉ hiển thị thông tin gói trên chuyến có áp dụng)"/>
 <Box sx={{display:"grid",gridTemplateColumns:{xs:"1fr",md:"1fr 1fr"},gap:2,my:2}}>{Object.entries(numbers).map(([key,label])=><MoneyTextField moneySuggestions={key === "charterDailyFee"} key={key} type="number" label={label} value={c[key]} onChange={e=>field(key,e.target.value === "" ? "" : Number(e.target.value))}/>)}</Box>
 {canPreviewFee && <Typography variant="body2" sx={{ mb: 2 }}>
   {c.charterDailyFee.toLocaleString("vi-VN")}đ ÷ {pricingHours} giờ ≈ {Math.round(c.charterDailyFee / pricingHours).toLocaleString("vi-VN")}đ/giờ · đạt trần sau {pricingHours} giờ trong mỗi chu kỳ 24 giờ
 </Typography>}
 {Object.entries(texts).map(([key,label])=><TextField fullWidth multiline key={key} sx={{mb:2}} label={label} value={c[key]} onChange={e=>field(key,e.target.value)}/>)}
 {error&&<Alert severity="error">{error}</Alert>}{saved&&<Alert severity="success">Đã lưu cấu hình.</Alert>}
 <Button variant="contained" disabled={busy} onClick={async()=>{setBusy(true);setError("");setSaved(false);try{const row=await patchTripConfig({destinationServiceConfig:{ ...c, charterDescription: wholeTripCharterTemplate(c.charterDescription) }});setC(destinationConfig(row.destinationServiceConfig));setSaved(true);}catch(e){setError(e.message);}finally{setBusy(false);}}}>Lưu cấu hình phục vụ</Button>
 <Typography variant="h6" sx={{mt:3}}>Xem trước nội dung khách chọn</Typography>
 <DestinationService config={c} {...previewTrip} anchor={anchor} onAnchor={setAnchor} mode={previewMode} onMode={setPreviewMode}/>
 <Typography variant="h6">Xem trước nội dung chuyến Rider / Driver</Typography>
 <ServiceSummary quote config={c} snapshot={{
   version: 5,
   eligible: c.enabled,
   selectionMode: previewMode,
   title: c.title,
   standardName: c.standardName,
   standardDescription: destinationDescription(c),
   charterName: c.charterName,
   charterDescription: destinationDescription(c, true, true),
   sessions: previewSessions,
   fee: previewMode === "CHARTER" && canPreviewFee
     ? charterTripFee(c, previewSessions)
     : undefined,
   outsideNotice: c.outsideNotice,
   allInclusiveNotice: c.allInclusiveNotice,
   paymentNotice: c.paymentNotice,
   scopeNotice: c.scopeNotice,
 }} />
 </Box>;
}
