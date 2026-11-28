import { driverTourSummary } from "../../../../api/src/shared/driverTourSummary.js";
import { Box, Typography, Radio, FormControlLabel, RadioGroup, Alert } from "@mui/material";
import { destinationConfig, destinationDescription, destinationPackageAvailable, destinationWindows, CHARTER_UNAVAILABLE_MESSAGE, destinationSummary, destinationQuoteSummary, INCLUDED_CHARGES_LABEL, TWO_ONE_WAY_TRIPS_NOTICE } from "../../../../../packages/shared/destinationService.js";
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
      {(quote ? destinationQuoteSummary(snapshot, config) : admin ? driverTourSummary(snapshot) : destinationSummary(snapshot)).map((line, index) => quote && line === TWO_ONE_WAY_TRIPS_NOTICE ? (
        <Alert key={index} severity="warning" icon={false} sx={{ mt: 1 }}>{line}</Alert>
      ) : (
        <Typography key={index} variant="body2" sx={{ color: "#1e3a5f", mb: 0.7, mt: line === INCLUDED_CHARGES_LABEL ? 1 : 0, whiteSpace: "pre-line", fontWeight: line === INCLUDED_CHARGES_LABEL || notices.includes(line) || line.startsWith("Phụ phí phục vụ tour:") || (admin && line.startsWith("Phí Bao xe")) ? 700 : 400 }}>
          {line}
        </Typography>
      ))}
    </Box>
  );
}
export default function DestinationService({ config, direction, pickup, returnTime, outboundMinutes, mode = "STANDARD", onMode }) {
 const c = destinationConfig(config);
 if (!destinationPackageAvailable(c, direction, pickup, returnTime, outboundMinutes)) return null;
 const charterAvailable = destinationWindows(c, direction, pickup, returnTime, outboundMinutes, true).length > 0;
 return <Box sx={{my:2,p:2,border:"1px solid #bfdbfe",borderRadius:2}}>
  <Typography fontWeight={800}>{c.title}</Typography>
  <Typography variant="body2" sx={{ mb: 1, whiteSpace: "pre-line" }}>{c.introduction}</Typography>
  <RadioGroup aria-label="Gói phục vụ tại điểm đến" name="destination-service-mode" value={mode} onChange={event => onMode(event.target.value)}>
   <Box sx={{p:1.5,border:"1px solid",borderColor:mode === "STANDARD" ? "primary.main" : "divider",borderRadius:2,mb:1}}>
    <FormControlLabel value="STANDARD" control={<Radio />} label={c.standardName} />
    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{destinationDescription(c)}</Typography>
   </Box>
   <Box sx={{p:1.5,border:"1px solid",borderColor:mode === "CHARTER" ? "primary.main" : "divider",borderRadius:2}}>
    <FormControlLabel disabled={!charterAvailable} value="CHARTER" control={<Radio />} label={c.charterName} />
    <Typography variant="body2" color={charterAvailable ? "text.primary" : "text.secondary"} sx={{ whiteSpace: "pre-wrap" }}>{destinationDescription(c, true, true)}</Typography>
    {!charterAvailable && <Alert severity="warning" icon={false} sx={{mt:1}}>{CHARTER_UNAVAILABLE_MESSAGE}</Alert>}
   </Box>
  </RadioGroup>
  <Alert severity="info" sx={{mt:1}}>{c.outsideNotice}</Alert>
 </Box>;
}
