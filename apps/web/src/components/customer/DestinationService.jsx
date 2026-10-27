import { driverTourSummary } from "../../../../api/src/shared/driverTourSummary.js";
import { Box, Typography, TextField, Checkbox, Radio, FormControlLabel, Alert } from "@mui/material";
import { destinationConfig, destinationDescription, destinationWindows, destinationSummary, vnTime } from "../../../../../packages/shared/destinationService.js";
export function ServiceSummary({ snapshot, admin = false }) {
  const defaults = destinationConfig();
  const notices = [
    snapshot?.allInclusiveNotice || defaults.allInclusiveNotice,
    snapshot?.paymentNotice || defaults.paymentNotice,
  ];
  return (
    <Box sx={{ my: 1, p: 1.5, bgcolor: "#f0f7ff", borderRadius: 2 }}>
      {(admin ? driverTourSummary(snapshot) : destinationSummary(snapshot)).map((line, index) => (
        <Typography key={index} variant="body2" sx={{ mb: 0.7, whiteSpace: "pre-line", fontWeight: notices.includes(line) || line.startsWith("Phụ phí phục vụ tour:") ? 700 : 400 }}>
          {line}
        </Typography>
      ))}
    </Box>
  );
}
export default function DestinationService({ config, direction, pickup, returnTime, outboundMinutes, anchor, onAnchor, dates, onDates }) {
 const c=destinationConfig(config), windows=destinationWindows(c,direction,pickup,returnTime,outboundMinutes);
 if (!windows.length) return null;
 return <Box sx={{my:2,p:2,border:"1px solid #bfdbfe",borderRadius:2}}>
  <Typography fontWeight={800}>{c.title}</Typography><Typography variant="body2">{c.introduction}</Typography>
  <TextField fullWidth sx={{my:2}} label="Nơi lưu trú làm mốc phục vụ" value={anchor} onChange={e=>onAnchor(e.target.value)} helperText="Xác nhận khách sạn/nơi lưu trú tại điểm đến. Thêm điểm tham quan không thay đổi mốc này." />
  <FormControlLabel control={<Radio checked={!dates.length} onChange={()=>onDates([])} />} label={`${c.standardName} — Đã bao gồm trong giá`} /><Typography variant="body2">{destinationDescription(c)}</Typography>
  <Typography variant="body2">Giờ hỗ trợ: {c.standardStartHour}:00–{c.standardEndHour}:00</Typography>
  <FormControlLabel sx={{mt:2}} control={<Radio checked={!!dates.length} onChange={()=>{if(!dates.length)onDates([windows[0].date]);}} />} label={`${c.charterName} — +${c.charterDailyFee.toLocaleString("vi-VN")}đ/ngày phục vụ`} /><Typography variant="body2">{destinationDescription(c,true)}</Typography>
  <Typography variant="body2" sx={{mt:1}}>Chọn ngày dùng Bao xe. Ngày không chọn áp dụng Tiêu chuẩn. Ngày đến/về chỉ phục vụ trong khoảng giờ bên dưới; mỗi ngày chọn tính đủ một ngày phí.</Typography>
  {windows.map(w=><FormControlLabel key={w.date} sx={{display:"flex"}} control={<Checkbox checked={dates.includes(w.date)} onChange={e=>onDates(e.target.checked?[...dates,w.date]:dates.filter(d=>d!==w.date))}/>} label={`${w.date}: ${vnTime(w.start)}–${vnTime(w.end)} (${w.hours} giờ)`}/>)}
  <Typography fontWeight={700}>Phụ phí Bao xe: {(dates.length*c.charterDailyFee).toLocaleString("vi-VN")}đ ({dates.length} ngày)</Typography>
  <Alert severity="info" sx={{mt:1}}>{c.outsideNotice}</Alert>
 </Box>;
}
