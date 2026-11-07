package com.goviet247.tripcalling

import android.app.*
import android.content.*
import android.media.*
import android.net.Uri
import android.os.*
import android.telecom.*
import android.telecom.Connection
import androidx.core.content.ContextCompat
import com.amazonaws.services.chime.sdk.meetings.device.MediaDeviceType
import com.amazonaws.services.chime.sdk.meetings.audiovideo.AudioVideoObserver
import com.amazonaws.services.chime.sdk.meetings.audiovideo.video.RemoteVideoSource
import com.amazonaws.services.chime.sdk.meetings.session.*
import com.amazonaws.services.chime.sdk.meetings.utils.logger.ConsoleLogger
import com.amazonaws.services.chime.sdk.meetings.utils.logger.LogLevel
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.*
import java.io.IOException
import java.util.concurrent.TimeUnit

object CallManager : AudioVideoObserver {
  const val NOTIFICATION=24731
  private const val CHANNEL="goviet_trip_calls_v1"
  val main=Handler(Looper.getMainLooper())
  private lateinit var context:Context
  private var config=emptyMap<String,String>()
  private var call=mutableMapOf<String,Any?>()
  var connection:Connection?=null
  private var session:DefaultMeetingSession?=null
  private var joined=false
  private var muted=false
  private var speaker=false
  private var accepted=false
  private var accepting=false
  private var error=""
  private var generation=0
  private var polling=false
  private var ringUntil=0L
  private var deadline=0L
  private val live=setOf("RINGING","CONNECTING","CONNECTED")
  private val http=OkHttpClient.Builder().connectTimeout(6,TimeUnit.SECONDS).readTimeout(15,TimeUnit.SECONDS).callTimeout(18,TimeUnit.SECONDS).build()
  private val timer=object:Runnable {override fun run(){tick();if(callId()!=null)main.postDelayed(this,3000)}}
  fun init(value:Context){
    if(::context.isInitialized)return
    context=value.applicationContext;config=CallSecrets.read(context)
    if(Build.VERSION.SDK_INT>=26){
    val channel=NotificationChannel(CHANNEL,"Cuộc gọi chuyến GoViet247",NotificationManager.IMPORTANCE_HIGH).apply{
      lockscreenVisibility=Notification.VISIBILITY_PRIVATE;enableVibration(true)
      setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).build())
    }
    context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    context.getSystemService(NotificationManager::class.java).createNotificationChannel(NotificationChannel("goviet_trip_call_ongoing_v1","Cuộc gọi đang diễn ra",NotificationManager.IMPORTANCE_LOW).apply{setSound(null,null)})
    }
  }
  fun matchesSession(token:String)=token.isNotEmpty()&&config["token"]==token
  fun configure(value:Map<String,String>){
    check(Build.VERSION.SDK_INT>=26){"Cuộc gọi cần Android 8 trở lên."}
    check(value["base"]?.let{Uri.parse(it).scheme=="https"&&Uri.parse(it).host!=null}==true)
    check(!value["token"].isNullOrEmpty()&&value["deviceId"].orEmpty().matches(Regex("[A-Za-z0-9_-]{16,100}")))
    check(value["appKind"] in setOf("DRIVER","RIDER")&&value["environment"]=="android-expo")
    check(value["pushToken"].orEmpty().matches(Regex("(ExponentPushToken|ExpoPushToken)\\[[A-Za-z0-9_-]{8,200}\\]")))
    if(config["token"]!=value["token"])clear()
    CallSecrets.write(context,value);config=value
    telecom().registerPhoneAccount(PhoneAccount.builder(account(),"GoViet247").setCapabilities(PhoneAccount.CAPABILITY_SELF_MANAGED).setSupportedUriSchemes(listOf(PhoneAccount.SCHEME_SIP)).build())
    registerDevice()
  }
  private fun registerDevice(){
    if(config.isEmpty())return
    val version=config["token"]
    request("/devices","POST",JSONObject(mapOf("deviceId" to config["deviceId"],"appKind" to config["appKind"],"environment" to "android-expo","token" to config["pushToken"]))){_,status->
      if(status !in 200..299 && status !in setOf(400,401,403,404) && config["token"]==version)main.postDelayed({if(config["token"]==version)registerDevice()},15000)
    }
  }
  fun clear(){
    if(!::context.isInitialized)return
    config["deviceId"]?.let{request("/devices/$it","DELETE"){_,_->}}
    endOnServer();finish();config=emptyMap();CallSecrets.clear(context)
  }
  fun callId()=call["id"] as? String
  fun answered()=accepted
  fun peerLabel()=(call[if(call["side"]=="caller")"calleeLabel" else "callerLabel"] as? String) ?: "Liên hệ chuyến"
  fun snapshot():Map<String,Any?> = mapOf("call" to call.toMap(),"joined" to joined,"muted" to muted,"speaker" to speaker,"configured" to config.isNotEmpty(),"error" to error)
  fun incoming(data:JSONObject){
    if(config.isEmpty()||callId()!=null||data.optString("callId").isBlank()||data.optLong("expiresAt")<=System.currentTimeMillis())return
    error="";accepted=false;ringUntil=data.optLong("expiresAt");deadline=System.currentTimeMillis()+35000
    call=mutableMapOf("id" to data.getString("callId"),"status" to "RINGING","side" to "callee","callerLabel" to data.optString("callerName","Liên hệ chuyến"))
    try{
      startService()
      telecom().addNewIncomingCall(account(),Bundle().apply{putString("govietCallId",callId())})
      main.removeCallbacks(timer);main.post(timer)
    }catch(_:Exception){endOnServer();finish()}
  }
  fun outgoing(value:Map<String,Any?>){
    check(config.isNotEmpty()&&callId()==null){"Tài khoản đang bận hoặc chưa bật gọi."}
    check(value["id"] is String)
    call=value.toMutableMap().apply{put("side","caller")};accepted=true;error=""
    ringUntil=System.currentTimeMillis()+45000;deadline=System.currentTimeMillis()+35000
    try{
      startService()
      telecom().placeCall(Uri.fromParts("sip","trip@goviet247.com",null),Bundle().apply{
        putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE,account())
        putBundle(TelecomManager.EXTRA_OUTGOING_CALL_EXTRAS,Bundle().apply{putString("govietCallId",callId())})
      })
      main.removeCallbacks(timer);main.post(timer)
    }catch(e:Exception){endOnServer();finish();throw e}
  }
  fun answer(){
    val id=callId()?:return
    if(accepted||accepting)return
    accepting=true
    val version=generation
    request("/$id/accept","POST",JSONObject(mapOf("deviceId" to config["deviceId"],"consent" to true))){data,status->
      if(version!=generation)return@request
      accepting=false
      if(status !in 200..299){error=if(status==409)"Đã nhận trên thiết bị khác" else "Không nhận được cuộc gọi.";finish();return@request}
      accepted=true;call["status"]="CONNECTING"
      try{startService();showNotification();tick()}catch(_:Exception){error="Không mở được micro cuộc gọi.";endOnServer();finish()}
    }
  }
  fun end(){endOnServer();finish()}
  private fun endOnServer(){
    val id=callId()?:return
    request("/$id/end","POST",JSONObject(mapOf("deviceId" to config["deviceId"],"reject" to !accepted))){_,_->}
  }
  private fun finish(){
    generation++;main.removeCallbacks(timer);polling=false
    val old=session;session=null
    old?.audioVideo?.removeAudioVideoObserver(this);old?.audioVideo?.stop()
    connection?.setDisconnected(DisconnectCause(DisconnectCause.LOCAL));connection?.destroy();connection=null
    call=mutableMapOf();accepted=false;accepting=false;joined=false;muted=false;speaker=false
    context.getSystemService(NotificationManager::class.java).cancel(NOTIFICATION)
    context.stopService(Intent(context,CallOngoingService::class.java))
  }
  private fun tick(){
    val id=callId()?:return
    if(polling)return
    if(System.currentTimeMillis()>deadline || (call["status"]=="RINGING"&&System.currentTimeMillis()>ringUntil)){
      if(call["status"]=="RINGING")finish() else end()
      return
    }
    polling=true;val version=generation;val device=config["deviceId"].orEmpty()
    val ringing=call["side"]=="callee"&&!accepted
    request(if(ringing)"/incoming?deviceId=$device" else "/$id/session?deviceId=$device"){data,status->
      if(version!=generation)return@request
      polling=false
      if(status !in 200..299){if(status in setOf(401,403,404,409,503)){error=if(status==409)"Đã nhận trên thiết bị khác" else "Cuộc gọi đã kết thúc.";finish()};return@request}
      deadline=System.currentTimeMillis()+35000
      val next=if(ringing){val items=data?.optJSONArray("items");(0 until (items?.length()?:0)).mapNotNull{items?.optJSONObject(it)}.firstOrNull{it.optString("id")==id}} else data?.optJSONObject("call")
      if(next==null||next.optString("status") !in live||next.optBoolean("answeredElsewhere")){if(next?.optBoolean("answeredElsewhere")==true)error="Đã nhận trên thiết bị khác";finish();return@request}
      val previous=call["status"];val side=call["side"]
      call=jsonMap(next).toMutableMap().apply{remove("meeting");remove("attendee");put("side",side)}
      if(previous!=call["status"])showNotification()
      if(!ringing){
        request("/$id/heartbeat","POST",JSONObject(mapOf("deviceId" to device,"joined" to joined))){_,heartbeatStatus->if(version==generation&&heartbeatStatus in setOf(401,403,404,409))finish()}
        if(session==null&&next.has("meeting"))prepare(next)
      }
    }
  }
  private fun prepare(data:JSONObject){
    try{
      val m=data.getJSONObject("meeting");val a=data.getJSONObject("attendee");val p=m.getJSONObject("MediaPlacement")
      val configuration=MeetingSessionConfiguration(m.getString("MeetingId"),m.optString("ExternalMeetingId"),
        MeetingSessionCredentials(a.getString("AttendeeId"),a.getString("ExternalUserId"),a.getString("JoinToken")),
        MeetingSessionURLs(p.getString("AudioFallbackUrl"),p.getString("AudioHostUrl"),p.getString("TurnControlUrl"),p.getString("SignalingUrl"),{it}))
      val meeting=DefaultMeetingSession(configuration,ConsoleLogger(LogLevel.ERROR),context)
      session=meeting;meeting.audioVideo.addAudioVideoObserver(this);meeting.audioVideo.start()
    }catch(_:Exception){error="Không kết nối được âm thanh.";endOnServer();finish()}
  }
  fun mute(value:Boolean){
    val audio=session?.audioVideo ?: error("Âm thanh đang kết nối. Vui lòng thử lại.")
    check(if(value)audio.realtimeLocalMute() else audio.realtimeLocalUnmute()){"Chưa đổi được micro. Vui lòng thử lại."}
    muted=value
  }
  @Suppress("DEPRECATION")
  fun speaker(value:Boolean){
    val audio=session?.audioVideo ?: error("Âm thanh đang kết nối. Vui lòng thử lại.")
    val type=if(value)MediaDeviceType.AUDIO_BUILTIN_SPEAKER else MediaDeviceType.AUDIO_HANDSET
    val device=audio.listAudioDevices().firstOrNull{it.type==type}
      ?: error("Không tìm thấy thiết bị âm thanh phù hợp.")
    audio.chooseAudioDevice(device)
    connection?.setAudioRoute(if(value)CallAudioState.ROUTE_SPEAKER else CallAudioState.ROUTE_EARPIECE)
    speaker=value
  }
  private fun telecom()=context.getSystemService(TelecomManager::class.java)
  private fun account()=PhoneAccountHandle(ComponentName(context,CallConnectionService::class.java),"goviet247-trip-calls")
  private fun startService(){ContextCompat.startForegroundService(context,Intent(context,CallOngoingService::class.java))}
  fun showNotification(){if(callId()!=null)context.getSystemService(NotificationManager::class.java).notify(NOTIFICATION,notification())}
  fun notification():Notification {
    val incoming=call["side"]=="callee"&&!accepted
    val open=Intent(context,CallActivity::class.java).putExtra("callId",callId())
    val flags=PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    val content=PendingIntent.getActivity(context,1,open,flags)
    val answer=PendingIntent.getActivity(context,2,Intent(open).setAction("ANSWER"),flags)
    val end=PendingIntent.getBroadcast(context,3,Intent(context,CallActionReceiver::class.java).putExtra("callId",callId()),flags)
    val label=peerLabel()
    val builder=Notification.Builder(context,if(incoming)CHANNEL else "goviet_trip_call_ongoing_v1").setSmallIcon(android.R.drawable.sym_action_call).setContentTitle(label).setContentText(if(incoming)"Cuộc gọi đến" else "Cuộc gọi đang diễn ra").setContentIntent(content).setCategory(Notification.CATEGORY_CALL).setOngoing(true).setVisibility(Notification.VISIBILITY_PRIVATE)
    if(Build.VERSION.SDK_INT>=31){val person=Person.Builder().setName(label).setImportant(true).build();builder.setStyle(if(incoming)Notification.CallStyle.forIncomingCall(person,end,answer) else Notification.CallStyle.forOngoingCall(person,end))}
    else {if(incoming)builder.addAction(Notification.Action.Builder(null,"Nghe máy",answer).build());builder.addAction(Notification.Action.Builder(null,"Kết thúc",end).build())}
    if(incoming){
      builder.setTimeoutAfter((ringUntil-System.currentTimeMillis()).coerceAtLeast(1))
      if(Build.VERSION.SDK_INT<34||context.getSystemService(NotificationManager::class.java).canUseFullScreenIntent())builder.setFullScreenIntent(content,true)
    }else builder.setOnlyAlertOnce(true)
    return builder.build().apply{if(incoming)this.flags=this.flags or Notification.FLAG_INSISTENT}
  }
  private fun request(path:String,method:String="GET",body:JSONObject?=null,done:(JSONObject?,Int)->Unit){
    val base=config["base"];val token=config["token"]
    if(base==null||token==null){done(null,401);return}
    val builder=Request.Builder().url(base+"/api/trip-calls"+path).header("Authorization","Bearer $token").header("Cache-Control","no-store")
    if(method!="GET")builder.method(method,(body?.toString()?:"{}").toRequestBody("application/json".toMediaType()))
    http.newCall(builder.build()).enqueue(object:Callback{
      override fun onFailure(call:okhttp3.Call,e:IOException){main.post{done(null,0)}}
      override fun onResponse(call:okhttp3.Call,response:Response){response.use{val status=it.code;val data=try{JSONObject(it.body?.string()?:"{}")}catch(_:Exception){null};main.post{done(data,status)}}}
    })
  }
  private fun jsonMap(value:JSONObject):Map<String,Any?> = value.keys().asSequence().associateWith { key->when(val v=value.opt(key)){JSONObject.NULL->null;is JSONObject->jsonMap(v);else->v} }
  override fun onAudioSessionStartedConnecting(reconnecting:Boolean){}
  override fun onAudioSessionStarted(reconnecting:Boolean){main.post { connection?.setActive();joined=true;try{mute(muted);speaker(speaker)}catch(_:Exception){error="Chưa thiết lập được âm thanh. Vui lòng thử lại."};tick() }}
  override fun onAudioSessionDropped(){joined=false}
  override fun onAudioSessionStopped(sessionStatus:MeetingSessionStatus){if(session!=null){error="Cuộc gọi bị ngắt.";end()}}
  override fun onAudioSessionCancelledReconnect(){end()}
  override fun onConnectionRecovered(){}
  override fun onConnectionBecamePoor(){}
  override fun onVideoSessionStartedConnecting(){}
  override fun onVideoSessionStarted(sessionStatus:MeetingSessionStatus){}
  override fun onVideoSessionStopped(sessionStatus:MeetingSessionStatus){}
  override fun onRemoteVideoSourceAvailable(sources:List<RemoteVideoSource>){}
  override fun onRemoteVideoSourceUnavailable(sources:List<RemoteVideoSource>){}
  override fun onCameraSendAvailabilityUpdated(available:Boolean){}
}
