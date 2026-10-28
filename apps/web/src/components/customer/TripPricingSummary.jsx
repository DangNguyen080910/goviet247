import { useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { driverSurchargeLines } from '../../../../api/src/shared/driverSurcharges.js';
import { riderPackageLines } from '../../../../api/src/shared/riderTripPricing.js';
import { ServiceSummary } from './DestinationService';
export default function TripPricingSummary({ trip }) {
 const [expanded, setExpanded] = useState(false);
 const packages = riderPackageLines(trip?.destinationService);
 const surcharges = driverSurchargeLines(trip);
 if (!packages.length && !surcharges.length) return null;
 return <Box sx={{ my: 1, p: 1.5, bgcolor: '#f0f7ff', color: '#1e3a5f', borderRadius: 2 }}>
  {surcharges.map(line => <Typography key={line} variant="body2" sx={{mb:.5,fontWeight:700,color:'inherit'}}>{line}</Typography>)}
  {packages.map((line,index) => <Typography key={index} variant="body2" sx={{mb:.5,color:'inherit'}}>{line}</Typography>)}
  {!!packages.length && <Button size="small" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>{expanded ? 'Ẩn chi tiết phục vụ' : 'Chi tiết phục vụ'}</Button>}
  {expanded && <ServiceSummary snapshot={trip.destinationService} />}
 </Box>;
}
