import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Checkbox, FormControlLabel, Alert, Stack, Typography } from '@mui/material';
import { fetchAudienceCandidates, verifyTrip } from '../../api/adminTrips';

const CARS = { CAR_5: 'Xe 5 chỗ', CAR_7: 'Xe 7 chỗ', CAR_16: 'Xe 16 chỗ', ELECTRIC: 'Xe điện', GASOLINE: 'Xe xăng' };
export default function TripAudienceDialog({ tripId, onClose, onDone }) {
  const [items, setItems] = useState([]), [selected, setSelected] = useState([]), [q, setQ] = useState(''), [carType, setCarType] = useState('');
  const [error, setError] = useState(''), [info, setInfo] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setInfo(''); setItems([]); setSelected([]); setCarType(''); setQ('');
    fetchAudienceCandidates(tripId).then(data => {
      if (active) { setItems(data.items); setInfo('Gợi ý: ' + data.config.radiusKm + ' km / ' + data.config.days + ' ngày. ' + data.warning); }
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tripId]);
  function selectGroup(type) {
    setCarType(type); setQ(''); setError('');
    setSelected(type ? items.filter(d => (d.carType === type || d.vehicleFuelType === type)).map(d => d.userId) : []);
  }
  const limit = carType ? 10000 : 100;
  const cannotSubmit = busy || loading || !selected.length || selected.length > limit;
  const visible = items.filter(d => (!carType || (d.carType === carType || d.vehicleFuelType === carType)) && (d.name + ' ' + d.phone + ' ' + d.plateNumber).toLocaleLowerCase('vi').includes(q.toLocaleLowerCase('vi')));
  async function submit() {
    if (cannotSubmit) return;
    setBusy(true); setError('');
    try { await verifyTrip(tripId, carType ? 'Duyệt nhóm ' + CARS[carType] + ', ' + selected.length + ' tài xế được chọn' : 'Duyệt cho tài xế chỉ định', selected, carType || undefined); onDone(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <Dialog open fullWidth onClose={busy ? undefined : onClose}>
    <DialogTitle>Duyệt cho tài xế chỉ định</DialogTitle>
    <DialogContent><Stack spacing={1.5}>
      <Alert severity="info">{info || 'Đang tải tài xế…'} Chỉ tài xế được chọn thấy chuyến. Người nhận trước chạy chuyến và chịu phí theo quy định hiện tại.</Alert>
      {error && <Alert severity="error">{error}</Alert>}
      <Typography fontWeight={700}>Chọn nhanh theo loại xe hoặc nhiên liệu</Typography>
      <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1}>
        {Object.entries(CARS).map(([type, label]) => {
          const count = items.filter(d => (d.carType === type || d.vehicleFuelType === type)).length;
          return <Button key={type} disabled={busy || loading || !count} variant={carType === type ? 'contained' : 'outlined'} onClick={() => selectGroup(type)}>Tất cả {label.toLowerCase()} ({count})</Button>;
        })}
        <Button disabled={busy || loading} variant={!carType ? 'contained' : 'outlined'} onClick={() => selectGroup('')}>Chọn từng tài xế</Button>
      </Stack>
      <Typography variant="body2">Chọn nhóm sẽ thay danh sách đang chọn. Có thể bỏ chọn từng người; tìm kiếm không làm thay đổi nhóm đã chọn.</Typography>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography fontWeight={700}>Đã chọn: {selected.length} tài xế{carType ? ' · ' + CARS[carType] : ''}</Typography>
        <Button disabled={busy || loading || !selected.length} onClick={() => setSelected([])}>Bỏ chọn hết</Button>
      </Stack>
      {selected.length > limit && <Alert severity="warning">Tối đa {limit} tài xế mỗi lần. Hãy giảm danh sách trước khi duyệt.</Alert>}
      <TextField disabled={busy || loading} label="Tìm tên, SĐT, biển số" value={q} onChange={e => setQ(e.target.value)} />
      {!loading && !visible.length && <Alert severity="warning">Không có tài xế phù hợp trong danh sách.</Alert>}
      {visible.map(d => <FormControlLabel key={d.userId} control={<Checkbox disabled={busy || loading} checked={selected.includes(d.userId)} onChange={(_, checked) => setSelected(s => checked ? [...new Set([...s, d.userId])] : s.filter(id => id !== d.userId))}/>}
        label={d.name + ' • ' + (CARS[d.carType] || d.vehicleType || 'Chưa rõ loại xe') + ' • ' + (CARS[d.vehicleFuelType] || 'Chưa cập nhật nhiên liệu') + ' • ' + d.phone + ' • ' + (d.plateNumber || '') + (d.suggestion ? ' — Gợi ý: cách ' + d.suggestion.distanceKm + ' km, chuyến ' + d.suggestion.tripId : '')} />)}
      <Typography variant="caption" color="text.secondary">Danh sách được chốt khi duyệt; tài xế đăng ký sau không tự được thêm vào chuyến này.</Typography>
    </Stack></DialogContent>
    <DialogActions><Button disabled={busy} onClick={onClose}>Đóng</Button><Button variant="contained" disabled={cannotSubmit} onClick={submit}>{busy ? 'Đang duyệt…' : 'Duyệt cho ' + selected.length + ' tài xế'}</Button></DialogActions>
  </Dialog>;
}
