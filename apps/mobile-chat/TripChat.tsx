import {showPermissionSettings} from './permissionHelp';
import {chatSupportUrl} from '../api/src/shared/chatSupport.js';
import {configureCalls, TripCallButton, useTripCallActive} from './TripCalls';
import {chatTripDetailRows,chatConversationRoute} from '../api/src/shared/chatTripDetail.js';
import { chatAudienceLabel } from '../api/src/shared/tripChatVisibility.js';
import { playChatAlert, setChatRecordingActive } from './chatAlerts';
import { createChatRecording } from './audioRecording';
import { splitChatLinks } from './chatLinks';
import { newUnreadConversations, chatMessageAlertsAdmin } from '../api/src/shared/chatAlerts.js';
import DraggableFloatingAction from './DraggableFloatingAction';
import { isRiderChatEnded, RIDER_CHAT_ENDED_NOTICE, DRIVER_CHAT_ENDED_NOTICE, COMPLETED_CHAT_NOTICE } from '../api/src/shared/tripChat.js';
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
  configureCalls(value);
}
export function isChatVisible(data: Record<string, unknown>) {
  return ['TRIP_CHAT','TRIP_CALL_MISSED'].includes(String(data?.type)) && activeChatTrip === String(data.tripId) && AppState.currentState === 'active';
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
const chatActionButton = {flex:1,minWidth:0,minHeight:64,paddingHorizontal:2,paddingVertical:8,borderRadius:12,backgroundColor:'#eff6ff',alignItems:'center',justifyContent:'center',gap:4} as const;
const chatActionLabel = {fontSize:12,textAlign:'center',color:ink} as const;
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
  const driverEnded=config?.role==='DRIVER' && ['COMPLETED','CANCELLED'].includes(String(status));
  const ended = driverEnded || (config?.role === 'RIDER' && isRiderChatEnded(status));
  return <Pressable accessibilityRole="button" onPress={event => { event.stopPropagation(); if (ended) Alert.alert('Liên hệ GoViet247', driverEnded?DRIVER_CHAT_ENDED_NOTICE:RIDER_CHAT_ENDED_NOTICE,[{text:'Đóng',style:'cancel'},{text:'Mở Zalo hỗ trợ',onPress:()=>{void chatSupportUrl(config.base,config.role).then(url=>Linking.openURL(url)).catch(error=>Alert.alert('Liên hệ GoViet247',error.message));}}]); else if (onOpen) onOpen(); else router.push(`/trip-chat?tripId=${encodeURIComponent(tripId)}` as any); }} style={[button, prominent ? {backgroundColor:blue,minHeight:48,justifyContent:'center',alignItems:'center',marginHorizontal:0,marginBottom:12} : null, ended ? {backgroundColor:'#f1f5f9'} : null]}><Text style={{
      color: ended ? '#64748b' : prominent ? 'white' : blue,
      fontWeight: '700'
    }}>💬 {config?.role!=='ADMIN' && isRiderChatEnded(status)?'Liên hệ hỗ trợ':label}</Text></Pressable>;
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
  recordingCallId?: string;
  heartCount?: number;
  hearted?: boolean;
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
  const callActive=useTripCallActive();
  useEffect(()=>{
    if(!callActive)return;
    // Discard an interrupted voice draft; never send it automatically during a call.
    generation.current++;
    const rec=recorder.current;recorder.current=null;
    void rec?.stopAndUnloadAsync().catch(()=>{});
    void sound.current?.unloadAsync().catch(()=>{});sound.current=null;
    setRecording(false);setPlaying('');setChatRecordingActive(false);
  },[callActive]);
  const [chatStatus,setChatStatus]=useState('');
  const [tripView,setTripView]=useState<{id:string;loading:boolean;trip?:any;error?:string}|null>(null);
  const detailRequest=useRef(0);
  useEffect(()=>()=>{detailRequest.current++;},[]);
  function closeTripView(){detailRequest.current++;setTripView(null);}
  async function showTrip(id:string){
    Keyboard.dismiss();const request=++detailRequest.current;setTripView({id,loading:true});
    try{const data=await api(`/${encodeURIComponent(id)}/trip`);if(detailRequest.current===request)setTripView({id,loading:false,trip:data.trip});}
    catch(error:any){if(detailRequest.current===request)setTripView({id,loading:false,error:error.message});}
  }

  const focused = useIsFocused();
  const params = useLocalSearchParams<{
      tripId?: string;
      messageId?: string;
      callId?: string;
    }>(),
    tripId = String(params.tripId || '');
  const targetMessageId = String(params.messageId || '');
  const targetLoaded = useRef(''), targetFocused = useRef('');
  const atBottom = useRef(!targetMessageId);
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
  const historyFrom = useRef<string | null>(null);
  const sending = useRef(false);
  const [recording, setRecording] = useState(false),
    [draft, setDraft] = useState<{
      uri: string;
      durationMs: number;
      clientId: string;
    } | null>(null),
    [seconds, setSeconds] = useState(0),
    [playing, setPlaying] = useState('');
  const [playback, setPlayback] = useState({id:'',state:'idle',position:0,duration:0});
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
  const load = useCallback(async (): Promise<void> => {
    if (!tripId) {
      const d = await api('/conversations');
      if (mounted.current) setInbox(d.items);
      return;
    }
    const version = generation.current;
    let d;
    try {
      const target = targetMessageId && targetLoaded.current !== targetMessageId;
      d = await api(`/${encodeURIComponent(tripId)}/messages${target ? `?around=${encodeURIComponent(targetMessageId)}` : targetMessageId && lastId.current ? `?after=${encodeURIComponent(lastId.current)}` : ''}`);
      if (target && mounted.current && version === generation.current) { targetLoaded.current = targetMessageId; olderRef.current = true; setMore(d.hasMore); }
    }
    catch (error: any) {
      if (['RIDER_CHAT_ENDED','DRIVER_CHAT_ENDED'].includes(error.code) && version === generation.current && mounted.current) {
        generation.current++;
        setItems([]); setImageView(null); setImageDraft(null); setCanSend(false);setChatStatus(''); setMore(false); setReplies([]);
        await sound.current?.unloadAsync(); sound.current = null; setPlaying('');
      }
      throw error;
    }
    if (!mounted.current || version !== generation.current) return;
    if (historyFrom.current && (!d.visibleFrom || d.visibleFrom < historyFrom.current)) return;
    if (historyFrom.current !== d.visibleFrom || d.historyReset) {
      historyFrom.current = d.visibleFrom || null;
      olderRef.current = false; lastId.current = ''; setMore(d.hasMore);
      setImageView(null); await sound.current?.unloadAsync(); sound.current = null; setPlaying('');
    }
    setImageView(current => current && d.items.some((m:Msg) => m.id === current.id && m.deletedAt) ? null : current);
    setActor(d.actor);
    setCanSend(d.canSend);setChatStatus(d.status || '');
    setReplies(d.quickReplies || []);
    if (!olderRef.current) setMore(d.hasMore);
    const deleted=new Map<string,string>((d.deletedMessages || []).map((m:any)=>[String(m.id),String(m.deletedAt)]));
    if(deleted.has(playing)){await sound.current?.unloadAsync();sound.current=null;setPlaying('');}
    setImageView(current=>current && deleted.has(current.id)?null:current);
    setItems(current => {
      const byId = new Map((olderRef.current ? current.filter(m => !d.visibleFrom || m.createdAt >= d.visibleFrom) : []).map(m => [m.id, m]));
      for (const m of d.items) byId.set(m.id, m);
      for(const [id,deletedAt] of deleted){const old=byId.get(id);if(old)byId.set(id,{...old,deletedAt,text:undefined,heartCount:0,hearted:false});}
      return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    });
    const latest = d.items.at(-1);
    if (latest && latest.id !== lastId.current) {
      if (lastId.current && latest.senderId !== d.actor.id && (d.actor.role !== 'ADMIN' || chatMessageAlertsAdmin(latest))) void playChatAlert(latest.id);
      lastId.current = latest.id;
      if (!olderRef.current && !targetMessageId) setTimeout(() => scroll.current?.scrollToEnd({
        animated: true
      }), 100);
    }
    if (latest && atBottom.current && AppState.currentState === 'active') await post(`/${tripId}/read`, {
      messageId: latest.id
    });
    if (targetMessageId && d.hasMore && d.items.length && targetLoaded.current) {
      setTimeout(() => { if (mounted.current && version === generation.current && AppState.currentState === 'active') void load().catch((e:any)=>setError(e.message)); }, 100);
    }
  }, [tripId, targetMessageId]);
  useEffect(() => {
    if (!focused) return;
    generation.current++;
    mounted.current = true;
    lastId.current = '';
    historyFrom.current = null;
    targetLoaded.current = ''; targetFocused.current = ''; atBottom.current = !targetMessageId;
    setItems([]);
    setOlder(false);
    olderRef.current = false;
    setDraft(null);
    setImageDraft(null);
    setImageView(null);
    setCanSend(false);setChatStatus('');
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
  }, [tripId, focused, targetMessageId]);
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
  async function listenTo(key: string, work: () => Promise<void>) {
    await run(async () => {
      try {
        if (playing === key && sound.current) { await play('',key); return; }
        setPlayback({id:key,state:'loading',position:0,duration:0});
        await work();
      }
      catch (e: any) {
        setPlayback({id:key,state:'error',position:0,duration:0});
        Alert.alert('Chưa nghe được ghi âm', e.message || 'Vui lòng thử lại.');
        throw e;
      }
    });
  }
  async function play(uri: string, key: string, mimeType?: string) {
    if (playing === key && sound.current) {
      const status = await sound.current.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) await sound.current.pauseAsync();
        else await sound.current.playAsync();
        return;
      }
    }
    await sound.current?.unloadAsync();
    sound.current = null;
    setPlaying('');
    await Audio.setIsEnabledAsync(true);
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false,
      shouldDuckAndroid: false
    });
    const result = await Audio.Sound.createAsync({
      uri,
      ...(mimeType ? {overrideFileExtensionAndroid: mimeType.includes('webm') ? 'webm' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mpeg') ? 'mp3' : mimeType.includes('aac') ? 'aac' : 'mp4'} : {})
    }, {
      shouldPlay: true,
      progressUpdateIntervalMillis: 250,
      volume: 1.0
    });
    sound.current = result.sound;
    setPlaying(key);
    result.sound.setOnPlaybackStatusUpdate(status => {
      if (sound.current !== result.sound || !mounted.current) return;
      if (status.isLoaded) setPlayback({id:key,state:status.didJustFinish?'ended':status.isBuffering?'loading':status.isPlaying?'playing':'paused',position:status.positionMillis,duration:status.durationMillis || 0});
      if (!status.isLoaded && status.error && mounted.current) {
        setPlayback(current => ({...current,state:'error'}));
        setPlaying('');
        setError('Không phát được ghi âm. Vui lòng bấm nghe lại.');
        Alert.alert('Chưa nghe được ghi âm', 'Không tải hoặc phát được file âm thanh. Vui lòng thử lại.');
      }
      if (status.isLoaded && status.didJustFinish) {
        setPlaying('');
      }
    });
  }
  function playbackLabel(key: string, call = false, duration = 0) {
    const item = playback.id === key ? playback : null;
    const time = (ms: number) => `${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
    if (item?.state === 'loading') return '⏳ Đang tải ghi âm…';
    if (item?.state === 'error') return '↻ Lỗi phát · Thử lại';
    if (item?.state === 'ended') return '↻ Đã nghe xong · Nghe lại';
    if (playing === key && item) return `${item.state === 'playing' ? '⏸ Đang phát · Tạm dừng' : '▶ Đã tạm dừng · Nghe tiếp'} · ${time(item.position)} / ${time(item.duration || duration)}`;
    return call ? '▶ Nghe ghi âm cuộc gọi' : `▶ Nghe ghi âm · ${time(duration)}`;
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
      if (!permission.granted) {showPermissionSettings('Cho phép chụp ảnh','Bật Camera cho GoViet247 để chụp và gửi ảnh. Bạn cũng có thể chọn ảnh có sẵn.');return;}
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
    if (!permission.granted) {showPermissionSettings('Cho phép gửi vị trí','Bật quyền Vị trí khi dùng GoViet247 để gửi định vị hiện tại.');return;}
    if (!await Location.hasServicesEnabledAsync()) {
      if (Platform.OS === 'android') {try {await Location.enableNetworkProviderAsync();} catch {throw new Error('Vui lòng bật Vị trí/GPS trên điện thoại rồi gửi lại.');}}
      else {Alert.alert('Bật Dịch vụ định vị','Mở Cài đặt → Quyền riêng tư & Bảo mật → Dịch vụ định vị, bật định vị rồi quay lại gửi vị trí.');return;}
    }
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
      }}>{tripId ? 'Liên hệ chuyến' : 'Tin nhắn chuyến'}</Text>{tripId && <TripCallButton tripId={tripId}/>}</View>
 {tripId ? <View style={{paddingHorizontal:12,paddingVertical:6,gap:8,flexDirection:'row',alignItems:'center'}}><Text selectable numberOfLines={1} ellipsizeMode="middle" accessibilityLabel={`Mã chuyến ${tripId}`} style={{fontWeight:'800',flex:1,minWidth:0,color:ink}}>#{tripId}</Text><Pressable accessibilityRole="button" style={[button,{flexShrink:0,margin:0}]} onPress={()=>void showTrip(tripId)}><Text style={{color:blue}}>Xem chuyến</Text></Pressable></View> : null}
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
      }} onPress={() => router.push(`/trip-chat?tripId=${encodeURIComponent(c.tripId)}` as any)}><Text style={{
          fontWeight: '800'
        }}>#{c.tripId} {c.unread ? `· ${c.unread} chưa đọc` : ''}</Text>{chatConversationRoute(c) ? <Text style={{color:'#64748b',marginVertical:6}}>{chatConversationRoute(c)}</Text> : null}<Text>{c.last.senderLabel} · {c.last.deletedAt ? 'Tin nhắn đã xoá' : c.last.kind === 'AUDIO' ? 'Tin nhắn thoại' : c.last.kind === 'IMAGE' ? 'Hình ảnh' : c.last.kind === 'LOCATION' ? 'Vị trí' : c.last.text}</Text><Pressable accessibilityRole="button" style={button} onPress={event=>{event.stopPropagation();router.push(`/trip-chat?tripId=${encodeURIComponent(c.tripId)}` as any);}}><Text style={{color:blue}}>Xem tin nhắn</Text></Pressable></Pressable>)}</ScrollView> : <>
 <ScrollView ref={scroll} scrollEventThrottle={100} onScroll={event => {
   const {layoutMeasurement,contentOffset,contentSize} = event.nativeEvent;
   atBottom.current = layoutMeasurement.height + contentOffset.y >= contentSize.height - 30;
   if (atBottom.current && lastId.current && AppState.currentState === "active") void post(`/${tripId}/read`,{messageId:lastId.current}).catch(()=>{});
 }} style={{
        flex: 1
      }} contentContainerStyle={{
        padding: 14,
        gap: 10
      }} keyboardShouldPersistTaps="handled">
 {chatStatus==='COMPLETED' && <Text style={{color:'#64748b',fontSize:13}}>{COMPLETED_CHAT_NOTICE}</Text>}
 {more && <Pressable style={button} onPress={() => void run(async () => {
          const d = await api(`/${tripId}/messages?before=${items[0]?.id}`);
          if (d.visibleFrom !== historyFrom.current || d.historyReset) { await load(); return; }
          setOlder(true);
          olderRef.current = true;
          setItems(current => [...d.items, ...current.filter(m => !d.items.some((x: Msg) => x.id === m.id))]);
          setMore(d.hasMore);
        })}><Text>Tải tin cũ hơn</Text></Pressable>}
 {items.map(m => <View key={m.id} onLayout={event => {
          if (m.id === targetMessageId && targetFocused.current !== targetMessageId) {
            targetFocused.current = targetMessageId;
            const y = event.nativeEvent.layout.y;
            requestAnimationFrame(() => scroll.current?.scrollTo({y:Math.max(0,y-24),animated:true}));
          }
        }} style={{
          alignSelf: m.senderId === actor.id ? 'flex-end' : 'flex-start',
          maxWidth: '92%',
          backgroundColor: m.senderId === actor.id ? '#dbeafe' : 'white',
          padding: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: m.id === targetMessageId ? '#f97316' : '#e2e8f0',
          ...(m.id === targetMessageId ? {borderWidth:2} : {})
        }}><Text style={{
            fontSize: 12,
            fontWeight: '700',
            color: '#475569',
            marginBottom: 5
          }}>{m.senderLabel}</Text>{config.role === 'ADMIN' && m.audience && m.audience !== 'ALL' && <Text style={{fontSize:11,color:'#64748b',marginBottom:4}}>{chatAudienceLabel(m.audience)}</Text>}
 {m.deletedAt ? <Text style={{
            fontStyle: 'italic',
            color: '#64748b'
          }}>Tin nhắn đã được GoViet247 xoá.</Text> : m.kind === 'TEXT' ? <Text selectable style={{
            color: ink,
            fontSize: 15,
            lineHeight: 22
          }}>{splitChatLinks(m.text || '').map((part, index) => part.url ? <Text key={index} accessibilityRole="link" style={{color: blue, textDecorationLine: 'underline'}} onPress={() => void run(() => Linking.openURL(part.url!))}>{part.text}</Text> : part.text)}</Text> : m.kind === 'IMAGE' ? <ChatImage tripId={tripId} messageId={m.id} onOpen={() => void run(() => viewImage(m.id))} /> : m.kind === 'AUDIO' ? <Pressable disabled={recording || busy} style={button} onPress={() => void listenTo(m.id, async () => {
            const d = await api(`/${tripId}/audio/${m.id}`);
            await play(d.url, m.id, d.mimeType);
          })}><Text style={{
              color: blue
            }}>{playbackLabel(m.id,false,m.durationMs || 0)}</Text></Pressable> : <Pressable onPress={() => void run(() => openMap(m.latitude!, m.longitude!))}><Text style={{
              color: blue,
              fontWeight: '700'
            }}>📍 {m.locationLabel || 'Vị trí được gửi'}</Text><Text style={{
              fontSize: 12,
              color: '#64748b'
            }}>Vị trí tại thời điểm gửi · Bấm mở bản đồ</Text></Pressable>}
 {actor.recordingAdmin === true && m.recordingCallId && !m.deletedAt && <Pressable style={button} disabled={recording || busy} accessibilityRole="button" onPress={() => void listenTo(m.id, async () => {
   const token=await config.getToken();
   const response=await fetch(`${config.base}/api/trip-calls/${encodeURIComponent(m.recordingCallId!)}/recording`,{headers:{Authorization:`Bearer ${token}`}});
   const data=await response.json();if(!response.ok)throw new Error(data.message || 'Chưa nghe được ghi âm.');
   await play(data.url,m.id,'audio/mp4');
 })}><Text style={{color:blue}}>{playbackLabel(m.id,true)}</Text></Pressable>}
 {!m.deletedAt && <Pressable accessibilityRole="button" accessibilityLabel={`${m.hearted ? 'Bỏ tim' : 'Thả tim'}, ${m.heartCount || 0} tim`} accessibilityState={{selected:Boolean(m.hearted),disabled:!canSend || busy}} disabled={!canSend || busy} style={{alignSelf:'flex-end',minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:22,backgroundColor:m.hearted ? '#fff1f2' : '#f8fafc',marginTop:6}} onPress={() => void run(async () => {
   const result = await api(`/${tripId}/messages/${m.id}/heart`, {method:'PUT',body:JSON.stringify({active:!m.hearted})});
   setItems(current => current.map(item => item.id === m.id ? {...item,hearted:result.hearted,heartCount:result.heartCount} : item));
   await load();
 })}><Text style={{fontSize:18,color:m.hearted ? '#e11d48' : '#64748b'}}>{m.hearted ? '♥' : '♡'}{m.heartCount ? ` ${m.heartCount}` : ''}</Text></Pressable>}
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
          }}>{new Date(m.createdAt).toLocaleString('vi-VN', { timeZone: "Asia/Ho_Chi_Minh", hour12: false, day: "2-digit", month: "2-digit", year: "numeric" })}</Text></View>)}
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
        }}><Pressable style={button} onPress={() => void run(() => play(draft.uri, 'draft'))}><Text>{playbackLabel('draft',false,draft.durationMs)}</Text></Pressable><Pressable style={button} disabled={busy} onPress={() => void run(sendAudio)}><Text>Gửi ghi âm</Text></Pressable><Pressable style={button} disabled={busy} onPress={() => {
            sound.current?.unloadAsync().catch(() => {});
            setDraft(null);
            setPlaying('');
          }}><Text>Xoá</Text></Pressable></View> : <>
 <View style={{flexDirection:'row',alignItems:'flex-end',gap:8,marginTop:6}}>
 <TextInput multiline maxLength={2000} value={text} onChangeText={setText} editable={!recording && !busy} placeholder="Nhắn tin cho chuyến…" placeholderTextColor="#64748b" style={{
            flex:1,
            minWidth:0,
            minHeight:44,
            borderWidth:1,
            borderColor:'#cbd5e1',
            borderRadius:12,
            padding:12,
            maxHeight:110,
            color:ink
          }} />
 <Pressable accessibilityRole="button" accessibilityLabel="Gửi tin nhắn" disabled={busy || recording || !text.trim()} onPress={() => void run(sendText)} style={{
   minWidth:52,minHeight:44,paddingHorizontal:12,borderRadius:12,alignItems:'center',justifyContent:'center',
   backgroundColor:blue,opacity:busy || recording || !text.trim() ? 0.4 : 1
 }}><Text style={{fontWeight:'800',color:'white'}}>Gửi</Text></Pressable>
 </View>
 <View style={{flexDirection:'row',gap:4,marginTop:6}}>
 <Pressable accessibilityRole="button" accessibilityLabel={recording?'Dừng ghi âm':'Ghi âm'} style={chatActionButton} disabled={busy} onPress={() => { Keyboard.dismiss(); void run(recording ? stopRecording : startRecording); }}><Text accessible={false} style={{fontSize:20}}>{recording?'⏹':'🎙'}</Text><Text style={chatActionLabel}>{recording ? `Dừng (${seconds}s)` : 'Ghi âm'}</Text></Pressable>
 <Pressable accessibilityRole="button" accessibilityLabel="Gửi định vị" style={chatActionButton} disabled={busy || recording} onPress={() => void run(currentLocation)}><Text accessible={false} style={{fontSize:20}}>📍</Text><Text style={chatActionLabel}>Gửi định vị</Text></Pressable>
 <Pressable accessibilityRole="button" accessibilityLabel="Chụp ảnh" style={chatActionButton} disabled={busy || recording} onPress={() => { Keyboard.dismiss(); void run(() => chooseImage(true)); }}><Text accessible={false} style={{fontSize:20}}>📷</Text><Text style={chatActionLabel}>Chụp ảnh</Text></Pressable>
 <Pressable accessibilityRole="button" accessibilityLabel="Chọn ảnh" style={chatActionButton} disabled={busy || recording} onPress={() => { Keyboard.dismiss(); void run(() => chooseImage(false)); }}><Text accessible={false} style={{fontSize:20}}>🖼</Text><Text style={chatActionLabel}>Chọn ảnh</Text></Pressable>
 </View></>}
 <Text style={{
          fontSize: 11,
          color: '#64748b'
        }}>Ghi âm tối đa 60 giây. Vui lòng dừng xe an toàn trước khi thao tác.</Text>
 </ScrollView>}
 </>}
 </KeyboardAvoidingView>
 <Modal visible={Boolean(tripView)} animationType="slide" onRequestClose={closeTripView}>
 <SafeAreaView style={{flex:1,backgroundColor:'#fff'}}><View style={{padding:16,gap:10}}><Text style={{fontSize:20,fontWeight:'800'}}>Chi tiết chuyến</Text><Pressable accessibilityRole="button" style={button} onPress={closeTripView}><Text style={{color:blue}}>← Quay lại tin nhắn</Text></Pressable></View>
 <ScrollView contentContainerStyle={{padding:16,gap:14}}><Text selectable style={{fontWeight:'800'}}>#{tripView?.id}</Text>
 {tripView?.loading ? <Text>Đang tải chuyến...</Text> : null}
 {tripView?.error ? <><Text accessibilityRole="alert" style={{color:'#b91c1c'}}>{tripView.error}</Text><Pressable style={button} onPress={()=>void showTrip(tripView.id)}><Text>Thử lại</Text></Pressable></> : null}
 {tripView?.trip ? chatTripDetailRows(tripView.trip).map(([label,value]:string[],index:number)=><View key={index} style={{gap:4}}><Text style={{color:'#64748b'}}>{label}</Text><Text selectable style={{color:ink,fontSize:16}}>{value}</Text></View>) : null}
 </ScrollView></SafeAreaView></Modal>
 <Modal visible={Boolean(imageView)} transparent animationType="fade" onRequestClose={() => setImageView(null)}>
 <SafeAreaView style={{flex:1,backgroundColor:'rgba(0,0,0,0.96)'}}><Pressable accessibilityLabel="Đóng ảnh" onPress={() => setImageView(null)} style={{padding:18,alignSelf:'flex-end'}}><Text style={{color:'white',fontSize:18}}>Đóng ✕</Text></Pressable>{imageView && <Image source={{uri:imageView.uri}} resizeMode="contain" style={{flex:1,width:'100%'}} onError={() => {setImageView(null);setError('Không tải được ảnh. Bấm vào ảnh để thử lại.');}} />}</SafeAreaView>
 </Modal>
 </SafeAreaView>;
}
