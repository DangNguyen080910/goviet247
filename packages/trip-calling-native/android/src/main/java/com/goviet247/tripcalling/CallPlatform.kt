package com.goviet247.tripcalling

import android.app.*
import android.content.*
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.*
import android.telecom.*
import android.graphics.Color
import android.view.Gravity
import android.widget.*
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService
import org.json.JSONObject

class CallMessagingService : ExpoFirebaseMessagingService() {
  override fun onMessageReceived(message: RemoteMessage) {
    val data=try { JSONObject(message.data["body"] ?: "{}") } catch(_:Exception){JSONObject()}
    if(data.optString("type")!="TRIP_CALL"){super.onMessageReceived(message);return}
    CallManager.main.post { CallManager.init(this); CallManager.incoming(data) }
  }
}
class CallConnectionService : ConnectionService() {
  private fun connection(request: ConnectionRequest): Connection {
    val id=request.extras?.getString("govietCallId")
    if(id!=CallManager.callId()) return Connection.createFailedConnection(DisconnectCause(DisconnectCause.CANCELED))
    return CallConnection().also {
      it.connectionProperties=Connection.PROPERTY_SELF_MANAGED
      it.connectionCapabilities=Connection.CAPABILITY_MUTE
      it.setAudioModeIsVoip(true)
      CallManager.connection=it
    }
  }
  override fun onCreateIncomingConnection(handle: PhoneAccountHandle,request: ConnectionRequest)=connection(request).also { it.setRinging() }
  override fun onCreateOutgoingConnection(handle: PhoneAccountHandle,request: ConnectionRequest)=connection(request).also { it.setDialing();CallManager.showNotification() }
  override fun onCreateIncomingConnectionFailed(handle: PhoneAccountHandle,request: ConnectionRequest){CallManager.end()}
  override fun onCreateOutgoingConnectionFailed(handle: PhoneAccountHandle,request: ConnectionRequest){CallManager.end()}
}
class CallConnection : Connection() {
  private var previousMuted:Boolean?=null
  override fun onShowIncomingCallUi(){CallManager.showNotification()}
  override fun onAnswer(){CallManager.answer()}
  override fun onReject(){CallManager.end()}
  override fun onDisconnect(){CallManager.end()}
  override fun onAbort(){CallManager.end()}
  @Suppress("DEPRECATION")
  override fun onCallAudioStateChanged(state: CallAudioState){
    if(previousMuted!=state.isMuted && (previousMuted!=null || state.isMuted))CallManager.mute(state.isMuted)
    previousMuted=state.isMuted
  }
}
class CallOngoingService : Service() {
  override fun onBind(intent: Intent?) : IBinder? = null
  override fun onStartCommand(intent: Intent?,flags: Int,startId: Int):Int {
    CallManager.init(this)
    val notification=CallManager.notification()
    val type=if(CallManager.answered()) android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL or android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE else android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
    if(Build.VERSION.SDK_INT>=29)startForeground(CallManager.NOTIFICATION,notification,type) else startForeground(CallManager.NOTIFICATION,notification)
    if(CallManager.callId()==null)stopSelf()
    return START_NOT_STICKY
  }
}
class CallActionReceiver : BroadcastReceiver() {
  override fun onReceive(context:Context,intent:Intent){
    CallManager.init(context)
    if(intent.getStringExtra("callId")==CallManager.callId())CallManager.end()
  }
}
class CallActivity : Activity() {
  private val handler=Handler(Looper.getMainLooper())
  private lateinit var status:TextView
  private val refresh=object:Runnable {
    override fun run(){
      if(CallManager.callId()==null){finish();return}
      val snapshot=CallManager.snapshot()
      val call=snapshot["call"] as? Map<*,*> ?: emptyMap<String,Any>()
      val state=call["status"]?.toString()
      status.text=when(state){"RINGING"->if(call["side"]=="callee")"Cuộc gọi đến" else "Đang gọi…";"CONNECTED"->"Đang nói chuyện";else->"Đang kết nối…"}
      handler.postDelayed(this,1000)
    }
  }
  override fun onCreate(savedInstanceState:Bundle?){
    super.onCreate(savedInstanceState);CallManager.init(this)
    if(Build.VERSION.SDK_INT>=27){setShowWhenLocked(true);setTurnScreenOn(true)}
    if(CallManager.callId()==null||intent.getStringExtra("callId")!=CallManager.callId()){finish();return}
    val root=LinearLayout(this).apply {orientation=LinearLayout.VERTICAL;gravity=Gravity.CENTER;setPadding(32,40,32,40);setBackgroundColor(Color.rgb(15,23,42))}
    fun label(value:String,size:Float)=TextView(this).apply{text=value;textSize=size;gravity=Gravity.CENTER;setTextColor(Color.WHITE);setPadding(0,16,0,16);root.addView(this)}
    label("GoViet247",26f);label(CallManager.peerLabel(),30f);status=label("Đang kết nối…",20f)
    label("Cuộc gọi qua internet · Có ghi âm\nChỉ admin GoViet247 được nghe lại",16f)
    fun button(text:String,action:()->Unit){root.addView(Button(this).apply{this.text=text;setOnClickListener{try{action()}catch(_:Exception){Toast.makeText(this@CallActivity,"Chưa thực hiện được. Vui lòng thử lại.",Toast.LENGTH_SHORT).show()}}})}
    if(!CallManager.answered())button("Nghe máy"){CallManager.answer()}
    button("Bật / tắt micro"){CallManager.mute(!(CallManager.snapshot()["muted"] as? Boolean ?: false))}
    button("Bật / tắt loa ngoài"){CallManager.speaker(!(CallManager.snapshot()["speaker"] as? Boolean ?: false))}
    button("Kết thúc"){CallManager.end();finish()}
    setContentView(root);handler.post(refresh)
    if(intent.action=="ANSWER")CallManager.answer()
  }
  override fun onDestroy(){handler.removeCallbacksAndMessages(null);super.onDestroy()}
}
