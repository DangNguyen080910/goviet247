import { useIsFocused } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Alert, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
type Config = {
  base: string;
  getToken: () => Promise<string | null>;
  role: 'RIDER' | 'DRIVER' | 'ADMIN';
};
let config: Config;
export let activeChatTrip = '';
export function configureChat(value: Config) {
  config = value;
}
export function isChatVisible(data: Record<string, unknown>) {
  return data?.type === 'TRIP_CHAT' && activeChatTrip === String(data.tripId) && AppState.currentState === 'active';
}
async function api(path: string, options: RequestInit = {}) {
  const token = await config.getToken();
  if (!token) throw new Error('Vui lòng đăng nhập.');
  const response = await fetch(`${config.base}/api/trip-chat${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : {
        'Content-Type': 'application/json'
      }),
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Không tải được hội thoại.');
  return data;
}
const post = (path: string, body: any) => api(path, {
  method: 'POST',
  body: JSON.stringify(body)
});
const id = () => `m_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
const ink = '#0f172a',
  blue = '#2563eb';
const button = {
  paddingVertical: 12,
  paddingHorizontal: 14,
  borderRadius: 12,
  backgroundColor: '#eff6ff',
  margin: 3
} as const;
export function TripChatButton({
  tripId,
  label = 'Liên hệ chuyến'
}: {
  tripId: string;
  label?: string;
}) {
  return <Pressable accessibilityRole="button" onPress={() => router.push(`/trip-chat?tripId=${encodeURIComponent(tripId)}` as any)} style={button}><Text style={{
      color: blue,
      fontWeight: '700'
    }}>💬 {label}</Text></Pressable>;
}
export function ChatInboxBadge() {
  const [unread, setUnread] = useState(0),
    [signed, setSigned] = useState(false);
  const path = usePathname();
  const last = useRef(-1);
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!config || AppState.currentState !== 'active') return;
      const token = await config.getToken();
      if (alive) setSigned(Boolean(token));
      if (!token) {
        activeChatTrip = '';
        if (alive) setUnread(0);
        last.current = -1;
        return;
      }
      try {
        const d = await api('/conversations');
        if (!alive) return;
        setUnread(d.unread);
        if (last.current >= 0 && d.unread > last.current && !activeChatTrip) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        last.current = d.unread;
      } catch {}
    }
    void load();
    const timer = setInterval(() => void load(), 15000);
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') void load();
    });
    return () => {
      alive = false;
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  if (!signed || path.includes('trip-chat') || /login|bootstrap|index|driver-profile/.test(path)) return null;
  return <Pressable accessibilityLabel={`Tin nhắn chuyến, ${unread} chưa đọc`} onPress={() => router.push('/trip-chat' as any)} style={{
    position: 'absolute',
    right: 16,
    bottom: 100,
    backgroundColor: blue,
    padding: 12,
    borderRadius: 24,
    elevation: 6
  }}><Text style={{
      color: 'white',
      fontWeight: '800'
    }}>💬 {unread ? `${unread} mới` : 'Tin nhắn'}</Text></Pressable>;
}
type Msg = {
  deletedAt?: string | null;
  id: string;
  senderId: string;
  senderLabel: string;
  kind: string;
  text?: string;
  createdAt: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
  durationMs?: number;
};
export default function TripChatScreen() {
  const focused = useIsFocused();
  const params = useLocalSearchParams<{
      tripId?: string;
    }>(),
    tripId = String(params.tripId || '');
  const [items, setItems] = useState<Msg[]>([]),
    [inbox, setInbox] = useState<any[]>([]),
    [actor, setActor] = useState<any>({}),
    [canSend, setCanSend] = useState(false),
    [replies, setReplies] = useState<string[]>([]),
    [text, setText] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [more, setMore] = useState(false),
    [older, setOlder] = useState(false);
  const [recording, setRecording] = useState(false),
    [draft, setDraft] = useState<{
      uri: string;
      durationMs: number;
      clientId: string;
    } | null>(null),
    [seconds, setSeconds] = useState(0),
    [playing, setPlaying] = useState('');
  const recorder = useRef<Audio.Recording | null>(null),
    sound = useRef<Audio.Sound | null>(null),
    scroll = useRef<ScrollView | null>(null),
    mounted = useRef(true),
    lastId = useRef(''),
    generation = useRef(0),
    olderRef = useRef(false),
    pendingText = useRef<{
      payload: string;
      clientId: string;
    } | null>(null);
  const [location, setLocation] = useState<any>(null),
    [query, setQuery] = useState(''),
    [places, setPlaces] = useState<any[]>([]),
    [pickLocation, setPickLocation] = useState(false);
  const run = async (fn: () => Promise<any>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e: any) {
      setError(e.message || 'Không thực hiện được.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const load = useCallback(async () => {
    if (!tripId) {
      const d = await api('/conversations');
      if (mounted.current) setInbox(d.items);
      return;
    }
    const version = generation.current;
    const d = await api(`/${encodeURIComponent(tripId)}/messages`);
    if (!mounted.current || version !== generation.current) return;
    setActor(d.actor);
    setCanSend(d.canSend);
    setReplies(d.quickReplies || []);
    if (!olderRef.current) setMore(d.hasMore);
    setItems(current => {
      const byId = new Map((olderRef.current ? current : []).map(m => [m.id, m]));
      for (const m of d.items) byId.set(m.id, m);
      return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    });
    const latest = d.items.at(-1);
    if (latest && latest.id !== lastId.current) {
      if (lastId.current && latest.senderId !== d.actor.id) Haptics.selectionAsync().catch(() => {});
      lastId.current = latest.id;
      if (!olderRef.current) setTimeout(() => scroll.current?.scrollToEnd({
        animated: true
      }), 100);
    }
    if (latest && AppState.currentState === 'active') await post(`/${tripId}/read`, {
      messageId: latest.id
    });
  }, [tripId]);
  useEffect(() => {
    if (!focused) return;
    generation.current++;
    mounted.current = true;
    lastId.current = '';
    setItems([]);
    setOlder(false);
    olderRef.current = false;
    setDraft(null);
    setText('');
    const refresh = () => {
      if (AppState.currentState === 'active') void load().catch((e: any) => mounted.current && setError(e.message));
    };
    activeChatTrip = tripId;
    refresh();
    const timer = setInterval(refresh, 4000);
    const sub = AppState.addEventListener('change', state => {
      activeChatTrip = state === 'active' ? tripId : '';
      if (state === 'active') refresh();else if (recorder.current) void stopRecording();
    });
    return () => {
      generation.current++;
      mounted.current = false;
      activeChatTrip = '';
      clearInterval(timer);
      sub.remove();
      recorder.current?.stopAndUnloadAsync().catch(() => {});
      recorder.current = null;
      sound.current?.unloadAsync().catch(() => {});
    };
  }, [tripId, focused]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(() => {
    if (seconds >= 60 && recorder.current) void stopRecording();
  }, [seconds]);
  async function stopRecording() {
    const rec = recorder.current;
    if (!rec) return;
    recorder.current = null;
    try {
      const status = await rec.getStatusAsync();
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (uri && mounted.current) setDraft({
        uri,
        durationMs: Math.min(60000, Math.max(1, status.durationMillis)),
        clientId: id()
      });
    } catch (e: any) {
      if (mounted.current) setError(e.message);
    } finally {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true
      }).catch(() => {});
      if (mounted.current) setRecording(false);
    }
  }
  async function startRecording() {
    const p = await Audio.requestPermissionsAsync();
    if (!p.granted) throw new Error('Vui lòng cho phép sử dụng micro.');
    await sound.current?.unloadAsync();
    sound.current = null;
    setPlaying('');
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false
    });
    const result = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    recorder.current = result.recording;
    setSeconds(0);
    setRecording(true);
  }
  async function play(uri: string, key: string) {
    if (playing === key) {
      await sound.current?.unloadAsync();
      sound.current = null;
      setPlaying('');
      return;
    }
    await sound.current?.unloadAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true
    });
    const result = await Audio.Sound.createAsync({
      uri
    }, {
      shouldPlay: true
    });
    sound.current = result.sound;
    setPlaying(key);
    result.sound.setOnPlaybackStatusUpdate(status => {
      if (status.isLoaded && status.didJustFinish) {
        result.sound.unloadAsync().catch(() => {});
        if (mounted.current) setPlaying('');
      }
    });
  }
  async function sendText() {
    if (!text.trim()) return;
    const payload = text.trim();
    if (pendingText.current?.payload !== payload) pendingText.current = {
      payload,
      clientId: id()
    };
    await post(`/${tripId}/messages`, {
      kind: 'TEXT',
      text: payload,
      clientId: pendingText.current.clientId
    });
    pendingText.current = null;
    setText('');
    await load();
  }
  async function sendAudio() {
    if (!draft) return;
    const data = new FormData();
    if (Platform.OS === 'web') {
      const blob = await (await fetch(draft.uri)).blob();
      data.append('audio', blob, 'voice.webm');
    } else data.append('audio', {
      uri: draft.uri,
      type: 'audio/mp4',
      name: 'voice.m4a'
    } as any);
    data.append('clientId', draft.clientId);
    data.append('durationMs', String(draft.durationMs));
    await api(`/${tripId}/audio`, {
      method: 'POST',
      body: data
    });
    setDraft(null);
    await load();
  }
  async function currentLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) throw new Error('Không có quyền GPS. Bạn có thể tìm địa chỉ bên dưới.');
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High
    });
    setLocation({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      locationLabel: 'Vị trí hiện tại',
      clientId: id()
    });
  }
  async function search() {
    if (query.trim().length < 3) throw new Error('Nhập ít nhất 3 ký tự.');
    const d = await (await fetch(`${config.base}/api/maps/autocomplete?q=${encodeURIComponent(query)}`)).json();
    if (!d.success) throw new Error(d.message);
    setPlaces(d.items || []);
  }
  async function selectPlace(p: any) {
    const placeId = p.placeId || p.place_id || p.id;
    const d = await (await fetch(`${config.base}/api/maps/place-detail?placeId=${encodeURIComponent(placeId)}`)).json();
    if (!d.success) throw new Error(d.message);
    const raw = d.item?.data?.place || d.item?.data || d.item?.place || d.item?.result || d.item;
    const loc = raw?.geometry?.location || raw?.location || raw;
    const latitude = Number(raw?.lat ?? raw?.latitude ?? loc?.lat),
      longitude = Number(raw?.lng ?? raw?.longitude ?? loc?.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('Địa chỉ chưa có toạ độ.');
    setLocation({
      latitude,
      longitude,
      locationLabel: p.description || p.address || p.name || query,
      clientId: id()
    });
    setPlaces([]);
  }
  function openMap(lat: number, lon: number) {
    const url = Platform.OS === 'ios' ? `https://maps.apple.com/?ll=${lat},${lon}&q=${lat},${lon}` : `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    return Linking.openURL(url);
  }
  return <SafeAreaView style={{
    flex: 1,
    backgroundColor: '#f8fafc'
  }}><View style={{
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderBottomWidth: 1,
      borderColor: '#e2e8f0'
    }}><Pressable onPress={() => router.back()}><Text style={{
          color: blue
        }}>← Quay lại</Text></Pressable><Text style={{
        fontSize: 18,
        fontWeight: '800',
        color: ink,
        flex: 1
      }}>{tripId ? `Liên hệ #${tripId.slice(-8).toUpperCase()}` : 'Tin nhắn chuyến'}</Text></View>
 {!!error && <Text accessibilityRole="alert" style={{
      color: '#b91c1c',
      padding: 12
    }}>{error}</Text>}
 {!tripId ? <ScrollView contentContainerStyle={{
      padding: 16
    }}>{!inbox.length && <Text>Chưa có tin nhắn. Mở một chuyến để liên hệ.</Text>}{inbox.map(c => <Pressable key={c.tripId} style={{
        ...button,
        backgroundColor: 'white',
        marginBottom: 10
      }} onPress={() => router.push(`/trip-chat?tripId=${c.tripId}` as any)}><Text style={{
          fontWeight: '800'
        }}>#{c.tripId.slice(-8).toUpperCase()} {c.unread ? `· ${c.unread} chưa đọc` : ''}</Text><Text>{c.last.senderLabel} · {c.last.deletedAt ? 'Tin nhắn đã xoá' : c.last.kind === 'AUDIO' ? 'Tin nhắn thoại' : c.last.kind === 'LOCATION' ? 'Vị trí' : c.last.text}</Text></Pressable>)}</ScrollView> : <>
 <Text style={{
        padding: 10,
        color: '#64748b',
        fontSize: 12
      }}>Khách, tài xế phụ trách và GoViet247 cùng xem hội thoại này. Không chia sẻ số điện thoại cá nhân.</Text>
 <ScrollView ref={scroll} style={{
        flex: 1
      }} contentContainerStyle={{
        padding: 14,
        gap: 10
      }} keyboardShouldPersistTaps="handled">
 {more && <Pressable style={button} onPress={() => void run(async () => {
          const d = await api(`/${tripId}/messages?before=${items[0]?.id}`);
          setOlder(true);
          olderRef.current = true;
          setItems(current => [...d.items, ...current.filter(m => !d.items.some((x: Msg) => x.id === m.id))]);
          setMore(d.hasMore);
        })}><Text>Tải tin cũ hơn</Text></Pressable>}
 {items.map(m => <View key={m.id} style={{
          alignSelf: m.senderId === actor.id ? 'flex-end' : 'flex-start',
          maxWidth: '92%',
          backgroundColor: m.senderId === actor.id ? '#dbeafe' : 'white',
          padding: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#e2e8f0'
        }}><Text style={{
            fontSize: 12,
            fontWeight: '700',
            color: '#475569',
            marginBottom: 5
          }}>{m.senderLabel}</Text>
 {m.deletedAt ? <Text style={{
            fontStyle: 'italic',
            color: '#64748b'
          }}>Tin nhắn đã được GoViet247 xoá.</Text> : m.kind === 'TEXT' ? <Text selectable style={{
            color: ink,
            fontSize: 15,
            lineHeight: 22
          }}>{m.text}</Text> : m.kind === 'AUDIO' ? <Pressable disabled={recording} style={button} onPress={() => void run(async () => {
            const d = await api(`/${tripId}/audio/${m.id}`);
            await play(d.url, m.id);
          })}><Text style={{
              color: blue
            }}>{playing === m.id ? '⏹ Dừng' : '▶ Nghe ghi âm'} · {Math.ceil((m.durationMs || 0) / 1000)} giây</Text></Pressable> : <Pressable onPress={() => void run(() => openMap(m.latitude!, m.longitude!))}><Text style={{
              color: blue,
              fontWeight: '700'
            }}>📍 {m.locationLabel || 'Vị trí được gửi'}</Text><Text style={{
              fontSize: 12,
              color: '#64748b'
            }}>Vị trí tại thời điểm gửi · Bấm mở bản đồ</Text></Pressable>}
 {actor.role === 'ADMIN' && !m.deletedAt && <Pressable disabled={busy} style={button} onPress={() => Alert.alert('Xoá tin nhắn', 'Xoá nội dung khỏi hội thoại? Thao tác được lưu nhật ký.', [{
            text: 'Giữ lại',
            style: 'cancel'
          }, {
            text: 'Xoá',
            style: 'destructive',
            onPress: () => void run(async () => {
              await sound.current?.unloadAsync();
              sound.current = null;
              setPlaying('');
              await api(`/${tripId}/messages/${m.id}`, {
                method: 'DELETE'
              });
              await load();
            })
          }])}><Text style={{
              color: '#b91c1c'
            }}>Xoá tin</Text></Pressable>}
 <Text style={{
            fontSize: 11,
            color: '#64748b',
            marginTop: 7
          }}>{new Date(m.createdAt).toLocaleString('vi-VN')}</Text></View>)}
 </ScrollView>
 {!canSend ? <Text style={{
        padding: 16,
        color: '#64748b'
      }}>Hội thoại chỉ đọc khi chưa có tài xế hoặc chuyến đã kết thúc. Liên hệ hỗ trợ GoViet247 nếu cần.</Text> : <View style={{
        padding: 10,
        borderTopWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: 'white'
      }}>
 <ScrollView horizontal showsHorizontalScrollIndicator={false}>{replies.map(reply => <Pressable key={reply} disabled={busy || recording} onPress={() => setText(reply)} style={{
            ...button,
            maxWidth: 260
          }}><Text style={{
              color: blue,
              fontSize: 12
            }}>{reply}</Text></Pressable>)}</ScrollView>
 {pickLocation && <View style={{
          padding: 8,
          backgroundColor: '#f1f5f9',
          borderRadius: 12
        }}><Pressable style={button} disabled={busy} onPress={() => void run(currentLocation)}><Text>📍 Dùng vị trí hiện tại</Text></Pressable><TextInput placeholder="Tìm địa chỉ / điểm hẹn" value={query} onChangeText={setQuery} style={{
            padding: 10,
            borderWidth: 1,
            borderColor: '#cbd5e1',
            borderRadius: 8
          }} /><Pressable style={button} disabled={busy} onPress={() => void run(search)}><Text>Tìm điểm</Text></Pressable>{places.slice(0, 5).map((p: any, i: number) => <Pressable key={i} style={button} onPress={() => void run(() => selectPlace(p))}><Text>{p.description || p.address || p.name}</Text></Pressable>)}{location && <><Text>{location.locationLabel} ({location.latitude.toFixed(5)}, {location.longitude.toFixed(5)})</Text><Pressable style={button} onPress={() => void run(() => openMap(location.latitude, location.longitude))}><Text>Xem điểm trên bản đồ</Text></Pressable><Pressable style={button} disabled={busy} onPress={() => void run(async () => {
              await post(`/${tripId}/messages`, {
                kind: 'LOCATION',
                ...location
              });
              setLocation(null);
              setPickLocation(false);
              await load();
            })}><Text style={{
                color: blue,
                fontWeight: '800'
              }}>Gửi vị trí này</Text></Pressable></>}<Pressable onPress={() => {
            setPickLocation(false);
            setLocation(null);
          }}><Text>Đóng chọn vị trí</Text></Pressable></View>}
 {draft ? <View style={{
          flexDirection: 'row',
          flexWrap: 'wrap'
        }}><Pressable style={button} onPress={() => void run(() => play(draft.uri, 'draft'))}><Text>{playing === 'draft' ? 'Dừng nghe' : '▶ Nghe lại'} · {Math.ceil(draft.durationMs / 1000)}s</Text></Pressable><Pressable style={button} disabled={busy} onPress={() => void run(sendAudio)}><Text>Gửi ghi âm</Text></Pressable><Pressable style={button} disabled={busy} onPress={() => {
            sound.current?.unloadAsync().catch(() => {});
            setDraft(null);
            setPlaying('');
          }}><Text>Xoá</Text></Pressable></View> : <>
 <TextInput multiline maxLength={2000} value={text} onChangeText={setText} editable={!recording && !busy} placeholder="Nhắn tin cho chuyến…" style={{
            borderWidth: 1,
            borderColor: '#cbd5e1',
            borderRadius: 12,
            padding: 12,
            maxHeight: 110,
            color: ink,
            marginTop: 6
          }} />
 <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap'
          }}><Pressable style={button} disabled={busy || recording || !text.trim()} onPress={() => void run(sendText)}><Text style={{
                fontWeight: '800',
                color: blue
              }}>Gửi</Text></Pressable><Pressable style={button} disabled={busy} onPress={() => void run(recording ? stopRecording : startRecording)}><Text>{recording ? `⏹ Dừng (${seconds}s)` : '🎙 Ghi âm'}</Text></Pressable><Pressable style={button} disabled={busy || recording} onPress={() => setPickLocation(v => !v)}><Text>📍 Vị trí</Text></Pressable></View></>}
 <Text style={{
          fontSize: 11,
          color: '#64748b'
        }}>Ghi âm tối đa 60 giây. Vui lòng dừng xe an toàn trước khi thao tác.</Text>
 </View>}
 </>}
 </SafeAreaView>;
}
