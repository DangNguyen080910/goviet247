import {unavailableCallAction,callError,tripCallParties,callActorIdentity,validCallDevice,callView,recordingNotice} from './tripCallPolicy.js';
export function ringingEndStatus(call, side, now=Date.now()) { return side==='caller'||now-new Date(call.createdAt).getTime()>=45000?'MISSED':'REJECTED'; }
const live=['RINGING','CONNECTING','CONNECTED'];
const terminal=['ENDED','MISSED','REJECTED','CANCELLED','FAILED'];
export function createTripCallService(db, aws) {
 const sweepCursors={active:null,recovery:null};
 async function sweepBatch(queue,where){
  const cursor=sweepCursors[queue];
  let rows=await db.tripCall.findMany({where:{...where,...(cursor?{id:{gt:cursor}}:{})},take:100,orderBy:{id:'asc'}});
  if(!rows.length && cursor)rows=await db.tripCall.findMany({where,take:100,orderBy:{id:'asc'}});
  sweepCursors[queue]=rows.length===100?rows[rows.length-1].id:null;
  return rows;
 }
 async function locked(id,actor,device,work) {
  const initial=await db.tripCall.findUnique({where:{id}});
  if(!initial)throw callError('Không tìm thấy cuộc gọi.',404);
  return db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT "id" FROM "Trip" WHERE "id" = ${initial.tripId} FOR UPDATE`;
   await tx.$queryRaw`SELECT "id" FROM "TripCall" WHERE "id" = ${id} FOR UPDATE`;
   const call=await tx.tripCall.findUnique({where:{id}});
   const trip=await tx.trip.findUnique({where:{id:call.tripId}});
   const parties=await tripCallParties(tx,trip);
   const identity=await callActorIdentity(tx,actor,parties);
   if(identity.id!==call.callerId && identity.id!==call.calleeId)throw callError('Người phụ trách chuyến đã thay đổi.');
   if(![parties.driver.id,parties.receiver.id].every(v=>[call.callerId,call.calleeId].includes(v)))throw callError('Người phụ trách chuyến đã thay đổi.');
   const side=identity.id===call.callerId?'caller':'callee';
   return work(tx,call,side,validCallDevice(device));
  });
 }
 async function finish(tx,call,status) {
  if(!live.includes(call.status))return call;
  const endedAt=new Date();
  const updated=await tx.tripCall.update({where:{id:call.id},data:{status,endedAt}});
  await tx.tripCallReservation.deleteMany({where:{callId:call.id}});
  const seconds=call.startedAt?Math.max(0,Math.round((endedAt-call.startedAt)/1000)):0;
  const summary={MISSED:'Cuộc gọi nhỡ',REJECTED:'Người nhận từ chối',CANCELLED:'Người gọi đã hủy',FAILED:'Cuộc gọi không kết nối được',ENDED:'Cuộc gọi đã kết thúc'}[status];
  await tx.tripChatMessage.upsert({where:{tripId_senderId_clientId:{tripId:call.tripId,senderId:'system-call',clientId:`call_${call.id}`}},
   create:{tripId:call.tripId,senderId:'system-call',senderRole:'SYSTEM',senderLabel:'Cuộc gọi GoViet247',clientId:`call_${call.id}`,kind:'TEXT',createdAt:endedAt,historyAt:call.createdAt,audience:'ALL',text:`${summary} · ${call.callerLabel} → ${call.calleeLabel}${seconds?` · ${seconds} giây`:''}`},update:{}});
  return updated;
 }
 return {
  async eligibility(tripId,actor) {
   const trip=await db.trip.findUnique({where:{id:tripId}});
   try {
    const parties=await tripCallParties(db,trip);
    const me=await callActorIdentity(db,actor,parties),other=me.id===parties.driver.id?parties.receiver:parties.driver;
    return {canCall:true,label:other.label,recordingNotice};
   }catch(e){if(e.status)return {canCall:false,reason:e.message,...await unavailableCallAction(db,trip,actor)};throw e;}
  },
  async start(tripId,actor,{deviceId,clientId,consent}) {
   validCallDevice(deviceId);
   if(consent!==true)throw callError('Vui lòng đồng ý thông báo ghi âm trước khi gọi.',400);
   if(typeof clientId!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(clientId))throw callError('Mã cuộc gọi không hợp lệ.',400);
   try{return await db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "Trip" WHERE "id" = ${tripId} FOR UPDATE`;
    const trip=await tx.trip.findUnique({where:{id:tripId}}),parties=await tripCallParties(tx,trip);
    const me=await callActorIdentity(tx,actor,parties),other=me.id===parties.driver.id?parties.receiver:parties.driver;
    const existing=await tx.tripCall.findUnique({where:{callerId_clientId:{callerId:me.id,clientId}}});
    if(existing){if(existing.tripId!==tripId||existing.callerDevice!==deviceId)throw callError('Mã cuộc gọi đã sử dụng.',409);return callView(existing);}
    // A unique reservation for every alias makes busy state global across devices/trips.
    const aliases=[...new Set([...me.aliases,...other.aliases])].sort();
    for(const alias of aliases)await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${alias}))::text`;
    if(await tx.tripCallReservation.findFirst({where:{actorId:{in:aliases}}}))throw callError('Tài khoản đang bận trong cuộc gọi khác.',409,'CALL_BUSY');
    const recent=await tx.tripCall.count({where:{callerId:me.id,createdAt:{gte:new Date(Date.now()-60000)}}});
    if(recent>=5)throw callError('Bạn gọi quá nhanh. Vui lòng thử lại sau một phút.',429);
    const call=await tx.tripCall.create({data:{tripId,clientId,callerId:me.id,calleeId:other.id,callerLabel:me.label,calleeLabel:other.label,
     callerAliases:me.aliases,calleeAliases:other.aliases,callerDevice:deviceId}});
    await tx.tripCallReservation.createMany({data:aliases.map(actorId=>({actorId,callId:call.id}))});
    return callView(call);
   });}catch(e){if(e.code==='P2002')throw callError('Tài khoản đang bận trong cuộc gọi khác.',409,'CALL_BUSY');throw e;}
  },
  async incoming(actor,deviceId) {
   validCallDevice(deviceId);
   if(actor.role==='ADMIN')return [];
   const rows=await db.tripCall.findMany({where:{status:{in:live},OR:[{callerAliases:{has:actor.id}},{calleeAliases:{has:actor.id}}]},take:5,orderBy:{createdAt:'desc'}});
   const items=[];
   for(const c of rows)try{await locked(c.id,actor,deviceId,async(_tx,call,side,device)=>{
    items.push({...callView(call),side,answeredElsewhere:side==='callee' && Boolean(call.calleeDevice) && call.calleeDevice!==device});
   });}catch(e){if(!e.status)throw e;}
   return items;
  },
  async accept(id,actor,{deviceId,consent}) {
   if(consent!==true)throw callError('Vui lòng đồng ý thông báo ghi âm trước khi nghe.',400);
   const claimed=await locked(id,actor,deviceId,async(tx,call,side,device)=>{
    if(side!=='callee')throw callError('Chỉ người nhận được trả lời.');
    if(call.calleeDevice && call.calleeDevice!==device)throw callError('Đã nhận trên thiết bị khác.',409,'CALL_ANSWERED_ELSEWHERE');
    if(call.status==='RINGING' && Date.now()-call.createdAt>45000){await finish(tx,call,'MISSED');return null;}
    if(call.status!=='RINGING')return false;
    return tx.tripCall.update({where:{id},data:{status:'CONNECTING',calleeDevice:device,answeredAt:new Date(),calleeSeenAt:new Date()}});
   });
   if(claimed===null)throw callError('Cuộc gọi đã hết thời gian chờ.',409);
   if(claimed) {
    // Persist resources as they are allocated so the worker can clean up after process failure.
    try {
     const meeting=await aws.meeting(id);
     await db.tripCall.update({where:{id},data:{meeting,cleanupDoneAt:null}});
     const capture=await aws.capture(meeting.MeetingArn,id);
     await db.tripCall.update({where:{id},data:{captureId:capture.MediaPipelineId,captureArn:capture.MediaPipelineArn,cleanupDoneAt:null}});
     const concat=await aws.concatenate(capture.MediaPipelineArn,id);
     await db.tripCall.update({where:{id},data:{concatId:concat.MediaPipelineId,cleanupDoneAt:null}});
     const callerAttendee=await aws.attendee(meeting.MeetingId,id,'caller'),calleeAttendee=await aws.attendee(meeting.MeetingId,id,'callee');
     await db.tripCall.updateMany({where:{id,status:'CONNECTING'},data:{callerAttendee,calleeAttendee}});
    }catch(e){await db.$transaction(async tx=>{await tx.$queryRaw`SELECT "id" FROM "TripCall" WHERE "id" = ${id} FOR UPDATE`;const c=await tx.tripCall.findUnique({where:{id}});await finish(tx,c,'FAILED');});throw callError('Không kết nối được cuộc gọi. Vui lòng thử lại.',503,'CALL_CONNECT_FAILED');}
   }
   return {success:true};
  },
  async session(id,actor,deviceId) {
   return locked(id,actor,deviceId,async(_tx,call,side,device)=>{
    if(call[`${side}Device`]!==device)throw callError('Đã nhận trên thiết bị khác.',409,'CALL_ANSWERED_ELSEWHERE');
    return {...callView(call),...(live.includes(call.status)&&call.captureId&&call.concatId&&call[`${side}Attendee`]?{meeting:call.meeting,attendee:call[`${side}Attendee`]}:{})};
   });
  },
  async heartbeat(id,actor,{deviceId,joined=false}) {
   return locked(id,actor,deviceId,async(tx,call,side,device)=>{
    if(call[`${side}Device`]!==device)throw callError('Cuộc gọi đang ở thiết bị khác.',409);
    if(!live.includes(call.status))return callView(call);
    if(joined && !call[`${side}Attendee`])throw callError('Cuộc gọi chưa sẵn sàng.',409);
    const data={[`${side}SeenAt`]:new Date(),...(joined?{[`${side}Joined`]:true}:{})};
    if(joined && call[`${side==='caller'?'callee':'caller'}Joined`] && !call.startedAt){data.status='CONNECTED';data.startedAt=new Date();}
    return callView(await tx.tripCall.update({where:{id},data}));
   });
  },
  async end(id,actor,{deviceId,reject=false}) {
   return locked(id,actor,deviceId,async(tx,call,side,device)=>{
    if(side==='caller' && call.callerDevice!==device)throw callError('Cuộc gọi đang ở thiết bị khác.',409);
    if(side==='callee' && call.calleeDevice && call.calleeDevice!==device)throw callError('Đã nhận trên thiết bị khác.',409,'CALL_ANSWERED_ELSEWHERE');
    const status=call.status==='RINGING'?(ringingEndStatus(call,side)):'ENDED';
    return callView(await finish(tx,call,status));
   });
  },
  async recording(id,actor) {
   if(actor.role!=='ADMIN' || actor.recordingAdmin!==true)throw callError('Chỉ Admin được nghe ghi âm.');
   const call=await db.tripCall.findUnique({where:{id}});
   if(!call?.recordingKey)throw callError('Ghi âm đang xử lý hoặc chưa có.',404);
   await db.tripChatAccess.create({data:{tripId:call.tripId,actorId:actor.id,action:`PLAY_CALL_RECORDING:${id}`}});
   return {url:await aws.recordingUrl(call.recordingKey,id)};
  },
  async sweep() {
   const active=await sweepBatch('active',{status:{in:live}});
   const recovery=await sweepBatch('recovery',{status:{in:terminal},OR:[{endedAt:{not:null},cleanupDoneAt:null},{endedAt:{not:null},recordingKey:null,concatId:{not:null}}]});
   const rows=[...new Map([...active,...recovery].map(call=>[call.id,call])).values()];
   for(let call of rows)try {
    if(live.includes(call.status)){
     const trip=await db.trip.findUnique({where:{id:call.tripId}});
     let valid=true;try{const p=await tripCallParties(db,trip);valid=[p.driver.id,p.receiver.id].every(v=>[call.callerId,call.calleeId].includes(v));}catch(e){if(!e.status)throw e;valid=false;}
     const stale=call.status!=='RINGING' && (Date.now()-call.callerSeenAt>35000 || (call.calleeSeenAt && Date.now()-call.calleeSeenAt>35000));
     const timedOut=call.status==='RINGING' && Date.now()-call.createdAt>45000 || call.status==='CONNECTING' && Date.now()-call.answeredAt>60000 || Date.now()-call.createdAt>3600000;
     if(!valid||stale||timedOut)call=await db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT "id" FROM "TripCall" WHERE "id" = ${call.id} FOR UPDATE`;
      const latest=await tx.tripCall.findUnique({where:{id:call.id}});
      // Recheck timestamps after locking to avoid expiring a concurrent heartbeat.
      const expired=latest.status!=='RINGING' && (Date.now()-latest.callerSeenAt>35000 || latest.calleeSeenAt && Date.now()-latest.calleeSeenAt>35000);
      const latestTimedOut=latest.status==='RINGING' && Date.now()-latest.createdAt>45000 || latest.status==='CONNECTING' && Date.now()-latest.answeredAt>60000 || Date.now()-latest.createdAt>3600000;
      if(!valid||expired||latestTimedOut)return finish(tx,latest,latest.status==='RINGING'?'MISSED':'ENDED');
      return latest;
     });
    }
    if(terminal.includes(call.status)){
     if(!call.cleanupDoneAt){
      if(call.captureId)await aws.stopCapture(call.captureId);
      if(call.meeting?.MeetingId)await aws.stopMeeting(call.meeting.MeetingId);
     }
     // Keep cleanup retryable for a provisioning request that is still returning resources.
     if(!call.cleanupDoneAt && Date.now()-call.endedAt>120000)await db.tripCall.update({where:{id:call.id},data:{cleanupDoneAt:new Date()}});
     if(call.concatId && !call.recordingKey){
      const key=await aws.recording(call.id);
      if(key)await db.$transaction(async tx=>{
       await tx.tripCall.update({where:{id:call.id},data:{recordingKey:key}});
       await tx.tripChatMessage.upsert({where:{tripId_senderId_clientId:{tripId:call.tripId,senderId:'system-call',clientId:`record_${call.id}`}},create:{tripId:call.tripId,senderId:'system-call',senderRole:'SYSTEM',senderLabel:'Ghi âm cuộc gọi',pushDoneAt:new Date(),clientId:`record_${call.id}`,kind:'TEXT',audience:'ADMIN',recordingCallId:call.id,text:'Ghi âm cuộc gọi đã sẵn sàng. Chỉ Admin được nghe lại.'},update:{}});
      });
     }
    }
   }catch(e){console.error('[TripCall] pending recovery',call.id,e.name);}
  }
 };
}
