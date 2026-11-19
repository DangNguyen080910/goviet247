import React from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import { fetchTripConfig, patchTripConfig } from '../../api/adminConfig';

const regions = [['NORTH', 'Miền Bắc'], ['CENTRAL', 'Miền Trung'], ['SOUTH', 'Miền Nam']];
export default function RegionalPricingConfig() {
  const [row, setRow] = React.useState(null);
  const [values, setValues] = React.useState({ NORTH: '0', CENTRAL: '0', SOUTH: '0' });
  const [error, setError] = React.useState('');
  const [saved, setSaved] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const load = React.useCallback(async () => {
    setLoading(true); setError(''); setSaved(false);
    try {
      const next = await fetchTripConfig();
      setRow(next);
      setValues(Object.fromEntries(regions.map(([key]) => [key, String(next.regionalPricingConfig?.[key] ?? 0)])));
    } catch (e) { setError(e.message || 'Không tải được giá theo miền.'); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);
  async function save() {
    setError(''); setSaved(false);
    const config = Object.fromEntries(regions.map(([key]) => [key, Number(values[key])]));
    if (regions.some(([key]) => values[key].trim() === '' || !Number.isFinite(config[key]) || config[key] < 0 || config[key] > 100 || Math.abs(config[key] * 100 - Math.round(config[key] * 100)) > 1e-8)) {
      setError('Nhập đủ ba mức từ 0 đến 100%, tối đa hai số thập phân.'); return;
    }
    setBusy(true);
    try {
      const next = await patchTripConfig({ regionalPricingConfig: config, expectedUpdatedAt: row.updatedAt });
      setRow(next); setSaved(true);
    } catch (e) { setError(e.message || 'Không lưu được giá theo miền.'); }
    finally { setBusy(false); }
  }
  return <Paper variant="outlined" sx={{ p: 3 }}><Stack spacing={2}>
    <Typography variant="h6" fontWeight={700}>Điều chỉnh giá theo miền</Typography>
    <Typography variant="body2">Dùng chung cho xe 5, 7 và 16 chỗ. 0% giữ cước nền hiện tại. Kiểm tra điểm đón và tất cả điểm đến; lấy mức cao nhất trong các miền có mặt và chỉ áp dụng một lần.</Typography>
    <Typography variant="body2" color="text.secondary">Tính trên cùng cước nền với phụ thu xăng, lễ/Tết, không cộng phần trăm chồng nhau. Phí phục vụ tại điểm đến tính riêng. Chuyến đã đặt giữ nguyên giá.</Typography>
    {loading ? <CircularProgress size={24} /> : <>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
        {regions.map(([key, label]) => <TextField key={key} label={`${label} (%)`} type="number" value={values[key]} disabled={!row || busy} inputProps={{ min: 0, max: 100, step: 0.01 }} helperText="0% = giữ nguyên cước nền" onChange={e => { setValues(old => ({ ...old, [key]: e.target.value })); setSaved(false); }} />)}
      </Box>
      <Typography variant="body2">Ví dụ: Bắc 10%, Trung 5%, Nam 0% → chuyến Bắc–Trung tăng 10% cước nền; nhiều điểm cùng miền không tăng thêm lần nữa.</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {saved && <Alert severity="success">Đã lưu giá theo miền.</Alert>}
      <Stack direction="row" spacing={1}>
        <Button variant="contained" disabled={!row || busy} onClick={() => void save()}>{busy ? 'Đang lưu…' : 'Lưu giá theo miền'}</Button>
        <Button disabled={busy} onClick={() => void load()}>Tải lại</Button>
      </Stack>
    </>}
  </Stack></Paper>;
}
