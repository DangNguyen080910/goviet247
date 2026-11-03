import { chatAudienceLabel } from '../api/src/shared/tripChatVisibility.js';
import { playChatAlert, setChatRecordingActive } from './chatAlerts';
import { createChatRecording } from './audioRecording';
import { splitChatLinks } from './chatLinks';
import { newUnreadConversations } from '../api/src/shared/chatAlerts.js';
import DraggableFloatingAction from './DraggableFloatingAction';
import { isRiderChatEnded, RIDER_CHAT_ENDED_NOTICE } from '../api/src/shared/tripChat.js';
import { useIsFocused } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Alert, Image, Keyboard, KeyboardAvoidingView, Modal, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
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
  const response = await fetch(`${config.base}/api/trip-chat${path}${path.includes('?') ? '&' : '?'}media=images`, {
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
  if (!response.ok) throw Object.assign(new Error(data.message || 'Không tải được hội thoại.'), {code:data.code});
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
  label = 'Liên hệ chuyến',
  status,
  onOpen,
  prominent = false
}: {
  tripId: string;
  label?: string;
  status?: string;
  onOpen?: () => void;
  prominent?: boolean;
}) {
  const ended = config?.role === 'RIDER' && isRiderChatEnded(status);
  return <Pressable accessibilityRole="button" onPress={event => { event.stopPropagation(); if (ended) Alert.alert('Liên hệ GoViet247', RIDER_CHAT_ENDED_NOTICE); else if (onOpen) onOpen(); else router.push(`/trip-chat?tripId=${encodeURIComponent(tripId)}` as any); }} style={[button, prominent ? {backgroundColor:blue,minHeight:48,justifyContent:'center',alignItems:'center',marginHorizontal:0,marginBottom:12} : null, ended ? {backgroundColor:'#f1f5f9'} : null]}><Text style={{
      color: ended ? '#64748b' : prominent ? 'white' : blue,
      fontWeight: '700'
    }}>💬 {label}</Text></Pressable>;
}
export function ChatInboxBadge({inline = false}: {inline?: boolean} = {}) {
  const [unread, setUnread] = useState(0),
    [signed, setSigned] = useState(false);
  const path = usePathname();
  const last = useRef(-1);
  const previousInbox = useRef(new Map<string,string>());
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
        previousInbox.current.clear();
        return;
      }
      try {
        const d = await api('/conversations');
        if (!alive) return;
        setUnread(d.unread);
        for (const c of newUnreadConversations(previousInbox.current,d.items,d.actorId)) if(c.tripId!==activeChatTrip) void playChatAlert(c.last.id);
        previousInbox.current=new Map(d.items.map((c:any)=>[c.tripId,c.last.id]));
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
  const draggable = !inline && ['ADMIN', 'DRIVER'].includes(config?.role);
  const action = <Pressable accessibilityLabel={`Tin nhắn chuyến, ${unread} chưa đọc${draggable ? ", có thể kéo để di chuyển" : ""}`} onPress={() => router.push('/trip-chat' as any)} style={{
    ...(inline || draggable ? {minHeight:48,alignItems:'center' as const,justifyContent:'center' as const,width:'100%' as const} : {position:'absolute' as const,right:16,bottom:100}),
    backgroundColor: blue,
    padding: 12,
    borderRadius: 24,
    elevation: 6
  }}><Text style={{
      color: 'white',
      fontWeight: '800'
    }}>💬 Tin nhắn{unread ? ` (${unread})` : ''}</Text></Pressable>;
  return draggable ? <DraggableFloatingAction storageKey={config.role === 'DRIVER' ? 'goviet247_driver_inbox_position_v1' : 'goviet247_admin_inbox_position_v1'}>{action}</DraggableFloatingAction> : action;
}
type Msg = {
  deletedAt?: string | null;
  id: string;
  senderId: string;
  senderLabel: string;
  senderRole?: string;
  audience?: string;
  kind: string;
  text?: string;
  createdAt: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
  durationMs?: number;
};
function ChatImage({tripId, messageId, onOpen}: {tripId:string; messageId:string; onOpen:()=>void}) {
  const [uri, setUri] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    api(`/${tripId}/image/${messageId}`).then(d => {if (alive) setUri(d.url);}).catch(() => {if (alive) setFailed(true);});
    return () => {alive = false;};
  }, [tripId, messageId]);
  return <Pressable accessibilityRole="button" accessibilityLabel="Xem ảnh chuyến" onPress={onOpen}>
    {uri && !failed ? <Image source={{uri}} resizeMode="cover" style={{width:220,height:165,borderRadius:10,maxWidth:'100%'}} onError={() => setFailed(true)} /> : <Text style={{padding:20,color:blue}}>{failed ? 'Ảnh chưa tải được · Bấm thử lại' : 'Đang tải ảnh…'}</Text>}
    <Text style={{color:blue,fontSize:12,marginTop:5}}>Bấm xem ảnh lớn</Text>
  </Pressable>;
}
export default function TripChatScreen() {
  const focused = useIsFocused();
  const params = useLocalSearchParams<{
      tripId?: string;
    }>(),
    tripId = String(params.tripId || '');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      setKeyboardVisible(true);
      requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: true }));
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
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
  const [imageDraft, setImageDraft] = useState<{uri:string; type:string; name:string; clientId:string} | null>(null);
  const [imageView, setImageView] = useState<{id:string; uri:string} | null>(null);
  const sending = useRef(false);
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

  const run = async (fn: () => Promise<any>) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e: any) {
      setError(e.message || 'Không thực hiện được.');
    } finally {
      sending.current = false;
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
    let d;
    try { d = await api(`/${encodeURIComponent(tripId)}/messages`); }
    catch (error: any) {
      if (error.code === 'RIDER_CHAT_ENDED' && version === generation.current && mounted.current) {
        generation.current++;
        setItems([]); setImageView(null); setImageDraft(null); setCanSend(false); setMore(false); setReplies([]);
        await sound.current?.unloadAsync(); sound.current = null; setPlaying('');
      }
      throw error;
    }
    if (!mounted.current || version !== generation.current) return;
    setImageView(current => current && d.items.some((m:Msg) => m.id === current.id && m.deletedAt) ? null : current);
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
      if (lastId.current && latest.senderId !== d.actor.id) void playChatAlert(latest.id);
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
    setImageDraft(null);
    setImageView(null);
    setCanSend(false);
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
      if (recorder.current) setChatRecordingActive(false);
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
      setChatRecordingActive(false);
      if (mounted.current) setRecording(false);
    }
  }
  async function startRecording() {
    const version = generation.current;
    setChatRecordingActive(true);
    try {
      await sound.current?.unloadAsync();
      sound.current = null;
      setPlaying('');
      const recording = await createChatRecording(() => mounted.current && version === generation.current);
      if (!mounted.current || version !== generation.current || AppState.currentState !== 'active') {
        await recording.stopAndUnloadAsync().catch(() => {});
        setChatRecordingActive(false);
        return;
      }
      recorder.current = recording;
      setSeconds(0);
      setRecording(true);
    } catch (error) { setChatRecordingActive(false); throw error; }
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
    await sound.current?.unloadAsync();
    sound.current = null;
    setPlaying('');
    const version = generation.current;
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
    if (!mounted.current || version !== generation.current) return;
    setDraft(null);
    await load();
  }
  async function chooseImage(camera: boolean) {
    const version = generation.current;
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error('Vui lòng cho phép camera để chụp ảnh, hoặc chọn ảnh có sẵn.');
    }
    const options: ImagePicker.ImagePickerOptions = {mediaTypes:['images'], quality:0.75, allowsMultipleSelection:false, exif:false,
      preferredAssetRepresentationMode:ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible};
    const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !mounted.current || version !== generation.current) return;
    const asset = result.assets[0];
    if ((asset.fileSize || 0) > 10 * 1024 * 1024) throw new Error('Ảnh tối đa 10 MB. Vui lòng chọn ảnh nhỏ hơn.');
    setImageDraft({uri:asset.uri, type:asset.mimeType && ['image/jpeg','image/png','image/webp'].includes(asset.mimeType) ? asset.mimeType : 'image/jpeg', name:asset.fileName || 'photo.jpg', clientId:id()});
  }
  async function sendImage() {
    if (!imageDraft) return;
    const version = generation.current;
    const data = new FormData();
    if (Platform.OS === 'web') {
      const blob = await (await fetch(imageDraft.uri)).blob();
      data.append('image', blob, imageDraft.name);
    } else data.append('image', {uri:imageDraft.uri, type:imageDraft.type, name:imageDraft.name} as any);
    data.append('clientId', imageDraft.clientId);
    await api(`/${tripId}/image`, {method:'POST',body:data});
    if (!mounted.current || version !== generation.current) return;
    setImageDraft(null);
    await load();
  }
  async function viewImage(messageId:string) {
    const version = generation.current;
    const d = await api(`/${tripId}/image/${messageId}`);
    if (mounted.current && version === generation.current) setImageView({id:messageId,uri:d.url});
  }
  async function currentLocation() {
    const version = generation.current;
    Keyboard.dismiss();
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) throw new Error('Vui lòng cho phép vị trí trong Cài đặt để gửi định vị hiện tại.');
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    if (!mounted.current || version !== generation.current) return;
    await post(`/${tripId}/messages`, {
      kind: 'LOCATION',
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      locationLabel: 'Định vị hiện tại',
      clientId: id()
    });
    await load();
  }
  function openMap(lat: number, lon: number) {
    const url = Platform.OS === 'ios' ? `https://maps.apple.com/?ll=${lat},${lon}&q=${lat},${lon}` : `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    return Linking.openURL(url);
  }
  return <SafeAreaView style={{
    flex: 1,
    backgroundColor: '#f8fafc'
  }}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><View style={{
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
        }}>#{c.tripId.slice(-8).toUpperCase()} {c.unread ? `· ${c.unread} chưa đọc` : ''}</Text><Text>{c.last.senderLabel} · {c.last.deletedAt ? 'Tin nhắn đã xoá' : c.last.kind === 'AUDIO' ? 'Tin nhắn thoại' : c.last.kind === 'IMAGE' ? 'Hình ảnh' : c.last.kind === 'LOCATION' ? 'Vị trí' : c.last.text}</Text></Pressable>)}</ScrollView> : <>
 <Text style={{
        padding: 10,
        color: '#64748b',
        fontSize: 12
      }}>Bạn có thể nhắn GoViet247 ngay sau khi đặt chuyến. Tài xế tham gia sau khi nhận chuyến. Không chia sẻ số điện thoại cá nhân.</Text>
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
          }}>{m.senderLabel}</Text>{config.role === 'ADMIN' && m.senderRole === 'SYSTEM' && <Text style={{fontSize:11,color:'#64748b',marginBottom:4}}>{chatAudienceLabel(m.audience)}</Text>}
 {m.deletedAt ? <Text style={{
            fontStyle: 'italic',
            color: '#64748b'
          }}>Tin nhắn đã được GoViet247 xoá.</Text> : m.kind === 'TEXT' ? <Text selectable style={{
            color: ink,
            fontSize: 15,
            lineHeight: 22
          }}>{splitChatLinks(m.text || '').map((part, index) => part.url ? <Text key={index} accessibilityRole="link" style={{color: blue, textDecorationLine: 'underline'}} onPress={() => void run(() => Linking.openURL(part.url!))}>{part.text}</Text> : part.text)}</Text> : m.kind === 'IMAGE' ? <ChatImage tripId={tripId} messageId={m.id} onOpen={() => void run(() => viewImage(m.id))} /> : m.kind === 'AUDIO' ? <Pressable disabled={recording} style={button} onPress={() => void run(async () => {
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
              setImageView(null);
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
      }}>Hội thoại hiện chỉ đọc. Chuyến đã kết thúc hoặc tài khoản chưa có quyền gửi tin. Liên hệ hỗ trợ GoViet247 nếu cần.</Text> : <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, flexShrink: 1, maxHeight: '65%' }} contentContainerStyle={{
        padding: 10,
        borderTopWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: 'white'
      }}>
 {!keyboardVisible && <ScrollView horizontal showsHorizontalScrollIndicator={false}>{replies.map(reply => <Pressable key={reply} disabled={busy || recording} onPress={() => setText(reply)} style={{
            ...button,
            maxWidth: 260
          }}><Text style={{
              color: blue,
              fontSize: 12
            }}>{reply}</Text></Pressable>)}</ScrollView>}
 {imageDraft ? <View style={{padding:8}}><Text style={{color:ink,fontWeight:'700'}}>Xem trước ảnh</Text><Image source={{uri:imageDraft.uri}} resizeMode="contain" style={{height:170,width:'100%',marginVertical:8}} /><View style={{flexDirection:'row'}}><Pressable disabled={busy} style={button} onPress={() => void run(sendImage)}><Text style={{color:blue,fontWeight:'800'}}>{busy ? 'Đang gửi…' : 'Gửi ảnh'}</Text></Pressable><Pressable disabled={busy} style={button} onPress={() => setImageDraft(null)}><Text>Bỏ ảnh</Text></Pressable></View></View> : draft ? <View style={{
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
              }}>Gửi</Text></Pressable><Pressable style={button} disabled={busy} onPress={() => { Keyboard.dismiss(); void run(recording ? stopRecording : startRecording); }}><Text>{recording ? `⏹ Dừng (${seconds}s)` : '🎙 Ghi âm'}</Text></Pressable><Pressable style={button} disabled={busy || recording} onPress={() => void run(currentLocation)}><Text>📍 Gửi định vị</Text></Pressable><Pressable style={button} disabled={busy || recording} onPress={() => { Keyboard.dismiss(); void run(() => chooseImage(true)); }}><Text>📷 Chụp ảnh</Text></Pressable><Pressable style={button} disabled={busy || recording} onPress={() => { Keyboard.dismiss(); void run(() => chooseImage(false)); }}><Text>🖼 Chọn ảnh</Text></Pressable></View></>}
 <Text style={{
          fontSize: 11,
          color: '#64748b'
        }}>Ghi âm tối đa 60 giây. Vui lòng dừng xe an toàn trước khi thao tác.</Text>
 </ScrollView>}
 </>}
 </KeyboardAvoidingView>
 <Modal visible={Boolean(imageView)} transparent animationType="fade" onRequestClose={() => setImageView(null)}>
 <SafeAreaView style={{flex:1,backgroundColor:'rgba(0,0,0,0.96)'}}><Pressable accessibilityLabel="Đóng ảnh" onPress={() => setImageView(null)} style={{padding:18,alignSelf:'flex-end'}}><Text style={{color:'white',fontSize:18}}>Đóng ✕</Text></Pressable>{imageView && <Image source={{uri:imageView.uri}} resizeMode="contain" style={{flex:1,width:'100%'}} onError={() => {setImageView(null);setError('Không tải được ảnh. Bấm vào ảnh để thử lại.');}} />}</SafeAreaView>
 </Modal>
 </SafeAreaView>;
}
