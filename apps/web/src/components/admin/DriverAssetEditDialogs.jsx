import { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { saveDriverBankAccount, saveDriverDocument } from '../../api/adminDrivers';
import { docTypeLabel } from '../../utils/driverDocs';

export function DriverBankEditDialog({ driverId, account, onClose, onSaved }) {
  const [snapshot] = useState(account);
  const [form, setForm] = useState({ bankName: account?.bankName || '', accountNumber: account?.accountNumber || '', accountHolderName: account?.accountHolderName || '', isDefault: account?.isDefault ?? !account });
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const field = key => event => setForm(current => ({ ...current, [key]: event.target.value }));
  async function save(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    let result;
    try { result = await saveDriverBankAccount(driverId, { ...form, bankAccountId: snapshot?.id, expectedUpdatedAt: snapshot?.updatedAt, reason: reason.trim() }); }
    catch (e) { setError(e.message); setBusy(false); return; }
    await onSaved(result);
  }
  return <Dialog open fullWidth maxWidth="sm" onClose={busy ? undefined : onClose}><form onSubmit={save}>
    <DialogTitle>{account ? 'Sửa tài khoản ngân hàng' : 'Thêm tài khoản ngân hàng'}</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <Alert severity="info">Hãy đối chiếu với tài xế trước khi lưu. Các yêu cầu rút tiền đã tạo giữ nguyên thông tin ngân hàng cũ, cần kiểm tra riêng trước khi chi.</Alert>
      <TextField required label="Ngân hàng" value={form.bankName} onChange={field('bankName')} disabled={busy} inputProps={{ maxLength: 100 }} />
      <TextField required label="Số tài khoản" value={form.accountNumber} onChange={field('accountNumber')} disabled={busy} inputProps={{ maxLength: 40 }} />
      <TextField required label="Tên chủ tài khoản" value={form.accountHolderName} onChange={field('accountHolderName')} disabled={busy} inputProps={{ maxLength: 100 }} />
      <FormControlLabel control={<Checkbox checked={form.isDefault} disabled={busy} onChange={(_, checked) => setForm(current => ({ ...current, isDefault: checked }))} />} label="Dùng làm tài khoản mặc định" />
      <TextField required multiline minRows={2} label="Lý do chỉnh sửa" value={reason} onChange={e => setReason(e.target.value)} disabled={busy} inputProps={{ maxLength: 500 }} />
    </Stack></DialogContent>
    <DialogActions><Button disabled={busy} onClick={onClose}>Hủy</Button><Button type="submit" variant="contained" disabled={busy || !reason.trim()}>{busy ? 'Đang lưu…' : 'Lưu tài khoản'}</Button></DialogActions>
  </form></Dialog>;
}

const DOC_TYPES = ['CCCD_FRONT', 'CCCD_BACK', 'PORTRAIT', 'DRIVER_LICENSE', 'VEHICLE_REGISTRATION'];
export function DriverDocumentEditDialog({ driverId, document, missingTypes, onClose, onSaved }) {
  const [snapshot] = useState(document);
  const [type, setType] = useState(document?.type || missingTypes[0] || 'PORTRAIT');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function choose(event) {
    const candidate = event.target.files?.[0]; setError(''); setFile(null);
    if (!candidate) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(candidate.type) || candidate.size > 20 * 1024 * 1024) { setError('Chọn ảnh JPG, PNG hoặc WebP, tối đa 20MB.'); return; }
    setFile(candidate);
  }
  async function save(event) {
    event.preventDefault(); if (busy || !file) return;
    setBusy(true); setError('');
    const data = new FormData();
    data.append('file', file); data.append('type', type); data.append('reason', reason.trim());
    if (snapshot) { data.append('documentId', snapshot.id); data.append('expectedFileUrl', snapshot.fileUrl); }
    let result;
    try { result = await saveDriverDocument(driverId, data); }
    catch (e) { setError(e.message); setBusy(false); return; }
    await onSaved(result);
  }
  const types = snapshot ? [snapshot.type] : DOC_TYPES.filter(value => missingTypes.includes(value));
  return <Dialog open fullWidth maxWidth="sm" onClose={busy ? undefined : onClose}><form onSubmit={save}>
    <DialogTitle>{snapshot ? 'Thay ảnh giấy tờ' : 'Bổ sung ảnh giấy tờ'}</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <Alert severity="info">Ảnh mới được đưa về chờ kiểm tra; không giữ dấu duyệt của ảnh cũ. Ảnh cũ được giữ để đối chiếu lịch sử.</Alert>
      <TextField select label="Loại giấy tờ" value={type} onChange={e => setType(e.target.value)} disabled={busy || !!snapshot}>{types.map(value => <MenuItem key={value} value={value}>{docTypeLabel(value)}</MenuItem>)}</TextField>
      <Button variant="outlined" component="label" disabled={busy}>Chọn ảnh<input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={choose} disabled={busy} /></Button>
      {file && <Typography variant="body2">{file.name}</Typography>}
      {preview && <Box component="img" src={preview} alt="Ảnh giấy tờ mới" sx={{ width: '100%', maxHeight: 350, objectFit: 'contain' }} />}
      <TextField required multiline minRows={2} label="Lý do thay ảnh" value={reason} onChange={e => setReason(e.target.value)} disabled={busy} inputProps={{ maxLength: 500 }} />
    </Stack></DialogContent>
    <DialogActions><Button disabled={busy} onClick={onClose}>Hủy</Button><Button type="submit" variant="contained" disabled={busy || !file || !reason.trim()}>{busy ? 'Đang tải ảnh…' : 'Lưu ảnh mới'}</Button></DialogActions>
  </form></Dialog>;
}
