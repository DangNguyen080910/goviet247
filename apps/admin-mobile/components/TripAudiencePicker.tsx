import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { adminRequest } from '../services/adminRequest';
export default function TripAudiencePicker({ tripId, onDone, disabled, onBusy }: { tripId: string; onDone: () => void; disabled: boolean; onBusy: (busy: boolean) => void }) {
  const [open, setOpen] = useState(false), [items, setItems] = useState<any[]>([]), [selected, setSelected] = useState<string[]>([]), [q, setQ] = useState('');
  const [info, setInfo] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  useEffect(() => { if (!open) return; let active = true; setLoading(true); setError('');
    adminRequest(`/api/trips/admin/trips/${tripId}/audience-candidates`, { method: 'GET' }).then(data => { if(active) { setItems(data.items); setInfo(`${data.config.radiusKm} km / ${data.config.days} ngày. ${data.warning}`); } }).catch(e => { if(active) setError(e.message); }).finally(() => { if(active) setLoading(false); });
    return () => { active = false; };
  }, [tripId, open]);
  async function submit() { setBusy(true); onBusy(true); try { await adminRequest(`/api/trips/admin/trips/${tripId}/verify`, { method: 'POST', body: JSON.stringify({ driverIds: selected, note: 'Duyệt cho tài xế chỉ định' }) }); onDone(); } catch(e: any) { Alert.alert('Không thể duyệt', e.message); } finally { setBusy(false); onBusy(false); } }
  return <View style={{padding: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, gap: 10}}>
    <Pressable disabled={busy || disabled} onPress={() => setOpen(!open)}><Text style={{color: '#145ea8', fontWeight: '700'}}>Duyệt và show cho tài xế chỉ định {open ? '▴' : '▾'}</Text></Pressable>
    {open && <><Text>{info || 'Đang tải tài xế…'}</Text><Text>Chỉ người được chọn thấy chuyến. Người nhận trước chạy chuyến; phí áp dụng như hiện tại.</Text>
    {!!error && <Text style={{color: '#b42318'}}>{error}</Text>}
    <TextInput accessibilityLabel="Tìm tài xế" placeholder="Tên, SĐT, biển số" value={q} onChangeText={setQ} style={{borderWidth:1, borderColor:'#ccc', padding:10}} />
    {!loading && !items.length && <Text>Không có tài xế đủ điều kiện.</Text>}
    {items.filter(d => `${d.name} ${d.phone} ${d.plateNumber}`.toLowerCase().includes(q.toLowerCase())).map(d => <Pressable key={d.userId} disabled={busy || disabled} accessibilityRole="checkbox" accessibilityState={{checked:selected.includes(d.userId)}} onPress={() => setSelected(s => s.includes(d.userId) ? s.filter(id => id !== d.userId) : [...s,d.userId])} style={{paddingVertical: 10}}><Text>{selected.includes(d.userId) ? '☑' : '☐'} {d.name} • {d.phone} • {d.plateNumber}</Text>{d.suggestion && <Text style={{color:'#147348'}}>Gợi ý: cách {d.suggestion.distanceKm} km • {d.suggestion.tripId}</Text>}</Pressable>)}
    <Pressable disabled={busy || disabled || loading || !selected.length || selected.length > 100} onPress={submit} style={{backgroundColor:'#145ea8',padding:12,opacity:busy || loading || !selected.length ? 0.5 : 1}}><Text style={{color:'white'}}>{busy ? 'Đang duyệt…' : `Duyệt cho ${selected.length} tài xế`}</Text></Pressable></>}
  </View>;
}
