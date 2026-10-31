import { Box, Button, Typography } from "@mui/material";
import { hasActiveTripContact, phoneCallUrl } from "../../../../api/src/shared/tripContact.js";
export default function DriverContact({ trip }) {
  const contact = trip.driverContact;
  if (!hasActiveTripContact(trip.status) || !contact) return null;
  const url = phoneCallUrl(contact.phone);
  return <Box sx={{ p:1.5, border:"1px solid #bfdbfe", borderRadius:2, bgcolor:"#eff6ff" }}>
    <Typography sx={{ fontWeight:700 }}>Tài xế: {contact.name || "Tài xế"}</Typography>
    {contact.phone && <Typography sx={{ mt:0.5 }}>Số điện thoại: {contact.phone}</Typography>}
    {url && <Button component="a" href={url} variant="contained" size="small" sx={{ mt:1 }}>📞 Gọi tài xế</Button>}
  </Box>;
}
