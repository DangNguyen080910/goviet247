// One device identity per mounted browser tab. Never store join credentials on disk.
export const liveCall = call => ['RINGING', 'CONNECTING', 'CONNECTED'].includes(call?.status);
export function webCallIdentity(token) {
  try { const p=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); const id=p.sub||p.id||p.userId;return id?`${id}:${p.version??p.sid??p.sessionId??''}`:''; } catch { return ''; }
}
export class WebCallClient {
  constructor({request, media, publish, deviceId=crypto.randomUUID()}) {
    Object.assign(this,{request,media,publish,deviceId});
    this.lastSuccess=Date.now(); this.call=null; this.owned=false; this.joined=false; this.epoch=0; this.operation=false; this.polling=false; this.closed=false;
  }
  show(call, message='') { this.call=call; this.publish({call,owned:this.owned,message}); }
  async release() { const stop=this.stopMedia; this.stopMedia=null; this.joined=false; if(stop)await stop(); }
  async clear(message='') { this.epoch++; this.owned=false; this.show(null,message); await this.release(); }
  async prepare() {
    await this.media.prepare();
  }
  async dial(tripId) {
    if(this.operation||this.call||this.closed)return;
    this.operation=true; const epoch=++this.epoch;
    try {
      await this.prepare();
      if(epoch!==this.epoch||this.closed)return;
      const d=await this.request(`/trip/${encodeURIComponent(tripId)}`,{deviceId:this.deviceId,clientId:crypto.randomUUID(),consent:true});
      if(epoch!==this.epoch||this.closed){await this.request(`/${d.call.id}/end`,{deviceId:this.deviceId}).catch(()=>{});return;}
      this.owned=true; this.show({...d.call,side:'caller'});
    } finally {this.operation=false;}
  }
  async answer() {
    const call=this.call;
    if(this.operation||!call||this.owned||this.closed)return;
    this.operation=true; const epoch=++this.epoch;
    try {
      await this.prepare();
      if(epoch!==this.epoch||this.closed)return;
      // Mark this tab as claiming before AWS allocation completes; polls must not replace it.
      this.owned=true;this.show({...call,status:'CONNECTING'});
      await this.request(`/${call.id}/accept`,{deviceId:this.deviceId,consent:true});
      if(epoch!==this.epoch||this.closed){await this.request(`/${call.id}/end`,{deviceId:this.deviceId}).catch(()=>{});return;}
    } catch(e) {if(epoch===this.epoch)await this.clear(e.message);throw e;}
    finally {this.operation=false;}
  }
  async end() {
    const call=this.call;if(!call)return;
    await this.clear(); // Stop microphone immediately, even if the network is unavailable.
    await this.request(`/${call.id}/end`,{deviceId:this.deviceId});
  }
  async tick() {
    if(this.closed)return;
    if(this.call?.status==='RINGING'&&Date.now()-new Date(this.call.createdAt).getTime()>45000){await this.clear('Cuộc gọi đã hết thời gian chờ.');return;}
    if(this.polling||this.operation)return;
    this.polling=true;const epoch=this.epoch;
    try {
      if(this.call&&this.owned){
        const d=await this.request(`/${this.call.id}/session?deviceId=${this.deviceId}`);
        if(epoch!==this.epoch||this.closed)return;
        if(!liveCall(d.call)){await this.clear('Cuộc gọi đã kết thúc.');return;}
        this.show({...d.call,side:this.call.side});
        if(d.call.meeting&&d.call.attendee&&!this.stopMedia){
          const id=d.call.id;
          let stop;
          try {stop=await this.media.join(d.call,()=>{if(epoch===this.epoch&&this.call?.id===id)this.joined=true;},()=>{
            if(epoch===this.epoch&&this.call?.id===id)void this.end().catch(()=>{});
          },()=>epoch===this.epoch&&!this.closed);}
          catch(e){await this.end().catch(()=>{});throw e;}
          if(epoch!==this.epoch||this.closed){await stop();return;}
          this.stopMedia=stop;
        }
        await this.request(`/${d.call.id}/heartbeat`,{deviceId:this.deviceId,joined:this.joined});
      } else {
        const d=await this.request(`/incoming?deviceId=${this.deviceId}`);
        if(epoch!==this.epoch||this.closed)return;
        const ringing=d.items.find(c=>c.side==='callee'&&!c.answeredElsewhere&&c.status==='RINGING');
        const elsewhere=this.call&&d.items.some(c=>c.id===this.call.id&&c.answeredElsewhere);
        if(ringing||this.call)this.show(ringing||null,elsewhere?'Đã nhận trên thiết bị khác.':'Cuộc gọi đã kết thúc.');
      }
      this.lastSuccess=Date.now();
    } catch(e) {
      if(epoch!==this.epoch||this.closed)return;
      if([401,403,404,409].includes(e.status))await this.clear(e.message);
      else if(this.owned&&Date.now()-(this.lastSuccess||Date.now())>25000)await this.clear('Mất kết nối cuộc gọi. Vui lòng gọi lại.');
    } finally {this.polling=false;}
  }
  async dispose() {this.closed=true;await this.clear();}
}
