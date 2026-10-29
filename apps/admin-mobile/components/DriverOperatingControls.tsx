import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Switch, Alert } from 'react-native';
import provinces from '../../api/src/data/vietnam-provinces.json';
import { patchDriverProfile, patchDriverTripAcceptance } from '../services/adminDriversApi';

const fields = [
  ['fullName', 'Họ tên tài xế'], ['citizenId', 'Số CCCD'], ['displayName', 'Tên hiển thị tài khoản'],
  ['phone', 'Số điện thoại'], ['vehicleBrand', 'Hãng xe'], ['vehicleModel', 'Model xe'], ['vehicleColor', 'Màu xe'],
  ['vehicleYear', 'Đời xe'], ['plateNumber', 'Biển số'],
] as const;
function makeForm(driver: any): Record<string, string> {
  return { fullName: driver.fullName || '', citizenId: driver.citizenId || '', displayName: driver.accountDisplayName || '',
    phone: driver.profilePhone?.e164 || '', vehicleBrand: driver.brand || '', vehicleModel: driver.model || '', vehicleColor: driver.vehicleColor || '',
    vehicleYear: driver.vehicleYear == null ? '' : String(driver.vehicleYear), plateNumber: driver.licensePlate || '',
    vehicleType: driver.vehicleType || '' };
}
export default function DriverOperatingControls({ driver, onSaved }: { driver: any; onSaved: () => Promise<void> }) {
  const [mode, setMode] = useState<'ACCEPT' | 'PROVINCE' | null>(null);
  const [code, setCode] = useState(driver.operatingProvinceCode || '');
  const [confirmed, setConfirmed] = useState(!!driver.operatingProvinceConfirmedAt);
  const [form, setForm] = useState(() => makeForm(driver));
  const [initial, setInitial] = useState(() => makeForm(driver));
  const [expectedPhone, setExpectedPhone] = useState(driver.profilePhone);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(driver.updatedAt);
  const name = provinces.find(p => p.code === driver.operatingProvinceCode)?.name || 'Chưa cập nhật';
  function open(next: 'ACCEPT' | 'PROVINCE') {
    setCode(driver.operatingProvinceCode || ''); setConfirmed(!!driver.operatingProvinceConfirmedAt);
    setForm(makeForm(driver)); setInitial(makeForm(driver)); setExpectedPhone(driver.profilePhone);
    setVersion(driver.updatedAt); setReason(''); setError(''); setMode(next);
  }
  async function save() {
    if (busy || !reason.trim()) return;
    setBusy(true); setError('');
    try {
      if (mode === 'ACCEPT') await patchDriverTripAcceptance(driver.id, { blocked: !driver.tripAcceptBlocked, reason: reason.trim() });
      else {
        const changes: Record<string, unknown> = Object.fromEntries(Object.entries(form).filter(([key, value]) => value.trim() !== initial[key]).map(([key, value]) => [key, value.trim()]));
        if (code !== driver.operatingProvinceCode) changes.operatingProvinceCode = code;
        if (confirmed !== !!driver.operatingProvinceConfirmedAt || code !== driver.operatingProvinceCode) changes.provinceConfirmed = confirmed;
        if (!Object.keys(changes).length) { setError('Chưa có thông tin thay đổi.'); setBusy(false); return; }
        if (changes.citizenId !== undefined && !/^\d{12}$/.test(String(changes.citizenId))) { setError('Số CCCD phải gồm đúng 12 chữ số.'); setBusy(false); return; }
        await patchDriverProfile(driver.id, { ...changes, expectedUpdatedAt: version, expectedPhone, reason: reason.trim() });
      }
    } catch (e: any) { setError(e.message || 'Không lưu được thay đổi.'); setBusy(false); return; }
    setMode(null);
    try { await onSaved(); } catch { Alert.alert('Đã lưu', 'Vui lòng mở lại chi tiết để tải thông tin mới.'); }
    setBusy(false);
  }
  const button = { padding: 12, borderRadius: 8, backgroundColor: '#e0edff', marginVertical: 5 };
  return <View style={{ padding: 14, margin: 10, borderRadius: 12, backgroundColor: '#f0f7ff' }}>
    <Text style={{ fontWeight: '700' }}>Nhận chuyến mới: {driver.tripAcceptBlocked ? 'Đã khóa' : 'Đang cho phép'}</Text>
    <Text style={{ marginVertical: 6 }}>Chỉ thay đổi quyền nhận chuyến mới. Chuyến đã nhận vẫn tiếp tục xử lý; không gửi thông báo cho tài xế.</Text>
    <Pressable disabled={busy} style={button} onPress={() => open('ACCEPT')}><Text>{driver.tripAcceptBlocked ? 'Mở khóa nhận chuyến' : 'Khóa nhận chuyến'}</Text></Pressable>
    <Text style={{ marginTop: 10 }}>Số CCCD: {driver.citizenId || "Chưa cập nhật"}</Text>
    <Text style={{ marginTop: 10, fontWeight: '700' }}>Tỉnh/thành thường hoạt động: {name}</Text>
    <Text>{driver.operatingProvinceConfirmedAt ? 'Đã xác nhận khu vực' : 'Chưa xác nhận khu vực'}</Text>
    <Pressable disabled={busy} style={button} onPress={() => open('PROVINCE')}><Text>Sửa thông tin tài xế</Text></Pressable>
    {mode && <View>
      <Text style={{ fontWeight: '700', marginVertical: 8 }}>{mode === 'PROVINCE' ? 'Sửa thông tin tài xế' : driver.tripAcceptBlocked ? 'Mở khóa nhận chuyến mới' : 'Khóa nhận chuyến mới'}</Text>
      {mode === 'PROVINCE' && <>
        {fields.map(([key, label]) => <View key={key} style={{ marginBottom: 10 }}>
          <Text style={{ fontWeight: '600', marginBottom: 4 }}>{label}</Text>
          <TextInput accessibilityLabel={label} editable={!busy} value={form[key]} onChangeText={value => setForm(current => ({ ...current, [key]: value }))}
            keyboardType={key === 'citizenId' || key === 'vehicleYear' ? 'number-pad' : key === 'phone' ? 'phone-pad' : 'default'}
            maxLength={key === 'citizenId' ? 12 : key === 'phone' ? 20 : key === 'plateNumber' ? 30 : 100}
            style={{ padding: 12, borderWidth: 1, borderColor: '#94a3b8', backgroundColor: '#fff', borderRadius: 8 }} />
        </View>)}
        <Text>CCCD gồm đúng 12 chữ số, giữ số 0 đầu. Tên hiển thị và SĐT thuộc tài khoản dùng cho cả app tài xế và khách hàng.</Text>
        {form.phone.trim() !== initial.phone && <Text style={{ color: '#92400e', marginVertical: 8 }}>SĐT mới phải chưa thuộc tài khoản khác và cần xác thực OTP lại. Không tạo hoặc gộp tài khoản.</Text>}
        <Text style={{ fontWeight: '700', marginVertical: 8 }}>Loại xe</Text>
        {!['CAR_5','CAR_7','CAR_16'].includes(form.vehicleType) && <Text>Hiện tại: {form.vehicleType || 'Chưa chọn loại xe'}</Text>}
        {Object.entries({ CAR_5: 'Xe 5 chỗ', CAR_7: 'Xe 7 chỗ', CAR_16: 'Xe 16 chỗ' }).map(([value,label]) => <Pressable disabled={busy} key={value} style={button} onPress={() => setForm(current => ({ ...current, vehicleType: value }))}><Text>{form.vehicleType === value ? '● ' : '○ '}{label}</Text></Pressable>)}
        <Text style={{ fontWeight: '700', marginVertical: 8 }}>Tỉnh/thành thường hoạt động</Text>
        <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>{provinces.map(p => <Pressable disabled={busy} key={p.code} style={{ padding: 12, backgroundColor: p.code === code ? '#bfdbfe' : '#fff' }} onPress={() => { setCode(p.code); setConfirmed(false); }}><Text>{p.code === code ? '● ' : '○ '}{p.name}</Text></Pressable>)}</ScrollView>
        <Text>Đã xác nhận khu vực này với tài xế</Text><Switch disabled={busy} value={confirmed} onValueChange={setConfirmed} />
      </>}
      <TextInput editable={!busy} value={reason} onChangeText={setReason} placeholder="Lý do chỉnh sửa (bắt buộc)" maxLength={500} multiline style={{ padding: 12, borderWidth: 1, borderColor: '#94a3b8', marginVertical: 8 }} />
      {!!error && <Text style={{ color: '#b91c1c' }}>{error}</Text>}
      <Pressable style={button} disabled={busy || !reason.trim() || (mode === 'PROVINCE' && !code)} onPress={save}><Text>{busy ? 'Đang lưu…' : 'Xác nhận lưu'}</Text></Pressable>
      <Pressable disabled={busy} style={button} onPress={() => setMode(null)}><Text>Hủy</Text></Pressable>
    </View>}
  </View>;
}
