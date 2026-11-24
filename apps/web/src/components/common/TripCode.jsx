import CopyTripIdButton from './CopyTripIdButton.jsx';

export default function TripCode({ tripId, label, children }) {
  const value = String(tripId || '').trim();
  if (!value || value === '-' || value === '--') return null;
  return <span style={{display:'inline-flex',alignItems:'center',gap:6,maxWidth:'100%',verticalAlign:'middle'}}>
    <span style={{minWidth:0,overflowWrap:'anywhere'}}>{label}{children ?? value}</span>
    <CopyTripIdButton tripId={value}/>
  </span>;
}
