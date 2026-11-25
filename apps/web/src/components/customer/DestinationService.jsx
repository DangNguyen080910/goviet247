import { driverTourSummary } from "../../../../api/src/shared/driverTourSummary.js";
import { Box, Typography, Radio, FormControlLabel, RadioGroup, Alert } from "@mui/material";
import { destinationConfig, destinationDescription, destinationDays, destinationSummary, destinationQuoteSummary } from "../../../../../packages/shared/destinationService.js";
export function ServiceSummary({ snapshot, admin = false, quote = false, config }) {
  // Only booked destination-service packages belong in this panel.
  if (snapshot?.eligible !== true && !quote) return null;
  const defaults = destinationConfig(config);
  const notices = [
    snapshot?.allInclusiveNotice || defaults.allInclusiveNotice,
    snapshot?.paymentNotice || defaults.paymentNotice,
  ];
  return (
    <Box sx={{ my: 1, p: 1.5, bgcolor: "#f0f7ff", color: "#1e3a5f", borderRadius: 2 }}>
      {(quote ? destinationQuoteSummary(snapshot, config) : admin ? driverTourSummary(snapshot) : destinationSummary(snapshot)).map((line, index) => (
        <Typography key={index} variant="body2" sx={{ color: "#1e3a5f", mb: 0.7, whiteSpace: "pre-line", fontWeight: notices.includes(line) || line.startsWith("Phụ phí phục vụ tour:") ? 700 : 400 }}>
          {line}
        </Typography>
      ))}
    </Box>
  );
}
export default function DestinationService({ config, direction, pickup, returnTime, outboundMinutes, mode = "STANDARD", onMode }) {
 const c = destinationConfig(config), days = destinationDays(c, direction, pickup, returnTime, outboundMinutes);
 if (!days.length) return null;
 const charterAvailable = days.some(day => day.charter);
 return <Box sx={{my:2,p:2,border:"1px solid #bfdbfe",borderRadius:2}}>
  <Typography fontWeight={800}>{c.title}</Typography>
  <Typography variant="body2" sx={{mb:1}}>Chọn một gói cho toàn bộ thời gian lưu trú tại điểm đến.</Typography>
  <RadioGroup aria-label="Gói phục vụ tại điểm đến" name="destination-service-mode" value={mode} onChange={event => onMode(event.target.value)}>
   <Box sx={{p:1.5,border:"1px solid",borderColor:mode === "STANDARD" ? "primary.main" : "divider",borderRadius:2,mb:1}}>
    <FormControlLabel value="STANDARD" control={<Radio />} label={c.standardName} />
    <Typography variant="body2">{destinationDescription(c)}</Typography>
    <Typography variant="body2">Giờ hỗ trợ: {String(c.standardStartHour).padStart(2,"0")}:00–{String(c.standardEndHour).padStart(2,"0")}:00</Typography>
   </Box>
   <Box sx={{p:1.5,border:"1px solid",borderColor:mode === "CHARTER" ? "primary.main" : "divider",borderRadius:2}}>
    <FormControlLabel value="CHARTER" disabled={!charterAvailable} control={<Radio />} label={c.charterName} />
    <Typography variant="body2">{destinationDescription(c,true)}</Typography>
    {!charterAvailable && <Typography variant="body2">Chưa có khung phục vụ Bao xe phù hợp với lịch này.</Typography>}
   </Box>
  </RadioGroup>
  <Alert severity="info" sx={{mt:1}}>{c.outsideNotice}</Alert>
 </Box>;
}
