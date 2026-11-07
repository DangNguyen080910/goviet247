import {tripCallActionLabel} from '../../../api/src/shared/tripCallLabels.js';
import {useEffect,useRef,useState} from 'react';
import {Alert,Button,Dialog,DialogContent,DialogTitle,IconButton,Stack,Typography} from '@mui/material';
import TripChatHub from './TripChatHub';
import {partnerFetch,partnerTokenKey} from './partners/partnerSession';
import {WebCallClient,webCallIdentity} from './webCallClient';
const base=import.meta.env.VITE_API_BASE || 'http://localhost:5050';

const capable=()=>window.isSecureContext&&Boolean(navigator.mediaDevices?.getUserMedia)&&Boolean(window.RTCPeerConnection);
function CallButton({tripId,disabled,onCall,tokenKey,partner}) {
  const [eligibility,setEligibility]=useState(null);
  useEffect(()=>{
    let alive=true,busy=false;
    const check=async()=>{if(busy)return;busy=true;try{
      const res=await authenticatedFetch(partner,`${base}/api/trip-calls/trip/${encodeURIComponent(tripId)}`,{cache:'no-store',headers:{Authorization:`Bearer ${localStorage.getItem(tokenKey)}`}});
      const d=await res.json();if(alive)setEligibility(res.ok?d:null);
    }catch{if(alive)setEligibility(null);}finally{busy=false;}};
    void check();const timer=setInterval(check,10000);return()=>{alive=false;clearInterval(timer);};
  },[tripId,tokenKey,partner]);
  if(!eligibility || (!eligibility.canCall&&!eligibility.showUnavailable))return null;
  if(!capable()||!eligibility.canCall)return <Typography role="status" sx={{fontSize:11,color:"text.secondary",maxWidth:180}}>☎ {!capable()?"Trình duyệt này chưa hỗ trợ gọi. Vui lòng dùng ứng dụng.":eligibility.reason}</Typography>;
  return <IconButton aria-label={`${tripCallActionLabel(eligibility.label)} qua Internet`} title={tripCallActionLabel(eligibility.label)} disabled={disabled} onClick={()=>onCall(tripId)} sx={{minWidth:44,minHeight:48,color:'#087f80',display:'flex',flexDirection:'column',gap:0.25,borderRadius:2}}><span aria-hidden="true">☎</span><Typography component="span" sx={{fontSize:11,fontWeight:600}}>{tripCallActionLabel(eligibility.label)}</Typography></IconButton>;
}
function authenticatedFetch(partner,url,options){return partner?partnerFetch(base,url,options):fetch(url,options);}
export default function WebTripChat({partner=false,tokenRevision=''}){
  const tokenKey=partner?partnerTokenKey:'gv247_customer_token';
  useEffect(()=>{window.dispatchEvent(new Event('goviet:customer-session-changed'));},[tokenRevision]);
  const [view,setView]=useState({call:null,owned:false,message:''}),[busy,setBusy]=useState(false),[muted,setMuted]=useState(false),[ready,setReady]=useState(false),[now,setNow]=useState(Date.now()),[signed,setSigned]=useState(false);
  const controller=useRef(null),sdkSession=useRef(null),audioElement=useRef(null),ringContext=useRef(null),soundEnabled=useRef(false);
  const active=Boolean(view.call);
  useEffect(()=>{
    let alive=true,identity='',client=null,cleanupToken=''; const requests=new Set();
    const finishOwned=(c,t)=>{if(!c?.call||!c.owned||!t)return;void fetch(`${base}/api/trip-calls/${c.call.id}/end`,{method:'POST',keepalive:true,headers:{'Content-Type':'application/json',Authorization:`Bearer ${t}`},body:JSON.stringify({deviceId:c.deviceId})}).catch(()=>{});};
    async function sync(){
      const token=localStorage.getItem(tokenKey),next=webCallIdentity(token||'');
      if(identity===next){cleanupToken=token||'';return;}
      setSigned(Boolean(next));setView({call:null,owned:false,message:''});setMuted(false);window.dispatchEvent(new CustomEvent('goviet:call-active',{detail:false}));
      identity=next;const old=client;finishOwned(old,cleanupToken);cleanupToken=token||'';client=null;controller.current=null;
      for(const c of requests)c.abort();requests.clear();
      await old?.dispose();
      if(!alive||!next||identity!==next)return;
      // Pin authentication identity, while allowing refresh of this same member's JWT.
      const request=async(path,body)=>{
        if(webCallIdentity(localStorage.getItem(tokenKey)||'')!==next)throw Object.assign(new Error('Phiên đăng nhập đã thay đổi.'),{status:401});
        const abort=new AbortController();requests.add(abort);const timer=setTimeout(()=>abort.abort(),35000);
        try{
          const res=await authenticatedFetch(partner,`${base}/api/trip-calls${path}`,{method:body?'POST':'GET',cache:'no-store',signal:abort.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem(tokenKey)}`},...(body?{body:JSON.stringify(body)}:{})});
          const d=await res.json();if(!res.ok)throw Object.assign(new Error(d.message||'Chưa kết nối được cuộc gọi.'),{status:res.status});return d;
        }finally{clearTimeout(timer);requests.delete(abort);}
      };
      const media={
        prepare:async()=>{
          if(!capable())throw new Error('Gọi điện cần HTTPS và trình duyệt hỗ trợ micro.');
          const input=await navigator.mediaDevices.getUserMedia({audio:true,video:false});input.getTracks().forEach(t=>t.stop());
          await unlock();
          audioElement.current ||= new Audio();audioElement.current.autoplay=true;
          // Unlock playback during the user's gesture (Safari included).
          audioElement.current.play().catch(()=>{});
        },
        join:async(call,joined,failed,isCurrent)=>{
          const sdk=await import('amazon-chime-sdk-js');
          if(!isCurrent())return async()=>{};
          const logger=new sdk.NoOpLogger(),devices=new sdk.DefaultDeviceController(logger);
          const session=new sdk.DefaultMeetingSession(new sdk.MeetingSessionConfiguration(call.meeting,call.attendee),logger,devices);
          sdkSession.current=session;
          const stop=async()=>{if(sdkSession.current===session)sdkSession.current=null;session.audioVideo.stop();session.audioVideo.unbindAudioElement();await session.audioVideo.stopAudioInput().catch(()=>{});await session.destroy();};
          try{
            session.audioVideo.addObserver({audioVideoDidStart:joined,audioVideoDidStop:failed});
            await session.audioVideo.bindAudioElement(audioElement.current);
            await session.audioVideo.startAudioInput('default');
            if(!isCurrent()){await stop();return async()=>{};}
            session.audioVideo.start();return stop;
          }catch(e){await stop();throw e;}
        }
      };
      client=new WebCallClient({request,media,publish:state=>{if(alive&&identity===next){setView(state);window.dispatchEvent(new CustomEvent('goviet:call-active',{detail:Boolean(state.call)}));if(!state.call)setMuted(false);}}});
      controller.current=client;
    }
    void sync();const timer=setInterval(()=>{void sync();void client?.tick();},2000);
    const changed=()=>void sync();window.addEventListener('storage',changed);window.addEventListener('partner-session-changed',changed);window.addEventListener('goviet:customer-session-changed',changed);
    const unload=()=>{const call=client?.call;if(!call||!client.owned)return;void fetch(`${base}/api/trip-calls/${call.id}/end`,{method:'POST',keepalive:true,headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem(tokenKey)}`},body:JSON.stringify({deviceId:client.deviceId})}).catch(()=>{});};
    window.addEventListener('pagehide',unload);
    return()=>{alive=false;finishOwned(client,cleanupToken);clearInterval(timer);window.removeEventListener('storage',changed);window.removeEventListener('partner-session-changed',changed);window.removeEventListener('goviet:customer-session-changed',changed);window.removeEventListener('pagehide',unload);for(const c of requests)c.abort();void client?.dispose();window.dispatchEvent(new CustomEvent('goviet:call-active',{detail:false}));};
  },[tokenKey,partner]);
  async function unlock(){
    const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
    ringContext.current ||= new Context();await ringContext.current.resume();soundEnabled.current=ringContext.current.state==='running';setReady(soundEnabled.current);
  }
  useEffect(()=>()=>{void ringContext.current?.close();audioElement.current?.pause();},[]);
  const ringingId=view.call?.id,ringingStatus=view.call?.status,ringingTrip=view.call?.tripId;
  useEffect(()=>{
    if(!ringingId||view.owned||ringingStatus!=='RINGING')return;
    const tone=()=>{const ctx=ringContext.current;if(!soundEnabled.current||ctx?.state!=='running')return;
      const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=660;gain.gain.setValueAtTime(0.07,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.6);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+0.6);
    };tone();const timer=setInterval(tone,2200);let n;
    if(document.hidden&&'Notification'in window&&Notification.permission==='granted'){try{n=new Notification('GoViet247 · Tài xế đang gọi',{body:`Chuyến #${ringingTrip}`,tag:'goviet-trip-call'});n.onclick=()=>{window.focus();n.close();};}catch{/* Some browsers only support service-worker notifications. */}}
    return()=>{clearInterval(timer);n?.close();};
  },[ringingId,ringingStatus,ringingTrip,view.owned,ready]);
  useEffect(()=>{if(!active)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[active]);
  async function run(fn){setBusy(true);try{await fn();}catch(e){setView(v=>({...v,message:e.name==='NotAllowedError'?'Vui lòng cho phép micro để gọi điện.':e.message}));}finally{setBusy(false);}}
  const ring=view.call?.status==='RINGING'&&!view.owned;
  return <>
    <TripChatHub partnerTokenKey={partner?tokenKey:null} renderCallButton={tripId=><CallButton tokenKey={tokenKey} partner={partner} tripId={tripId} disabled={active||busy} onCall={id=>{if(window.confirm('Gọi tài xế?'))void run(()=>controller.current?.dial(id));}}/>}/>
    {signed&&!ready&&!active&&capable()&&<Button onClick={()=>void run(async()=>{await unlock();if('Notification'in window&&Notification.permission==='default')await Notification.requestPermission();})} sx={{position:'fixed',bottom:16,left:16,zIndex:1400,bgcolor:'white',borderRadius:3,boxShadow:2}}>☎ Bật chuông cuộc gọi</Button>}
    {view.message&&!active&&<Alert severity="info" onClose={()=>setView(v=>({...v,message:''}))} sx={{position:'fixed',bottom:70,left:16,zIndex:10060,maxWidth:'90vw'}}>{view.message}</Alert>}
    <Dialog open={active} fullWidth maxWidth="xs" sx={{zIndex:10100}}><DialogTitle>{ring?'Tài xế đang gọi':view.call?.status==='CONNECTED'?'Đang gọi tài xế':'Đang kết nối cuộc gọi'}</DialogTitle><DialogContent><Stack spacing={2} sx={{py:2}}>
      <Typography sx={{overflowWrap:'anywhere'}}>Chuyến #{view.call?.tripId}</Typography>
      <Typography>{view.call?.startedAt?`${Math.max(0,Math.floor((now-new Date(view.call.startedAt).getTime())/1000))} giây`:ring?'Cuộc gọi thoại qua Internet':view.call?.status==='RINGING'?'Đang đổ chuông…':'Đang kết nối…'}</Typography>
      {view.message&&<Alert severity="warning">{view.message}</Alert>}
      {ring?<Button variant="contained" disabled={busy} onClick={()=>void run(()=>controller.current?.answer())}>Nghe máy</Button>:<>
        <Button disabled={!sdkSession.current||busy} onClick={()=>{const av=sdkSession.current?.audioVideo;if(!av)return;if(muted)av.realtimeUnmuteLocalAudio();else av.realtimeMuteLocalAudio();setMuted(!muted);}}>{muted?'Bật micro':'Tắt micro'}</Button>
        <Button onClick={()=>void run(()=>audioElement.current?.play())}>Bật âm thanh nếu chưa nghe được</Button>
      </>}
      <Button color="error" variant="contained" onClick={()=>void run(()=>controller.current?.end())}>{ring?'Từ chối':'Kết thúc'}</Button>
      <Typography variant="caption">Giữ trang web mở để nhận cuộc gọi. Âm thanh phát qua thiết bị đầu ra đang chọn trên máy.</Typography>
    </Stack></DialogContent></Dialog>
  </>;
}
