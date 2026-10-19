import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { adminRequest } from '../services/adminRequest';

const CARS: Record<string, string> = { CAR_5: 'Xe 5 chỗ', CAR_7: 'Xe 7 chỗ', CAR_16: 'Xe 16 chỗ' };
type Candidate = { userId: string; name: string; phone: string; plateNumber?: string; vehicleType?: string; carType?: string | null; suggestion?: { distanceKm: number; tripId: string } | null };
export default function TripAudiencePicker({ tripId, onDone, disabled, onBusy }: { tripId: string; onDone: () => void; disabled: boolean; onBusy: (busy: boolean) => void }) {
  const [open, setOpen] = useState(false), [items, setItems] = useState<Candidate[]>([]), [selected, setSelected] = useState<string[]>([]), [q, setQ] = useState(''), [carType, setCarType] = useState('');
  const [info, setInfo] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  useEffect(() => { setOpen(false); setItems([]); setSelected([]); setCarType(''); setQ(''); }, [tripId]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true); setError(''); setInfo(''); setItems([]); setSelected([]); setCarType(''); setQ('');
    adminRequest('/api/trips/admin/trips/' + tripId + '/audience-candidates', { method: 'GET' }).then(data => {
      if (active) { setItems(data.items); setInfo(data.config.radiusKm + ' km / ' + data.config.days + ' ngày. ' + data.warning); }
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tripId, open]);
  function selectGroup(type: string) {
    setCarType(type); setQ(''); setError('');
    setSelected(type ? items.filter(d => d.carType === type).map(d => d.userId) : []);
  }
  const limit = carType ? 10000 : 100;
  const cannotSubmit = busy || disabled || loading || !selected.length || selected.length > limit;
  const visible = items.filter(d => (!carType || d.carType === carType) && (d.name + ' ' + d.phone + ' ' + d.plateNumber).toLocaleLowerCase('vi').includes(q.toLocaleLowerCase('vi')));
  async function submit() {
    if (cannotSubmit) return;
    setBusy(true); onBusy(true);
    try {
      await adminRequest('/api/trips/admin/trips/' + tripId + '/verify', { method: 'POST', body: JSON.stringify({
        audienceMode: carType ? 'CAR_TYPE' : 'SELECTED', driverIds: selected,
        ...(carType ? { carType } : {}),
        note: carType ? 'Duyệt nhóm ' + CARS[carType] + ', ' + selected.length + ' tài xế được chọn' : 'Duyệt cho tài xế chỉ định',
      }) });
      onDone();
    } catch (e: any) { Alert.alert('Không thể duyệt', e.message); }
    finally { setBusy(false); onBusy(false); }
  }
  return <View style={{ padding: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, gap: 10 }}>
    <Pressable disabled={busy || disabled} onPress={() => setOpen(!open)}><Text style={{ color: '#145ea8', fontWeight: '700' }}>Duyệt cho tài xế chỉ định {open ? '▴' : '▾'}</Text></Pressable>
    {open && <>
      <Text>{info || 'Đang tải tài xế…'}</Text><Text>Chỉ người được chọn thấy chuyến. Người nhận trước chạy chuyến; phí áp dụng như hiện tại.</Text>
      {!!error && <Text style={{ color: '#b42318' }}>{error}</Text>}
      <Text style={{ fontWeight: '700' }}>Chọn nhanh theo loại xe</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {Object.entries(CARS).map(([type, label]) => {
          const count = items.filter(d => d.carType === type).length;
          const locked = busy || disabled || loading || !count;
          return <Pressable key={type} accessibilityRole="button" accessibilityState={{ selected: carType === type, disabled: locked }} disabled={locked} onPress={() => selectGroup(type)} style={{ padding: 10, borderRadius: 8, backgroundColor: carType === type ? '#145ea8' : '#e8f0fa', opacity: locked ? 0.5 : 1 }}>
            <Text style={{ color: carType === type ? 'white' : '#145ea8' }}>Tất cả {label.toLowerCase()} ({count})</Text>
          </Pressable>;
        })}
        <Pressable disabled={busy || disabled || loading} onPress={() => selectGroup('')} style={{ padding: 10, borderRadius: 8, backgroundColor: !carType ? '#145ea8' : '#e8f0fa' }}><Text style={{ color: !carType ? 'white' : '#145ea8' }}>Chọn từng tài xế</Text></Pressable>
      </View>
      <Text>Chọn nhóm sẽ thay danh sách đang chọn. Có thể bỏ chọn từng người; tìm kiếm không thay đổi nhóm đã chọn.</Text>
      <Text style={{ fontWeight: '700' }}>Đã chọn: {selected.length} tài xế{carType ? ' · ' + CARS[carType] : ''}</Text>
      <Pressable disabled={busy || disabled || loading || !selected.length} onPress={() => setSelected([])}><Text style={{ color: '#145ea8' }}>Bỏ chọn hết</Text></Pressable>
      {selected.length > limit && <Text style={{ color: '#b42318' }}>Tối đa {limit} tài xế mỗi lần. Hãy giảm danh sách trước khi duyệt.</Text>}
      <TextInput editable={!busy && !disabled && !loading} accessibilityLabel="Tìm tài xế" placeholder="Tên, SĐT, biển số" value={q} onChangeText={setQ} style={{ borderWidth: 1, borderColor: '#ccc', padding: 10 }} />
      {!loading && !visible.length && <Text>Không có tài xế phù hợp trong danh sách.</Text>}
      {visible.map(d => <Pressable key={d.userId} disabled={busy || disabled || loading} accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(d.userId) }} onPress={() => setSelected(s => s.includes(d.userId) ? s.filter(id => id !== d.userId) : [...s, d.userId])} style={{ paddingVertical: 10 }}>
        <Text>{selected.includes(d.userId) ? '☑' : '☐'} {d.name} • {CARS[d.carType || ''] || d.vehicleType || 'Chưa rõ loại xe'} • {d.phone} • {d.plateNumber}</Text>
        {d.suggestion && <Text style={{ color: '#147348' }}>Gợi ý: cách {d.suggestion.distanceKm} km • {d.suggestion.tripId}</Text>}
      </Pressable>)}
      <Text>Danh sách được chốt khi duyệt; tài xế đăng ký sau không tự được thêm.</Text>
      <Pressable disabled={cannotSubmit} onPress={submit} style={{ backgroundColor: '#145ea8', padding: 12, opacity: cannotSubmit ? 0.5 : 1 }}><Text style={{ color: 'white' }}>{busy ? 'Đang duyệt…' : 'Duyệt cho ' + selected.length + ' tài xế'}</Text></Pressable>
    </>}
  </View>;
}
