import { driverTourSummary } from "../../../../api/src/shared/driverTourSummary.js";
import { Box, Typography, TextField, Checkbox, Radio, FormControlLabel, Alert } from "@mui/material";
import { destinationConfig, destinationDescription, destinationWindows, destinationDays, destinationDayText, destinationSelectedFee, destinationSummary, vnTime } from "../../../../../packages/shared/destinationService.js";
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
 const c=destinationConfig(config), windows=destinationDays(c,direction,pickup,returnTime,outboundMinutes);
 if (!windows.length) return null;
 return <Box sx={{my:2,p:2,border:"1px solid #bfdbfe",borderRadius:2}}>
  <Typography fontWeight={800}>{c.title}</Typography><Typography variant="body2">{c.introduction}</Typography>
  <TextField fullWidth sx={{my:2}} label="Nơi lưu trú làm mốc phục vụ" value={anchor} onChange={e=>onAnchor(e.target.value)} helperText="Xác nhận khách sạn/nơi lưu trú tại điểm đến. Thêm điểm tham quan không thay đổi mốc này." />
  <Typography fontWeight={700}>{c.standardName} — Đã bao gồm trong giá</Typography><Typography variant="body2">{destinationDescription(c)}</Typography>
  <Typography variant="body2">Giờ hỗ trợ: {c.standardStartHour}:00–{c.standardEndHour}:00</Typography>
  <Typography fontWeight={700} sx={{mt:2}}>{c.charterName} — +{c.charterDailyFee.toLocaleString("vi-VN")}đ/khung ngày {c.charterStartHour}:00–{c.charterEndHour}:00</Typography><Typography variant="body2">{destinationDescription(c,true)}</Typography>
  <Typography variant="body2" sx={{mt:1}}>Chọn ngày dùng Bao xe. Ngày không chọn áp dụng Tiêu chuẩn.</Typography>
  {windows.map(w=><Box key={w.date} sx={{p:1.5,my:1,border:'1px solid #bfdbfe',borderRadius:2}}>
    <Typography fontWeight={700}>{w.date}</Typography>
    <FormControlLabel control={<Radio checked={!dates.includes(w.date)} onChange={()=>onDates(dates.filter(d=>d!==w.date))}/>} label={`${c.standardName} — Đã bao gồm trong giá`}/>
    <FormControlLabel control={<Radio disabled={!w.charter} checked={dates.includes(w.date)} onChange={()=>onDates([...dates.filter(d=>d!==w.date),w.date])}/>} label={`${c.charterName} — +${(w.charter?.fee || 0).toLocaleString('vi-VN')}đ`}/>
    <Typography variant="body2">{destinationDayText(w,dates.includes(w.date),c)}</Typography>
    {!w.charter && <Typography variant="body2">Không còn khung giờ Bao xe phù hợp trong ngày này.</Typography>}
  </Box>)}
  <Typography fontWeight={700}>Phụ phí Bao xe: {destinationSelectedFee(windows,dates).toLocaleString("vi-VN")}đ ({dates.length} ngày)</Typography>
  <Alert severity="info" sx={{mt:1}}>{c.outsideNotice}</Alert>
 </Box>;
}
