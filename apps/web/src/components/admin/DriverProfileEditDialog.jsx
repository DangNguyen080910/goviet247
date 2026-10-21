import { useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material';
import provinces from '../../../../api/src/data/vietnam-provinces.json';
import { patchDriverProfile } from '../../api/adminDrivers';

const CARS = { CAR_5: 'Xe 5 chỗ', CAR_7: 'Xe 7 chỗ', CAR_16: 'Xe 16 chỗ' };
function makeForm(driver) {
  return {
    fullName: driver.fullName || '', displayName: driver.user?.displayName || '',
    phone: driver.user?.phones?.[0]?.e164 || '', operatingProvinceCode: driver.operatingProvinceCode || '79',
    provinceConfirmed: !!driver.operatingProvinceConfirmedAt,
    vehicleType: driver.vehicleType || '', vehicleBrand: driver.vehicleBrand || '', vehicleModel: driver.vehicleModel || '',
    vehicleYear: driver.vehicleYear == null ? '' : String(driver.vehicleYear), plateNumber: driver.plateNumber || '',
  };
}
export default function DriverProfileEditDialog({ driver, onClose, onSaved }) {
  // Keep the editing snapshot even if a realtime refresh changes the drawer.
  const [snapshot] = useState(driver);
  const [initial] = useState(() => makeForm(driver));
  const [form, setForm] = useState(() => makeForm(driver));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const changes = Object.fromEntries(Object.entries(form).filter(([key, value]) =>
    (typeof value === 'string' ? value.trim() : value) !== initial[key]));
  const phoneChanged = form.phone.trim() !== initial.phone;
  const update = key => event => {
    const value = event.target.value;
    setForm(current => ({ ...current, [key]: value, ...(key === 'operatingProvinceCode' ? { provinceConfirmed: false } : {}) }));
  };
  async function save(event) {
    event.preventDefault();
    if (busy || !reason.trim() || !Object.keys(changes).length) return;
    setBusy(true); setError('');
    let result;
    try {
      result = await patchDriverProfile(snapshot.id, {
        ...changes, expectedUpdatedAt: snapshot.updatedAt,
        expectedPhone: snapshot.user?.phones?.[0] ? { id: snapshot.user.phones[0].id, e164: snapshot.user.phones[0].e164 } : null,
        reason: reason.trim(),
      });
    } catch (e) { setError(e.message); setBusy(false); return; }
    // Saving succeeded; refresh failures must not invite a duplicate submission.
    await onSaved(result);
  }
  return <Dialog open fullWidth maxWidth="sm" onClose={busy ? undefined : onClose}>
    <form onSubmit={save}>
      <DialogTitle>Sửa thông tin tài xế</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <Typography variant="body2">{snapshot.fullName || snapshot.user?.displayName || 'Hồ sơ tài xế'}</Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField label="Họ tên tài xế" value={form.fullName} onChange={update('fullName')} disabled={busy} inputProps={{ maxLength: 100 }} />
        <TextField label="Tên hiển thị tài khoản" value={form.displayName} onChange={update('displayName')} disabled={busy} inputProps={{ maxLength: 100 }} helperText="Tài khoản có thể được dùng cho cả app tài xế và khách hàng." />
        <TextField label="Số điện thoại" value={form.phone} onChange={update('phone')} disabled={busy} type="tel" inputProps={{ maxLength: 20 }} helperText="Nhập 0… hoặc +84…; SĐT phải chưa thuộc tài khoản khác." />
        {phoneChanged && <Alert severity="warning">Số mới cần xác thực OTP. Đây là thay đổi SĐT của tài khoản hiện tại, không phải tạo hoặc gộp tài khoản.</Alert>}
        <TextField select label="Tỉnh/thành thường hoạt động" value={form.operatingProvinceCode} onChange={update('operatingProvinceCode')} disabled={busy}>
          {provinces.map(province => <MenuItem key={province.code} value={province.code}>{province.name}</MenuItem>)}
        </TextField>
        <FormControlLabel control={<Checkbox checked={form.provinceConfirmed} disabled={busy} onChange={(_, checked) => setForm(current => ({ ...current, provinceConfirmed: checked }))} />} label="Đã xác nhận khu vực này với tài xế" />
        <TextField select label="Loại xe" value={form.vehicleType} onChange={update('vehicleType')} disabled={busy}>
          {!CARS[form.vehicleType] && <MenuItem value={form.vehicleType}>{form.vehicleType || 'Chưa chọn loại xe'}</MenuItem>}
          {Object.entries(CARS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
        <TextField label="Hãng xe" value={form.vehicleBrand} onChange={update('vehicleBrand')} disabled={busy} inputProps={{ maxLength: 100 }} />
        <TextField label="Model xe" value={form.vehicleModel} onChange={update('vehicleModel')} disabled={busy} inputProps={{ maxLength: 100 }} />
        <TextField label="Đời xe" value={form.vehicleYear} onChange={update('vehicleYear')} disabled={busy} type="number" inputProps={{ min: 1980, max: new Date().getFullYear() + 1, step: 1 }} />
        <TextField label="Biển số" value={form.plateNumber} onChange={update('plateNumber')} disabled={busy} inputProps={{ maxLength: 30 }} />
        <TextField required label="Lý do chỉnh sửa" value={reason} onChange={event => setReason(event.target.value)} disabled={busy} multiline minRows={2} inputProps={{ maxLength: 500 }} helperText="Ví dụ: sửa thông tin tài xế nhập nhầm sau khi đối chiếu giấy tờ." />
      </Stack></DialogContent>
      <DialogActions><Button disabled={busy} onClick={onClose}>Hủy</Button><Button type="submit" variant="contained" disabled={busy || !reason.trim() || !Object.keys(changes).length}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</Button></DialogActions>
    </form>
  </Dialog>;
}
