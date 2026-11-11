import {splitChatLinks} from '../../../mobile-chat/chatLinks';
import {chatTripDetailRows,chatConversationRoute} from '../../../api/src/shared/chatTripDetail.js';
import {partnerFetch} from './partners/partnerSession';
import { newUnreadConversations, chatMessageAlertsAdmin } from '../../../api/src/shared/chatAlerts.js';
import { chatAudienceLabel } from '../../../api/src/shared/tripChatVisibility.js';
import useDraggableInbox from './useDraggableInbox';
import { createPortal } from 'react-dom';
import { useFloatingActions } from './FloatingActionsContext';
import {chatSupportUrl} from '../../../api/src/shared/chatSupport.js';
import { isRiderChatEnded, RIDER_CHAT_ENDED_NOTICE, DRIVER_CHAT_ENDED_NOTICE, COMPLETED_CHAT_NOTICE } from '../../../api/src/shared/tripChat.js';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Alert, Box, Button, Chip, Snackbar, Dialog, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from '@mui/material';
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
  return <Button variant="outlined" onClick={() => ended ? window.dispatchEvent(new CustomEvent('goviet:chat-support')) : openTripChat(tripId)} sx={{
    ...(ended ? {color: "#64748b", backgroundColor: "#f1f5f9", borderColor: "#cbd5e1"} : {}),
    textTransform: 'none',
    borderRadius: 2
  }}>💬 {ended?'Liên hệ hỗ trợ':label}</Button>;
}
const base = import.meta.env.VITE_API_BASE || 'http://localhost:5050';
const makeId = () => crypto.randomUUID();
const chatActionStyle={minWidth:0,minHeight:64,px:0.25,py:1,borderRadius:3,bgcolor:'#eff6ff',color:'#0f172a',display:'flex',flexDirection:'column',gap:0.5,textTransform:'none',whiteSpace:'normal'};
function ChatImage({tripId, messageId, loadImage, onOpen}) {
  const [url, setUrl] = useState(''), [failed, setFailed] = useState(false);
  const loader = useRef(loadImage); loader.current = loadImage;
  useEffect(() => {
    let alive = true;
    loader.current(`/${tripId}/image/${messageId}`).then(d => {if (alive) setUrl(d.url);}).catch(() => {if (alive) setFailed(true);});
    return () => {alive=false;};
  }, [tripId, messageId]);
  return <Button onClick={onOpen} sx={{display:'block',p:0,textTransform:'none',textAlign:'left'}}>
    {url && !failed ? <Box component="img" src={url} alt="Ảnh trong hội thoại chuyến" onError={() => setFailed(true)} sx={{display:'block',maxWidth:'100%',width:240,height:180,objectFit:'cover',borderRadius:2}} /> : <Typography sx={{p:2}}>{failed ? 'Ảnh chưa tải được · Bấm thử lại' : 'Đang tải ảnh…'}</Typography>}
    <Typography fontSize={12}>Bấm xem ảnh lớn</Typography>
  </Button>;
}
export default function TripChatHub({ partnerTokenKey = null, adminMode = false, renderCallButton = null }) {
  const [chatStatus,setChatStatus]=useState('');
  const [tripView,setTripView]=useState(null);
  const detailRequest=useRef(0);
  useEffect(()=>()=>{detailRequest.current++;},[]);
  function closeTripView(){detailRequest.current++;setTripView(null);}
  async function showTrip(id){
    const request=++detailRequest.current;setTripView({id,loading:true});
    try{const data=await api(`/${encodeURIComponent(id)}/trip`);if(detailRequest.current===request)setTripView({id,loading:false,trip:data.trip});}
    catch(error){if(detailRequest.current===request)setTripView({id,loading:false,error:error.message});}
  }
  const {dockTarget, dockDragRef} = useFloatingActions();
  const route = useLocation(),
    isAdmin = adminMode || route.pathname.startsWith('/admin'),
    tokenKey = partnerTokenKey || (isAdmin ? 'admin_token' : 'gv247_customer_token');
  const draggableInbox = isAdmin || Boolean(partnerTokenKey);
  const inboxDrag = useDraggableInbox(draggableInbox, partnerTokenKey ? 'goviet247-partner-inbox-position' : undefined);
  useEffect(()=>{const support=()=>{const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;void chatSupportUrl(base).then(url=>{if(tab)tab.location.href=url;else window.location.href=url;}).catch(error=>{tab?.close();window.alert(error.message);});};window.addEventListener('goviet:chat-support',support);return()=>window.removeEventListener('goviet:chat-support',support);},[]);
  const [soundReady,setSoundReady]=useState(false),[incoming,setIncoming]=useState(null);
  const [notificationPermission,setNotificationPermission]=useState(()=>('Notification' in window ? Notification.permission : 'unsupported'));
  const previousInbox=useRef(new Map()),toneContext=useRef(null);
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
    [signed, setSigned] = useState(false);
  const [imageDraft, setImageDraft] = useState(null), [imageView, setImageView] = useState(null), [cameraOpen, setCameraOpen] = useState(false);
  const [playback,setPlayback]=useState({id:null,state:'idle',position:0,duration:0});
  const historyFrom = useRef(null);
  const imageInput = useRef(null), cameraInput = useRef(null), cameraVideo = useRef(null), cameraStream = useRef(null);
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
    playingMessage = useRef(null),
    soundTimer = useRef(0),
    activeRequest = useRef(0);
  const callActive=useRef(false);
  useEffect(()=>{const changed=e=>{callActive.current=Boolean(e.detail);if(e.detail){abort.current=true;if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());setRecording(false);audio.current?.pause();setDraft(current=>{if(current)URL.revokeObjectURL(current.url);return null;});}};window.addEventListener('goviet:call-active',changed);return()=>window.removeEventListener('goviet:call-active',changed);},[]);
  async function api(path, options = {}) {
    const token = localStorage.getItem(tokenKey);
    if (!token) throw new Error('Vui lòng đăng nhập.');
    const request=partnerTokenKey ? (url,options)=>partnerFetch(base,url,options) : fetch;
    const res = await request(`${base}/api/trip-chat${path}${path.includes('?') ? '&' : '?'}media=images`, {
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
      if (['RIDER_CHAT_ENDED','DRIVER_CHAT_ENDED'].includes(d.code)) {
        activeRequest.current++; audio.current?.pause(); setImageView(null); setImageDraft(null); setItems([]); setCanSend(false);setChatStatus(''); setOpen(false);
        window.alert(d.code==='DRIVER_CHAT_ENDED'?DRIVER_CHAT_ENDED_NOTICE:RIDER_CHAT_ENDED_NOTICE);
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
  async function unlockSound() {
    try {
      const Context=window.AudioContext || window.webkitAudioContext;
      if(!Context) return;
      const ctx=toneContext.current || (toneContext.current=new Context());
      if(ctx.state!=='running') await ctx.resume();
      setSoundReady(ctx.state==='running');
    } catch { setSoundReady(false); }
  }
  async function enableAlerts() {
    await unlockSound();
    if('Notification' in window) {
      try {setNotificationPermission(await Notification.requestPermission());} catch {setNotificationPermission('denied');}
    }
    quietTone();
  }
  function quietTone() {
    if(callActive.current)return;
    const ctx=toneContext.current;
    if(!ctx || ctx.state!=='running') {setSoundReady(false);return;}
    if(Date.now()-soundTimer.current<2000) return;
    soundTimer.current=Date.now();
    try {
      const osc=ctx.createOscillator(),gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.12,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.5);
      osc.frequency.setValueAtTime(740,ctx.currentTime);osc.frequency.setValueAtTime(988,ctx.currentTime+0.16);
      osc.start();osc.stop(ctx.currentTime+0.5);
    } catch {}
  }
  useEffect(()=>{
    const unlock=()=>{void unlockSound();};
    window.addEventListener('pointerdown',unlock);window.addEventListener('keydown',unlock);
    return()=>{window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);const ctx=toneContext.current;toneContext.current=null;void ctx?.close();};
  },[]);
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
    historyFrom.current = null;
    setItems([]);
    setInbox([]);
    lastUnread.current = -1;
    previousInbox.current=new Map();
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
        const fresh=newUnreadConversations(previousInbox.current,d.items,d.actorId);
        previousInbox.current=new Map(d.items.map(c=>[c.tripId,c.last.id]));
        if(fresh.length) {
          quietTone();const latest=fresh[0];
          setIncoming({tripId:latest.tripId,label:`Có tin nhắn mới · #${latest.tripId}`});
          if(document.hidden && 'Notification' in window && Notification.permission==='granted') {
            try {const notice=new Notification('GoViet247 · Tin nhắn chuyến',{body:'Có tin nhắn mới. Bấm để mở hội thoại.',tag:'trip-chat'});
              notice.onclick=()=>{window.focus();openTripChat(latest.tripId);notice.close();};} catch {}
          }
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
    if (historyFrom.current && (!d.visibleFrom || d.visibleFrom < historyFrom.current)) return;
    if (historyFrom.current !== d.visibleFrom || d.historyReset) {
      historyFrom.current = d.visibleFrom || null; loadedOlder.current = false;
      audio.current?.pause(); setImageView(null); setMore(d.hasMore);
    }
    const deleted=new Map((d.deletedMessages || []).map(m=>[m.id,m.deletedAt]));
    if(deleted.has(playingMessage.current))audio.current?.pause();
    setImageView(current=>current && deleted.has(current.id)?null:current);
    setItems(current => {
      const map = new Map((loadedOlder.current ? current.filter(m => !d.visibleFrom || m.createdAt >= d.visibleFrom) : []).map(m => [m.id, m]));
      d.items.forEach(m => map.set(m.id, m));
      for(const [id,deletedAt] of deleted){const old=map.get(id);if(old)map.set(id,{...old,deletedAt,text:null,imageKey:null,audioKey:null,heartCount:0,hearted:false});}
      return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    });
    setImageView(current => current && d.items.some(m => m.id === current.id && m.deletedAt) ? null : current);
    setActor(d.actor);
    setCanSend(d.canSend);setChatStatus(d.status || '');
    setReplies(d.quickReplies || []);
    if (!loadedOlder.current) setMore(d.hasMore);
    const latest = d.items.at(-1);
    if (latest && document.visibilityState === 'visible') {
      await post(`/${tripId}/read`, {
        messageId: latest.id
      });
    }
    if (latest && previousLast.current !== latest.id) {
      if (previousLast.current && latest.senderId !== d.actor.id && (d.actor.role !== 'ADMIN' || chatMessageAlertsAdmin(latest))) quietTone();
      previousLast.current = latest.id;
      if (!loadedOlder.current) setTimeout(() => end.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      }), 100);
    }
  }
  useEffect(() => {
    activeRequest.current++;
    historyFrom.current = null;
    setItems([]);
    setImageDraft(null);
    setImageView(null);
    stopCamera();
    setCanSend(false);setChatStatus('');
    setError('');
    setText('');
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
    cameraStream.current?.getTracks().forEach(t => t.stop());
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
    stopCamera();
    setImageView(null);
    if (recorder.current?.state === 'recording') recorder.current.stop();
    audio.current?.pause();
    setOpen(false);
  }
  async function record() {
    if(callActive.current)throw new Error('Vui lòng kết thúc cuộc gọi trước khi ghi âm tin nhắn.');
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Trình duyệt chưa hỗ trợ ghi âm. Vui lòng dùng app hoặc trình duyệt mới.');
    const input = await navigator.mediaDevices.getUserMedia({
      audio: true
    });
    if(callActive.current){input.getTracks().forEach(t=>t.stop());return;}
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
    if(callActive.current)throw new Error('Vui lòng kết thúc cuộc gọi trước khi nghe ghi âm.');
    const current=audio.current;
    if(playingMessage.current===m.id && current && !current.ended && !current.error){
      if(current.paused)await current.play();else current.pause();return;
    }
    audio.current?.pause();
    setPlayback({id:m.id,state:'loading',position:0,duration:0});
    try {
      let d;
      if(m.recordingCallId){
        const response=await fetch(`${base}/api/trip-calls/${encodeURIComponent(m.recordingCallId)}/recording`,{headers:{Authorization:`Bearer ${localStorage.getItem(tokenKey)}`}});
        d=await response.json();if(!response.ok)throw new Error(d.message || 'Chưa nghe được ghi âm.');
      }else d=await api(`/${tripId}/audio/${m.id}`);
      if(callActive.current){setPlayback({id:m.id,state:'idle',position:0,duration:0});return;}
      const a=new Audio(d.url);audio.current=a;playingMessage.current=m.id;
      const update=state=>{if(audio.current===a)setPlayback({id:m.id,state,position:a.currentTime*1000,duration:Number.isFinite(a.duration)?a.duration*1000:0});};
      a.onplaying=()=>update('playing');a.onpause=()=>update(a.ended?'ended':'paused');
      a.onwaiting=()=>update('loading');a.ontimeupdate=()=>update(a.ended?'ended':a.paused?'paused':'playing');
      a.onended=()=>update('ended');a.onerror=()=>{update('error');setError('Không phát được ghi âm. Vui lòng thử lại.');};
      await a.play();
    }catch(e){setPlayback({id:m.id,state:'error',position:0,duration:0});throw e;}
  }
  function playbackLabel(m){
    const p=playback.id===m.id?playback:null;
    const time=ms=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
    if(p?.state==='loading')return '⏳ Đang tải ghi âm…';
    if(p?.state==='error')return '↻ Lỗi phát · Thử lại';
    if(p?.state==='ended')return '↻ Đã nghe xong · Nghe lại';
    if(p && ['playing','paused'].includes(p.state))return `${p.state==='playing'?'⏸ Đang phát · Tạm dừng':'▶ Đã tạm dừng · Nghe tiếp'} · ${time(p.position)} / ${time(p.duration || m.durationMs || 0)}`;
    return m.recordingCallId?'▶ Nghe ghi âm cuộc gọi':`▶ Nghe ghi âm · ${time(m.durationMs || 0)}`;
  }
  async function prepareImage(file, generation = activeRequest.current) {
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Chọn ảnh JPEG, PNG hoặc WebP.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Ảnh tối đa 10 MB. Vui lòng chọn ảnh nhỏ hơn.');
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      if (img.naturalWidth * img.naturalHeight > 40000000) throw new Error('Ảnh quá lớn. Vui lòng chọn ảnh dưới 40 megapixel.');
      const scale = Math.min(1,1920/Math.max(img.naturalWidth,img.naturalHeight));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(img.naturalWidth*scale)); canvas.height = Math.max(1,Math.round(img.naturalHeight*scale));
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',0.82));
      if (!blob) throw new Error('Không xử lý được ảnh. Vui lòng chọn ảnh khác.');
      if (generation !== activeRequest.current) return;
      setImageDraft({blob,clientId:makeId()});
    } finally {URL.revokeObjectURL(url);}
  }
  async function sendImage() {
    if (!imageDraft) return;
    const generation = activeRequest.current;
    const form = new FormData();form.append('image',imageDraft.blob,'photo.jpg');form.append('clientId',imageDraft.clientId);
    await api(`/${tripId}/image`,{method:'POST',body:form});
    if (generation !== activeRequest.current) return;
    setImageDraft(null); await load();
  }
  async function viewImage(id) {
    const generation = activeRequest.current;
    const d = await api(`/${tripId}/image/${id}`);
    if (generation === activeRequest.current) setImageView({id,url:d.url});
  }
  function stopCamera() {cameraStream.current?.getTracks().forEach(t => t.stop());cameraStream.current=null;setCameraOpen(false);}
  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Không mở được camera. Bạn có thể chọn ảnh có sẵn.');
    const generation = activeRequest.current;
    const input = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    if (generation !== activeRequest.current) {input.getTracks().forEach(t => t.stop());return;}
    cameraStream.current=input;setCameraOpen(true);
  }
  async function captureImage() {
    const video=cameraVideo.current, generation=activeRequest.current;
    if (!video?.videoWidth) throw new Error('Camera chưa sẵn sàng. Vui lòng thử lại.');
    const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);
    const blob=await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',0.82));
    stopCamera();if (blob) await prepareImage(new File([blob],'photo.jpg',{type:'image/jpeg'}),generation);
  }
  useEffect(() => {if (!imageDraft) return;const url=URL.createObjectURL(imageDraft.blob);setImageDraft(current => current?.blob === imageDraft.blob ? {...current,url} : current);return () => URL.revokeObjectURL(url);},[imageDraft?.blob]);
  async function currentLocation() {
    const generation=activeRequest.current;
    let position;
    try {position=await new Promise((resolve,reject)=>navigator.geolocation ? navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}) : reject(new Error('Trình duyệt không hỗ trợ định vị.')));}
    catch(error){throw new Error(error.code===1?'Vui lòng cho phép vị trí trong trình duyệt để gửi định vị hiện tại.':error.message || 'Không lấy được định vị hiện tại. Vui lòng thử lại.');}
    if(generation!==activeRequest.current)return;
    await post(`/${tripId}/messages`,{kind:'LOCATION',latitude:position.coords.latitude,longitude:position.coords.longitude,locationLabel:'Định vị hiện tại',clientId:makeId()});
    await load();
  }
  const mapUrl = m => `https://www.google.com/maps/search/?api=1&query=${m.latitude},${m.longitude}`;
  const docked = !isAdmin && Boolean(dockTarget);
  const launcher = signed && !open ? <Button variant="contained"
    ref={!docked && draggableInbox ? inboxDrag.ref : undefined}
    onPointerDown={event => (docked ? dockDragRef.current : draggableInbox ? inboxDrag : null)?.startDrag(event)}
    onPointerMove={event => (docked ? dockDragRef.current : draggableInbox ? inboxDrag : null)?.moveDrag(event)}
    onPointerUp={event => (docked ? dockDragRef.current : draggableInbox ? inboxDrag : null)?.finish(event)}
    onPointerCancel={event => (docked ? dockDragRef.current : draggableInbox ? inboxDrag : null)?.finish(event)}
    onLostPointerCapture={event => (docked ? dockDragRef.current : draggableInbox ? inboxDrag : null)?.finish(event)}
    aria-label={`Tin nhắn chuyến${unread ? ` (${unread} chưa đọc)` : ''}, có thể kéo để di chuyển`}
    onClick={event => {
      if ((docked ? dockDragRef.current : draggableInbox ? inboxDrag : null)?.consumeClick(event)) return;
      setTripId('');
      setOpen(true);
    }} sx={{
      ...(docked ? {} : draggableInbox ? inboxDrag.style : {position:'fixed',bottom:100,right:20,zIndex:1400}),
      minHeight:44,
      touchAction: docked || draggableInbox ? 'none' : 'auto',
      userSelect:'none',
      cursor:docked || draggableInbox ? 'grab' : 'pointer',
      whiteSpace:'nowrap',
      borderRadius: 6,
      textTransform: 'none'
    }}>💬 Tin nhắn {unread ? `(${unread})` : ''}</Button> : null;
  return <>{!isAdmin && dockTarget ? createPortal(launcher, dockTarget) : launcher}
 <Snackbar open={signed && (Boolean(incoming) || !soundReady || notificationPermission==='default')} autoHideDuration={incoming?6000:null} onClose={()=>setIncoming(null)} anchorOrigin={{vertical:'bottom',horizontal:'center'}} message={incoming?.label || 'Bật chuông và thông báo để không bỏ lỡ tin nhắn'} action={incoming ? <Button color="inherit" onClick={()=>{openTripChat(incoming.tripId);setIncoming(null);}}>Xem tin</Button> : <Button color="inherit" onClick={enableAlerts}>Bật chuông / thông báo</Button>} />
 <Dialog open={open} onClose={close} fullWidth maxWidth="sm" sx={{zIndex:10020}}><DialogTitle sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}>{tripId ? <Button onClick={() => setTripId('')}>←</Button> : null}<Typography component="span" sx={{
          fontWeight: 800,
          flex: 1, minWidth:0, overflowWrap:'anywhere'
        }}>{tripId ? 'Liên hệ chuyến' : 'Tin nhắn chuyến'}</Typography>{tripId && renderCallButton?.(tripId)}<IconButton aria-label="Đóng hội thoại" onClick={close}>×</IconButton></DialogTitle>
 <DialogContent dividers sx={{
        p: 0
      }}>{error && <Alert severity="error">{error}</Alert>}
 {!tripId ? <Stack spacing={1} sx={{
          p: 2
        }}>{!inbox.length && <Typography>Chưa có tin nhắn. Mở một chuyến để liên hệ.</Typography>}{inbox.map(c => <Box key={c.tripId}  sx={{
            textAlign: 'left',
            justifyContent: 'flex-start',
            textTransform: 'none'
          }}><Button onClick={()=>setTripId(c.tripId)} sx={{textAlign:'left',textTransform:'none',width:'100%',justifyContent:'flex-start'}}><Box sx={{minWidth:0,overflowWrap:'anywhere'}}><Typography fontWeight={800}>#{c.tripId} {c.unread ? `· ${c.unread} chưa đọc` : ''}</Typography>{chatConversationRoute(c)&&<Typography sx={{color:'text.secondary',my:0.5}}>{chatConversationRoute(c)}</Typography>}<Typography>{c.last.senderLabel} · {c.last.deletedAt ? 'Tin nhắn đã xoá' : c.last.kind === 'AUDIO' ? 'Tin nhắn thoại' : c.last.kind === 'IMAGE' ? 'Hình ảnh' : c.last.kind === 'LOCATION' ? 'Vị trí' : c.last.text}</Typography></Box></Button><Button onClick={()=>setTripId(c.tripId)}>Xem tin nhắn</Button></Box>)}</Stack> : <>
 <Box sx={{display:'flex',alignItems:'center',gap:1,px:2,py:1}}><Typography title={`Mã chuyến ${tripId}`} sx={{flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:800}}>#{tripId}</Typography><Button onClick={()=>void showTrip(tripId)} sx={{flexShrink:0,minHeight:44}}>Xem chuyến</Button></Box>
 <Stack spacing={1.5} sx={{
            height: 'min(48vh,440px)',
            overflowY: 'auto',
            p: 2,
            bgcolor: '#f8fafc'
          }}>{chatStatus==='COMPLETED' && <Typography sx={{fontSize:13,color:'#64748b'}}>{COMPLETED_CHAT_NOTICE}</Typography>}{more && <Button disabled={busy} onClick={() => run(async () => {
              const d = await api(`/${tripId}/messages?before=${items[0]?.id}`);
              if (d.visibleFrom !== historyFrom.current || d.historyReset) { await load(); return; }
              loadedOlder.current = true;
              setMore(d.hasMore);
              setItems(current => [...d.items, ...current.filter(m => !d.items.some(x => x.id === m.id))]);
            })}>Tải tin cũ hơn</Button>}
 {items.map(m => <Box key={m.id} sx={{
              alignSelf: m.senderId === actor.id ? 'flex-end' : 'flex-start',
              maxWidth: '90%',
              p: 1.5,
              borderRadius: 3,
              bgcolor: m.senderRole === 'SYSTEM' ? '#eef2ff' : m.senderId === actor.id ? '#dbeafe' : 'white',
              border: '1px solid #e2e8f0'
            }}><Typography sx={{
                fontSize: 12,
                color: '#475569',
                fontWeight: 700,
                mb: 0.5
              }}>{m.senderLabel}</Typography>{actor.role === 'ADMIN' && m.audience && m.audience !== 'ALL' && <Typography sx={{fontSize:11,color:'#64748b',mb:0.5}}>{chatAudienceLabel(m.audience)}</Typography>}{m.deletedAt ? <Typography sx={{
                fontStyle: 'italic',
                color: '#64748b'
              }}>Tin nhắn đã được GoViet247 xoá.</Typography> : m.kind === 'TEXT' ? <Typography sx={{
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere'
              }}>{splitChatLinks(m.text || '').map((part,index)=>part.url?<a key={index} href={part.url} target="_blank" rel="noopener noreferrer" style={{color:'#1976d2',textDecoration:'underline',overflowWrap:'anywhere'}}>{part.text}</a>:part.text)}</Typography> : m.kind === 'IMAGE' ? <ChatImage tripId={tripId} messageId={m.id} loadImage={api} onOpen={() => run(() => viewImage(m.id))} /> : m.kind === 'AUDIO' ? <Stack direction="row"><Button disabled={recording || busy} onClick={() => run(() => listen(m))}>{playbackLabel(m)}</Button></Stack> : <Button component="a" href={mapUrl(m)} target="_blank" rel="noopener noreferrer" sx={{
                textAlign: 'left',
                textTransform: 'none'
              }}>📍 {m.locationLabel}<br />Vị trí tại thời điểm gửi · Mở bản đồ</Button>}{actor.recordingAdmin === true && m.recordingCallId && !m.deletedAt && <Button disabled={recording || busy} onClick={() => run(() => listen(m))}>{playbackLabel(m)}</Button>}{!m.deletedAt && <Button aria-label={`${m.hearted ? 'Bỏ tim' : 'Thả tim'}, ${m.heartCount || 0} tim`} aria-pressed={Boolean(m.hearted)} disabled={!canSend || busy} sx={{display:'flex',ml:'auto',minWidth:44,minHeight:44,borderRadius:6,color:m.hearted ? '#e11d48' : '#64748b',bgcolor:m.hearted ? '#fff1f2' : '#f8fafc',fontSize:18}} onClick={() => run(async () => {
                const result = await api(`/${tripId}/messages/${m.id}/heart`,{method:'PUT',body:JSON.stringify({active:!m.hearted})});
                setItems(current => current.map(item => item.id === m.id ? {...item,hearted:result.hearted,heartCount:result.heartCount} : item));
                await load();
              })}>{m.hearted ? '♥' : '♡'}{m.heartCount ? ` ${m.heartCount}` : ''}</Button>}{actor.role === 'ADMIN' && !m.deletedAt && <Button size="small" color="error" disabled={busy} onClick={() => {
                if (window.confirm('Xoá nội dung tin nhắn khỏi hội thoại? Thao tác sẽ được lưu nhật ký.')) void run(async () => {
                  audio.current?.pause();
                  setImageView(null);
                  await api(`/${tripId}/messages/${m.id}`, {
                    method: 'DELETE'
                  });
                  await load();
                });
              }}>Xoá tin</Button>}<Typography sx={{
                fontSize: 11,
                color: '#64748b',
                mt: 0.5
              }}>{new Date(m.createdAt).toLocaleString('vi-VN', { timeZone: "Asia/Ho_Chi_Minh", hour12: false, day: "2-digit", month: "2-digit", year: "numeric" })}</Typography></Box>)}<div ref={end} /></Stack>
 {!canSend ? <Alert severity="info">Hội thoại hiện chỉ đọc. Chuyến đã kết thúc hoặc tài khoản chưa có quyền gửi tin. Nhờ GoViet247 hỗ trợ nếu cần.</Alert> : <Stack spacing={1} sx={{
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
 <input hidden type="file" accept="image/jpeg,image/png,image/webp" ref={imageInput} onChange={e => {const file=e.target.files?.[0];e.target.value='';if (file) void run(() => prepareImage(file));}} />
 <input hidden type="file" accept="image/*" capture="environment" ref={cameraInput} onChange={e => {const file=e.target.files?.[0];e.target.value='';if (file) void run(() => prepareImage(file));}} />
 {imageDraft ? <><Typography fontWeight={700}>Xem trước ảnh</Typography><Box component="img" src={imageDraft.url} alt="Ảnh sắp gửi" sx={{width:'100%',maxHeight:220,objectFit:'contain'}} /><Stack direction="row"><Button disabled={busy} variant="contained" onClick={() => run(sendImage)}>{busy ? 'Đang gửi…' : 'Gửi ảnh'}</Button><Button disabled={busy} onClick={() => setImageDraft(null)}>Bỏ ảnh</Button></Stack></> : draft ? <><audio controls src={draft.url} /><Stack direction="row"><Button disabled={busy} onClick={() => run(sendAudio)}>Gửi ghi âm</Button><Button disabled={busy} onClick={() => {
                  URL.revokeObjectURL(draft.url);
                  setDraft(null);
                }}>Xoá ghi âm</Button></Stack></> : <><Stack direction="row" alignItems="flex-end" gap={1}><TextField sx={{flex:1,minWidth:0}} multiline maxRows={4} placeholder="Nhắn tin cho chuyến…" value={text} onChange={e => setText(e.target.value)} slotProps={{
                htmlInput: {
                  maxLength: 2000
                }
              }} disabled={busy || recording} /><Button aria-label="Gửi tin nhắn" sx={{minWidth:52,minHeight:44,flexShrink:0}} variant="contained" disabled={busy || recording || !text.trim()} onClick={() => run(sendText)}>Gửi</Button></Stack><Box sx={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:0.5}}>
 <Button aria-label={recording?'Dừng ghi âm':'Ghi âm'} sx={chatActionStyle} disabled={busy} onClick={() => recording ? recorder.current?.stop() : run(record)}><Box component="span" aria-hidden="true" sx={{fontSize:20}}>{recording?'⏹':'🎙'}</Box><Typography component="span" sx={{fontSize:12}}>{recording ? `Dừng (${seconds}s)` : 'Ghi âm'}</Typography></Button>
 <Button aria-label="Gửi định vị" sx={chatActionStyle} disabled={busy || recording} onClick={() => run(currentLocation)}><Box component="span" aria-hidden="true" sx={{fontSize:20}}>📍</Box><Typography component="span" sx={{fontSize:12}}>Gửi định vị</Typography></Button>
 <Button aria-label="Chụp ảnh" sx={chatActionStyle} disabled={busy || recording} onClick={() => /Android|iPhone|iPad/i.test(navigator.userAgent) ? cameraInput.current?.click() : run(startCamera)}><Box component="span" aria-hidden="true" sx={{fontSize:20}}>📷</Box><Typography component="span" sx={{fontSize:12}}>Chụp ảnh</Typography></Button>
 <Button aria-label="Chọn ảnh" sx={chatActionStyle} disabled={busy || recording} onClick={() => imageInput.current?.click()}><Box component="span" aria-hidden="true" sx={{fontSize:20}}>🖼</Box><Typography component="span" sx={{fontSize:12}}>Chọn ảnh</Typography></Button>
 </Box></>}
 <Typography sx={{
              fontSize: 11,
              color: '#64748b'
            }}>Ghi âm tối đa 60 giây. GoViet247 có thể xem hội thoại để hỗ trợ và giải quyết tranh chấp.</Typography>
 {'Notification' in window && Notification.permission === 'default' && <Button onClick={enableAlerts}>Cho phép thông báo trên trình duyệt</Button>}
 </Stack>}
 </>}
 </DialogContent></Dialog>
 <Dialog open={cameraOpen} onClose={stopCamera} fullWidth maxWidth="sm" sx={{zIndex:10040}}><DialogTitle>Chụp ảnh gửi trong chuyến</DialogTitle><DialogContent><Box component="video" ref={video => {cameraVideo.current=video;if(video && cameraStream.current){video.srcObject=cameraStream.current;video.play().catch(() => {});}}} autoPlay muted playsInline sx={{width:'100%',borderRadius:2}} /><Stack direction="row"><Button disabled={busy} onClick={() => run(captureImage)}>Chụp ảnh</Button><Button onClick={stopCamera}>Đóng camera</Button></Stack></DialogContent></Dialog>
 <Dialog open={Boolean(tripView)} onClose={closeTripView} fullWidth maxWidth="sm" sx={{zIndex:10040}}><DialogTitle>Chi tiết chuyến<Button onClick={closeTripView} sx={{float:'right'}}>Quay lại tin nhắn</Button></DialogTitle><DialogContent dividers><Stack spacing={2}>
 <Typography sx={{overflowWrap:'anywhere',fontWeight:800}}>#{tripView?.id}</Typography>
 {tripView?.loading&&<Typography>Đang tải chuyến...</Typography>}
 {tripView?.error&&<Alert severity="error" action={<Button onClick={()=>void showTrip(tripView.id)}>Thử lại</Button>}>{tripView.error}</Alert>}
 {tripView?.trip&&chatTripDetailRows(tripView.trip).map(([label,value],index)=><Box key={index}><Typography color="text.secondary">{label}</Typography><Typography sx={{overflowWrap:'anywhere'}}>{value}</Typography></Box>)}
 </Stack></DialogContent></Dialog>
 <Dialog open={Boolean(imageView)} onClose={() => setImageView(null)} fullWidth maxWidth="lg" sx={{zIndex:10050}}><DialogTitle sx={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>Ảnh trong hội thoại<IconButton aria-label="Đóng ảnh" onClick={() => setImageView(null)}>×</IconButton></DialogTitle><DialogContent>{imageView && <Box component="img" src={imageView.url} alt="Ảnh trong chuyến" onError={() => {setImageView(null);setError('Không tải được ảnh. Bấm vào ảnh để thử lại.');}} sx={{display:'block',width:'100%',maxHeight:'75vh',objectFit:'contain'}} />}</DialogContent></Dialog></>;
}
