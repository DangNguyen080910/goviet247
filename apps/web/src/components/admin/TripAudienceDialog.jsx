import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Checkbox, FormControlLabel, Alert, Stack } from '@mui/material';
import { fetchAudienceCandidates, verifyTrip } from '../../api/adminTrips';
export default function TripAudienceDialog({ tripId, onClose, onDone }) {
  const [items, setItems] = useState([]), [selected, setSelected] = useState([]), [q, setQ] = useState('');
  const [error, setError] = useState(''), [info, setInfo] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; setLoading(true); setError('');
    fetchAudienceCandidates(tripId).then(data => { if (active) { setItems(data.items); setInfo(`Gợi ý: ${data.config.radiusKm} km / ${data.config.days} ngày. ${data.warning}`); } }).catch(e => { if(active) setError(e.message); }).finally(() => { if(active) setLoading(false); });
    return () => { active = false; };
  }, [tripId]);
  async function submit() { setBusy(true); setError(''); try { await verifyTrip(tripId, 'Duyệt cho tài xế chỉ định', selected); onDone(); } catch(e) { setError(e.message); } finally { setBusy(false); } }
  return <Dialog open fullWidth onClose={busy ? undefined : onClose}>
    <DialogTitle>Duyệt và show cho tài xế chỉ định</DialogTitle>
    <DialogContent><Stack spacing={1}>
      <Alert severity="info">{info || 'Đang tải tài xế…'} Chỉ tài xế được chọn thấy chuyến. Người nhận trước chạy chuyến và chịu phí theo quy định hiện tại.</Alert>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Tìm tên, SĐT, biển số" value={q} onChange={e => setQ(e.target.value)} />
      {!loading && items.length === 0 && <Alert severity="warning">Không có tài xế đủ điều kiện.</Alert>}
      {items.filter(d => `${d.name} ${d.phone} ${d.plateNumber}`.toLocaleLowerCase('vi').includes(q.toLocaleLowerCase('vi'))).map(d => <FormControlLabel key={d.userId} control={<Checkbox disabled={busy} checked={selected.includes(d.userId)} onChange={(_, checked) => setSelected(s => checked ? [...s, d.userId] : s.filter(id => id !== d.userId))}/>} label={`${d.name} • ${d.phone} • ${d.plateNumber || ''}${d.suggestion ? ` — Gợi ý: cách ${d.suggestion.distanceKm} km, chuyến ${d.suggestion.tripId}` : ''}`} />)}
    </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={onClose}>Đóng</Button><Button variant="contained" disabled={busy || loading || !selected.length || selected.length > 100} onClick={submit}>{busy ? 'Đang duyệt…' : `Duyệt cho ${selected.length} tài xế`}</Button></DialogActions>
  </Dialog>;
}
