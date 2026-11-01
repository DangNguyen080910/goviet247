import useDraggableInbox from './useDraggableInbox';
import { createPortal } from 'react-dom';
import { useFloatingActions } from './FloatingActionsContext';
import { isRiderChatEnded, RIDER_CHAT_ENDED_NOTICE } from '../../../api/src/shared/tripChat.js';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Alert, Box, Button, Chip, Dialog, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from '@mui/material';
export function openTripChat(tripId) {
  window.dispatchEvent(new CustomEvent('goviet:chat-open', {
    detail: {
      tripId
    }
  }));
}
export function TripChatButton({
  tripId,
  label = 'Liên hệ chuyến',
  status
}) {
  const ended = isRiderChatEnded(status);
  return <Button variant="outlined" onClick={() => ended ? window.alert(RIDER_CHAT_ENDED_NOTICE) : openTripChat(tripId)} sx={{
    ...(ended ? {color: "#64748b", backgroundColor: "#f1f5f9", borderColor: "#cbd5e1"} : {}),
    textTransform: 'none',
    borderRadius: 2
  }}>💬 {label}</Button>;
}
const base = import.meta.env.VITE_API_BASE || 'http://localhost:5050';
const makeId = () => crypto.randomUUID();
export default function TripChatHub() {
  const {dockTarget, dockDragRef} = useFloatingActions();
  const route = useLocation(),
    isAdmin = route.pathname.startsWith('/admin'),
    tokenKey = isAdmin ? 'admin_token' : 'gv247_customer_token';
  const adminDrag = useDraggableInbox(isAdmin);
  const [open, setOpen] = useState(false),
    [tripId, setTripId] = useState(''),
    [items, setItems] = useState([]),
    [inbox, setInbox] = useState([]),
    [unread, setUnread] = useState(0),
    [actor, setActor] = useState({}),
    [canSend, setCanSend] = useState(false),
    [replies, setReplies] = useState([]),
    [text, setText] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [more, setMore] = useState(false),
    [draft, setDraft] = useState(null),
    [recording, setRecording] = useState(false),
    [seconds, setSeconds] = useState(0),
    [location, setLocation] = useState(null),
    [query, setQuery] = useState(''),
    [places, setPlaces] = useState([]),
    [locationOpen, setLocationOpen] = useState(false),
    [signed, setSigned] = useState(false);
  const recorder = useRef(null),
    chunks = useRef([]),
    stream = useRef(null),
    recordStart = useRef(0),
    end = useRef(null),
    lastUnread = useRef(-1),
    previousLast = useRef(''),
    loadedOlder = useRef(false),
    inflight = useRef(false),
    pending = useRef(null),
    abort = useRef(false),
    audio = useRef(null),
    soundTimer = useRef(0),
    activeRequest = useRef(0);
  async function api(path, options = {}) {
    const token = localStorage.getItem(tokenKey);
    if (!token) throw new Error('Vui lòng đăng nhập.');
    const res = await fetch(`${base}/api/trip-chat${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : {
          'Content-Type': 'application/json'
        }),
        Authorization: `Bearer ${token}`,
        ...options.headers
      }
    });
    const d = await res.json();
    if (!res.ok) {
      if (d.code === 'RIDER_CHAT_ENDED') {
        activeRequest.current++; audio.current?.pause(); setItems([]); setCanSend(false); setOpen(false);
        window.alert(RIDER_CHAT_ENDED_NOTICE);
      }
      throw new Error(d.message || 'Không tải được hội thoại.');
    }
    return d;
  }
  const post = (path, body) => api(path, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  async function run(fn) {
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }
  function quietTone() {
    if (Date.now() - soundTimer.current < 3000) return;
    soundTimer.current = Date.now();
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)(),
        osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = 0.035;
      osc.frequency.value = 660;
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
      osc.onended = () => ctx.close();
    } catch {}
  }
  useEffect(() => {
    const handler = e => {
      setTripId(e.detail.tripId || '');
      setOpen(true);
    };
    window.addEventListener('goviet:chat-open', handler);
    return () => window.removeEventListener('goviet:chat-open', handler);
  }, []);
  useEffect(() => {
    setOpen(false);
    setTripId('');
    setItems([]);
    setInbox([]);
    lastUnread.current = -1;
  }, [tokenKey]);
  useEffect(() => {
    let alive = true;
    async function poll() {
      const token = localStorage.getItem(tokenKey);
      if (alive) setSigned(Boolean(token));
      if (!token) {
        if (alive) {
          setUnread(0);
          setOpen(false);
        }
        lastUnread.current = -1;
        return;
      }
      try {
        const d = await api('/conversations');
        if (!alive) return;
        setInbox(d.items);
        setUnread(d.unread);
        if (lastUnread.current >= 0 && d.unread > lastUnread.current && !open) {
          quietTone();
          if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('GoViet247 · Tin nhắn chuyến', {
            body: 'Có tin nhắn mới. Mở GoViet247 để xem.',
            tag: 'trip-chat'
          });
        }
        lastUnread.current = d.unread;
      } catch {}
    }
    void poll();
    const timer = setInterval(poll, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [tokenKey, open]);
  async function load() {
    if (!tripId) return;
    const generation = activeRequest.current;
    const d = await api(`/${tripId}/messages`);
    if (generation !== activeRequest.current) return;
    setItems(current => {
      const map = new Map((loadedOlder.current ? current : []).map(m => [m.id, m]));
      d.items.forEach(m => map.set(m.id, m));
      return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    });
    setActor(d.actor);
    setCanSend(d.canSend);
    setReplies(d.quickReplies || []);
    if (!loadedOlder.current) setMore(d.hasMore);
    const latest = d.items.at(-1);
    if (latest && document.visibilityState === 'visible') {
      await post(`/${tripId}/read`, {
        messageId: latest.id
      });
    }
    if (latest && previousLast.current !== latest.id) {
      if (previousLast.current && latest.senderId !== d.actor.id) quietTone();
      previousLast.current = latest.id;
      if (!loadedOlder.current) setTimeout(() => end.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      }), 100);
    }
  }
  useEffect(() => {
    activeRequest.current++;
    setItems([]);
    setError('');
    setText('');
    setLocation(null);
    setDraft(current => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    loadedOlder.current = false;
    previousLast.current = '';
    if (!open || !tripId) return;
    let alive = true;
    const refresh = () => {
      if (document.visibilityState === 'visible') void load().catch(e => alive && setError(e.message));
    };
    refresh();
    const timer = setInterval(refresh, 4000);
    return () => {
      activeRequest.current++;
      alive = false;
      clearInterval(timer);
    };
  }, [open, tripId, tokenKey]);
  useEffect(() => () => {
    abort.current = true;
    recorder.current?.stop();
    stream.current?.getTracks().forEach(t => t.stop());
    audio.current?.pause();
  }, []);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - recordStart.current) / 1000)), 300);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(() => {
    if (seconds >= 60 && recorder.current?.state === 'recording') recorder.current.stop();
  }, [seconds]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden && recorder.current?.state === 'recording') recorder.current.stop();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, []);
  function close() {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    audio.current?.pause();
    setOpen(false);
  }
  async function record() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Trình duyệt chưa hỗ trợ ghi âm. Vui lòng dùng app hoặc trình duyệt mới.');
    const input = await navigator.mediaDevices.getUserMedia({
      audio: true
    });
    stream.current = input;
    const mime = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(input, mime ? {
      mimeType: mime
    } : undefined);
    recorder.current = rec;
    chunks.current = [];
    abort.current = false;
    recordStart.current = Date.now();
    setSeconds(0);
    rec.ondataavailable = e => {
      if (e.data.size) chunks.current.push(e.data);
    };
    rec.onstop = () => {
      input.getTracks().forEach(t => t.stop());
      if (abort.current) return;
      const blob = new Blob(chunks.current, {
        type: rec.mimeType
      });
      setRecording(false);
      if (blob.size > 5 * 1024 * 1024) {
        setError('Ghi âm vượt quá 5 MB.');
        return;
      }
      setDraft({
        blob,
        url: URL.createObjectURL(blob),
        durationMs: Math.min(60000, Date.now() - recordStart.current),
        clientId: makeId()
      });
    };
    rec.start();
    setRecording(true);
  }
  async function sendText() {
    const value = text.trim();
    if (!value) return;
    if (pending.current?.text !== value) pending.current = {
      text: value,
      clientId: makeId()
    };
    await post(`/${tripId}/messages`, {
      kind: 'TEXT',
      ...pending.current
    });
    pending.current = null;
    setText('');
    await load();
  }
  async function sendAudio() {
    const form = new FormData();
    form.append('audio', draft.blob, 'voice');
    form.append('durationMs', String(draft.durationMs));
    form.append('clientId', draft.clientId);
    await api(`/${tripId}/audio`, {
      method: 'POST',
      body: form
    });
    URL.revokeObjectURL(draft.url);
    setDraft(null);
    await load();
  }
  async function listen(m) {
    audio.current?.pause();
    const d = await api(`/${tripId}/audio/${m.id}`);
    const a = new Audio(d.url);
    audio.current = a;
    await a.play();
  }
  async function currentLocation() {
    const p = await new Promise((resolve, reject) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000
    }) : reject(new Error('Không hỗ trợ GPS.')));
    setLocation({
      latitude: p.coords.latitude,
      longitude: p.coords.longitude,
      locationLabel: 'Vị trí hiện tại',
      clientId: makeId()
    });
  }
  async function search() {
    const res = await fetch(`${base}/api/maps/autocomplete?q=${encodeURIComponent(query)}`),
      d = await res.json();
    if (!res.ok || !d.success) throw new Error(d.message || 'Không tìm được địa chỉ.');
    setPlaces(d.items || []);
  }
  async function selectPlace(p) {
    const res = await fetch(`${base}/api/maps/place-detail?placeId=${encodeURIComponent(p.placeId || p.place_id || p.id)}`),
      d = await res.json();
    if (!res.ok || !d.success) throw new Error(d.message || 'Không lấy được vị trí.');
    const raw = d.item?.data?.place || d.item?.data || d.item?.place || d.item?.result || d.item,
      loc = raw?.geometry?.location || raw?.location || raw;
    const latitude = Number(raw.lat ?? raw.latitude ?? loc.lat),
      longitude = Number(raw.lng ?? raw.longitude ?? loc.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('Địa chỉ chưa có toạ độ.');
    setLocation({
      latitude,
      longitude,
      locationLabel: p.description || p.address || p.name || query,
      clientId: makeId()
    });
    setPlaces([]);
  }
  const mapUrl = m => `https://www.google.com/maps/search/?api=1&query=${m.latitude},${m.longitude}`;
  const docked = !isAdmin && Boolean(dockTarget);
  const launcher = signed && !open ? <Button variant="contained"
    ref={isAdmin ? adminDrag.ref : undefined}
    onPointerDown={event => (docked ? dockDragRef.current : isAdmin ? adminDrag : null)?.startDrag(event)}
    onPointerMove={event => (docked ? dockDragRef.current : isAdmin ? adminDrag : null)?.moveDrag(event)}
    onPointerUp={event => (docked ? dockDragRef.current : isAdmin ? adminDrag : null)?.finish(event)}
    onPointerCancel={event => (docked ? dockDragRef.current : isAdmin ? adminDrag : null)?.finish(event)}
    onLostPointerCapture={event => (docked ? dockDragRef.current : isAdmin ? adminDrag : null)?.finish(event)}
    aria-label={`Tin nhắn chuyến${unread ? ` (${unread} chưa đọc)` : ''}, có thể kéo để di chuyển`}
    onClick={event => {
      if ((docked ? dockDragRef.current : isAdmin ? adminDrag : null)?.consumeClick(event)) return;
      setTripId('');
      setOpen(true);
    }} sx={{
      ...(isAdmin ? adminDrag.style : dockTarget ? {} : {position:'fixed',bottom:100,right:20,zIndex:1400}),
      minHeight:44,
      touchAction: docked || isAdmin ? 'none' : 'auto',
      userSelect:'none',
      cursor:docked || isAdmin ? 'grab' : 'pointer',
      whiteSpace:'nowrap',
      borderRadius: 6,
      textTransform: 'none'
    }}>💬 Tin nhắn {unread ? `(${unread})` : ''}</Button> : null;
  return <>{!isAdmin && dockTarget ? createPortal(launcher, dockTarget) : launcher}
 <Dialog open={open} onClose={close} fullWidth maxWidth="sm" sx={{zIndex:10020}}><DialogTitle sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}>{tripId ? <Button onClick={() => setTripId('')}>←</Button> : null}<Typography component="span" sx={{
          fontWeight: 800,
          flex: 1
        }}>{tripId ? `Liên hệ #${tripId.slice(-8).toUpperCase()}` : 'Tin nhắn chuyến'}</Typography><IconButton aria-label="Đóng hội thoại" onClick={close}>×</IconButton></DialogTitle>
 <DialogContent dividers sx={{
        p: 0
      }}>{error && <Alert severity="error">{error}</Alert>}
 {!tripId ? <Stack spacing={1} sx={{
          p: 2
        }}>{!inbox.length && <Typography>Chưa có tin nhắn. Mở một chuyến để liên hệ.</Typography>}{inbox.map(c => <Button key={c.tripId} onClick={() => setTripId(c.tripId)} sx={{
            textAlign: 'left',
            justifyContent: 'flex-start',
            textTransform: 'none'
          }}><Box><Typography fontWeight={800}>#{c.tripId.slice(-8).toUpperCase()} {c.unread ? `· ${c.unread} chưa đọc` : ''}</Typography><Typography>{c.last.senderLabel} · {c.last.deletedAt ? 'Tin nhắn đã xoá' : c.last.kind === 'AUDIO' ? 'Tin nhắn thoại' : c.last.kind === 'LOCATION' ? 'Vị trí' : c.last.text}</Typography></Box></Button>)}</Stack> : <>
 <Typography sx={{
            p: 1.5,
            fontSize: 12,
            color: '#64748b'
          }}>Hội thoại chung giữa khách, tài xế phụ trách và GoViet247. Không chia sẻ số điện thoại cá nhân.</Typography>
 <Stack spacing={1.5} sx={{
            height: 'min(48vh,440px)',
            overflowY: 'auto',
            p: 2,
            bgcolor: '#f8fafc'
          }}>{more && <Button disabled={busy} onClick={() => run(async () => {
              const d = await api(`/${tripId}/messages?before=${items[0]?.id}`);
              loadedOlder.current = true;
              setMore(d.hasMore);
              setItems(current => [...d.items, ...current.filter(m => !d.items.some(x => x.id === m.id))]);
            })}>Tải tin cũ hơn</Button>}
 {items.map(m => <Box key={m.id} sx={{
              alignSelf: m.senderId === actor.id ? 'flex-end' : 'flex-start',
              maxWidth: '90%',
              p: 1.5,
              borderRadius: 3,
              bgcolor: m.senderId === actor.id ? '#dbeafe' : 'white',
              border: '1px solid #e2e8f0'
            }}><Typography sx={{
                fontSize: 12,
                color: '#475569',
                fontWeight: 700,
                mb: 0.5
              }}>{m.senderLabel}</Typography>{m.deletedAt ? <Typography sx={{
                fontStyle: 'italic',
                color: '#64748b'
              }}>Tin nhắn đã được GoViet247 xoá.</Typography> : m.kind === 'TEXT' ? <Typography sx={{
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere'
              }}>{m.text}</Typography> : m.kind === 'AUDIO' ? <Stack direction="row"><Button disabled={recording} onClick={() => run(() => listen(m))}>▶ Nghe · {Math.ceil(m.durationMs / 1000)}s</Button><Button onClick={() => audio.current?.pause()}>Dừng</Button></Stack> : <Button component="a" href={mapUrl(m)} target="_blank" rel="noopener noreferrer" sx={{
                textAlign: 'left',
                textTransform: 'none'
              }}>📍 {m.locationLabel}<br />Vị trí tại thời điểm gửi · Mở bản đồ</Button>}{actor.role === 'ADMIN' && !m.deletedAt && <Button size="small" color="error" disabled={busy} onClick={() => {
                if (window.confirm('Xoá nội dung tin nhắn khỏi hội thoại? Thao tác sẽ được lưu nhật ký.')) void run(async () => {
                  audio.current?.pause();
                  await api(`/${tripId}/messages/${m.id}`, {
                    method: 'DELETE'
                  });
                  await load();
                });
              }}>Xoá tin</Button>}<Typography sx={{
                fontSize: 11,
                color: '#64748b',
                mt: 0.5
              }}>{new Date(m.createdAt).toLocaleString('vi-VN')}</Typography></Box>)}<div ref={end} /></Stack>
 {!canSend ? <Alert severity="info">Hội thoại chỉ đọc khi chưa có tài xế hoặc chuyến đã kết thúc. Nhờ GoViet247 hỗ trợ nếu cần.</Alert> : <Stack spacing={1} sx={{
            p: 2
          }}>
 <Box sx={{
              display: 'flex',
              gap: 1,
              overflowX: 'auto',
              pb: 0.5
            }}>{replies.map(reply => <Chip key={reply} label={reply} onClick={() => setText(reply)} sx={{
                maxWidth: 300
              }} />)}</Box>
 {locationOpen && <Stack spacing={1} sx={{
              p: 1.5,
              bgcolor: '#f1f5f9',
              borderRadius: 2
            }}><Button disabled={busy} onClick={() => run(currentLocation)}>Dùng vị trí hiện tại</Button><TextField size="small" label="Tìm địa chỉ / điểm hẹn" value={query} onChange={e => setQuery(e.target.value)} /><Button disabled={busy || query.length < 3} onClick={() => run(search)}>Tìm điểm</Button>{places.slice(0, 5).map((p, i) => <Button key={i} onClick={() => run(() => selectPlace(p))}>{p.description || p.address || p.name}</Button>)}{location && <><Typography>{location.locationLabel}</Typography><iframe title="Xem trước vị trí gửi" style={{
                  width: '100%',
                  height: 180,
                  border: 0
                }} src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.longitude - 0.005},${location.latitude - 0.005},${location.longitude + 0.005},${location.latitude + 0.005}&marker=${location.latitude},${location.longitude}`} /><Button disabled={busy} onClick={() => run(async () => {
                  await post(`/${tripId}/messages`, {
                    kind: 'LOCATION',
                    ...location
                  });
                  setLocation(null);
                  setLocationOpen(false);
                  await load();
                })}>Gửi vị trí này</Button></>}<Button onClick={() => setLocationOpen(false)}>Đóng chọn vị trí</Button></Stack>}
 {draft ? <><audio controls src={draft.url} /><Stack direction="row"><Button disabled={busy} onClick={() => run(sendAudio)}>Gửi ghi âm</Button><Button disabled={busy} onClick={() => {
                  URL.revokeObjectURL(draft.url);
                  setDraft(null);
                }}>Xoá ghi âm</Button></Stack></> : <><TextField multiline maxRows={4} placeholder="Nhắn tin cho chuyến…" value={text} onChange={e => setText(e.target.value)} slotProps={{
                htmlInput: {
                  maxLength: 2000
                }
              }} disabled={busy || recording} /><Stack direction="row" flexWrap="wrap" gap={1}><Button variant="contained" disabled={busy || recording || !text.trim()} onClick={() => run(sendText)}>Gửi</Button><Button disabled={busy} onClick={() => recording ? recorder.current?.stop() : run(record)}>{recording ? `⏹ Dừng (${seconds}s)` : '🎙 Ghi âm'}</Button><Button disabled={busy || recording} onClick={() => setLocationOpen(v => !v)}>📍 Vị trí</Button></Stack></>}
 <Typography sx={{
              fontSize: 11,
              color: '#64748b'
            }}>Ghi âm tối đa 60 giây. GoViet247 có thể xem hội thoại để hỗ trợ và giải quyết tranh chấp.</Typography>
 {'Notification' in window && Notification.permission === 'default' && <Button onClick={() => Notification.requestPermission()}>Cho phép thông báo trên trình duyệt</Button>}
 </Stack>}
 </>}
 </DialogContent></Dialog></>;
}
