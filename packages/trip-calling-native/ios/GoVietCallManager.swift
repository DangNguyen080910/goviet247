import Foundation
import UIKit
import CallKit
import PushKit
import AVFoundation
import Security
import AmazonChimeSDK
import ExpoModulesCore

// Main-queue owned. PushKit and CallKit remain available before React has launched.
final class GoVietCallManager: NSObject, PKPushRegistryDelegate, CXProviderDelegate, AudioVideoObserver {
  static let shared = GoVietCallManager()
  private let controller = CXCallController()
  private var provider: CXProvider!
  private var registry: PKPushRegistry?
  private var config: [String: String] = [:]
  private var voipToken = ""
  private var registrationRetry: DispatchWorkItem?
  private var call: [String: Any] = [:]
  private var uuid: UUID?
  private var meeting: DefaultMeetingSession?
  private var timer: Timer?
  private var polling = false
  private var audioActive = false
  private var joined = false
  private var startingAudio = false
  private var muted = false
  private var loudspeaker = false
  private var lastError = ""
  private var generation = 0
  private var answered = false
  private var key: [String: Any] { [kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:"goviet247.trip-call",kSecAttrAccount as String:"session"] }

  func boot() {
    guard provider == nil else { return }
    let settings = CXProviderConfiguration(localizedName: "GoViet247")
    settings.supportsVideo = false
    settings.maximumCallGroups = 1
    settings.maximumCallsPerCallGroup = 1
    settings.supportedHandleTypes = [.generic]
    settings.includesCallsInRecents = false
    provider = CXProvider(configuration: settings)
    provider.setDelegate(self, queue: .main)
    var query = key
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    if SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
       let data = result as? Data, let saved = try? JSONDecoder().decode([String:String].self, from:data) { config = saved }
    if !config.isEmpty { registerPushKit() }
  }
  func configure(_ value: [String:String]) throws {
    boot()
    guard let base = value["base"], let url = URL(string:base), url.scheme == "https", url.host != nil,
          let token = value["token"], !token.isEmpty,
          let device = value["deviceId"], device.count >= 16,
          ["DRIVER","RIDER"].contains(value["appKind"] ?? ""),
          ["sandbox","production"].contains(value["environment"] ?? "") else { throw failure("Cấu hình cuộc gọi chưa hợp lệ.") }
    if config["token"] != token { clear() }
    config = value
    let data = try JSONEncoder().encode(value)
    let status = SecItemUpdate(key as CFDictionary,[kSecValueData as String:data] as CFDictionary)
    if status == errSecItemNotFound {
      var entry = key
      entry[kSecValueData as String] = data
      entry[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
      guard SecItemAdd(entry as CFDictionary,nil) == errSecSuccess else { config = [:]; throw failure("Không lưu được phiên gọi an toàn.") }
    } else if status != errSecSuccess { config = [:]; throw failure("Không cập nhật được phiên gọi an toàn.") }
    registerPushKit()
    registerToken()
  }
  private func registerPushKit() {
    guard registry == nil else { return }
    let push = PKPushRegistry(queue: .main)
    push.delegate = self
    push.desiredPushTypes = [.voIP]
    registry = push
  }
  func clear() {
    registrationRetry?.cancel(); registrationRetry = nil
    if !config.isEmpty, let device = config["deviceId"] { request("/devices/\(device)",method:"DELETE") { _ in } }
    endOnServer()
    finish(reason:.failed)
    config = [:]
    SecItemDelete(key as CFDictionary)
    registry?.desiredPushTypes = []
    registry = nil
  }
  func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
    voipToken = pushCredentials.token.map { String(format:"%02x",$0) }.joined()
    registerToken()
  }
  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    if let device = config["deviceId"] { request("/devices/\(device)",method:"DELETE") { _ in } }
    voipToken = ""
  }
  private func registerToken() {
    guard !voipToken.isEmpty, !config.isEmpty else { return }
    registrationRetry?.cancel()
    let sessionToken = config["token"], deviceToken = voipToken
    request("/devices",method:"POST",body:["deviceId":config["deviceId"]!,"appKind":config["appKind"]!,"environment":config["environment"]!,"token":voipToken]) { result in
      guard self.config["token"] == sessionToken, self.voipToken == deviceToken else { return }
      if case .failure(let error) = result, ![400,401,403,404].contains((error as NSError).code) {
        let retry = DispatchWorkItem { [weak self] in self?.registerToken() }
        self.registrationRetry = retry
        DispatchQueue.main.asyncAfter(deadline:.now()+15,execute:retry)
      }
    }
  }
  func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType, completion: @escaping () -> Void) {
    let data = payload.dictionaryPayload
    let incomingUUID = UUID(uuidString:data["callUUID"] as? String ?? "") ?? UUID()
    let update = CXCallUpdate()
    update.remoteHandle = CXHandle(type:.generic,value:"GoViet247")
    update.localizedCallerName = "\(data["callerName"] as? String ?? "Cuộc gọi chuyến")"
    update.hasVideo = false
    update.supportsHolding = false
    update.supportsGrouping = false
    update.supportsUngrouping = false
    update.supportsDTMF = false
    // Always report immediately, even expired/invalid pushes. Never wait for HTTP or JS.
    provider.reportNewIncomingCall(with:incomingUUID,update:update) { error in
      DispatchQueue.main.async {
        completion()
        guard error == nil else { return }
        guard self.uuid == nil, !self.config.isEmpty, let id = data["callId"] as? String,
              let expiry = data["expiresAt"] as? Double, expiry > Date().timeIntervalSince1970 * 1000 else {
          self.provider.reportCall(with:incomingUUID,endedAt:Date(),reason:.failed)
          return
        }
        self.uuid = incomingUUID
        self.call = ["id":id,"status":"RINGING","side":"callee","callerLabel":data["callerName"] as? String ?? "Cuộc gọi chuyến"]
        self.answered = false
        self.lastError = ""
        self.startTimer()
        self.tick()
      }
    }
  }
  func outgoing(_ value: [String:Any], promise: Promise) {
    boot()
    guard uuid == nil, !config.isEmpty, value["id"] is String else { promise.reject("CALL_BUSY","Đang có cuộc gọi khác hoặc chưa bật gọi."); return }
    uuid = UUID()
    call = value
    call["side"] = "caller"
    answered = true
    lastError = ""
    let action = CXStartCallAction(call:uuid!,handle:CXHandle(type:.generic,value:value["calleeLabel"] as? String ?? "Liên hệ chuyến"))
    action.isVideo = false
    controller.request(CXTransaction(action:action)) { error in
      DispatchQueue.main.async {
        if error != nil { self.endOnServer(); self.finish(reason:.failed); promise.reject("CALL_START_FAILED","Không mở được cuộc gọi.") }
        else { self.startTimer(); self.tick(); promise.resolve(nil) }
      }
    }
  }
  func answer(_ promise: Promise) {
    guard let id = uuid else { promise.reject("CALL_EXPIRED","Cuộc gọi đã kết thúc."); return }
    controller.request(CXTransaction(action:CXAnswerCallAction(call:id))) { error in
      if error != nil { promise.reject("CALL_ANSWER_FAILED","Không nhận được cuộc gọi.") } else { promise.resolve(nil) }
    }
  }
  func end() {
    guard let id = uuid else { return }
    controller.request(CXTransaction(action:CXEndCallAction(call:id))) { error in
      if error != nil { DispatchQueue.main.async { self.endOnServer(); self.finish(reason:.failed) } }
    }
  }
  private func endOnServer() {
    guard let id = call["id"] as? String, let device = config["deviceId"] else { return }
    request("/\(id)/end",method:"POST",body:["deviceId":device,"reject":!answered]) { _ in }
  }
  private func finish(reason: CXCallEndedReason) {
    generation += 1
    timer?.invalidate(); timer = nil; polling = false
    meeting?.audioVideo.removeAudioVideoObserver(observer:self)
    meeting?.audioVideo.stop(); meeting = nil
    if let id = uuid { provider?.reportCall(with:id,endedAt:Date(),reason:reason) }
    uuid = nil; call = [:]; joined = false; startingAudio = false; audioActive = false; answered = false; muted = false; loudspeaker = false
  }
  func matchesSession(_ token: String) -> Bool { return !token.isEmpty && config["token"] == token }
  func snapshot() -> [String:Any] {
    return ["call":call,"joined":joined,"muted":muted,"speaker":loudspeaker,"error":lastError,"configured":!config.isEmpty]
  }
  private func startTimer() {
    timer?.invalidate()
    timer = Timer.scheduledTimer(withTimeInterval:3,repeats:true) { [weak self] _ in self?.tick() }
  }
  private func tick() {
    guard !polling, let id = call["id"] as? String, let device = config["deviceId"], uuid != nil else { return }
    polling = true
    let version = generation
    // Before answer use incoming: session is intentionally forbidden for unclaimed devices.
    let ringing = call["side"] as? String == "callee" && !answered
    request(ringing ? "/incoming?deviceId=\(device)" : "/\(id)/session?deviceId=\(device)") { result in
      guard version == self.generation else { return }
      self.polling = false
      switch result {
      case .failure(let error):
        let code = (error as NSError).code
        if [401,403,404,409,503].contains(code) { self.lastError = error.localizedDescription; self.finish(reason:code == 409 ? .answeredElsewhere : .failed) }
      case .success(let data):
        let next = ringing ? (data["items"] as? [[String:Any]])?.first(where:{$0["id"] as? String == id}) : data["call"] as? [String:Any]
        guard var next = next else { self.finish(reason:.remoteEnded); return }
        if next["answeredElsewhere"] as? Bool == true { self.lastError = "Đã nhận trên thiết bị khác"; self.finish(reason:.answeredElsewhere); return }
        guard ["RINGING","CONNECTING","CONNECTED"].contains(next["status"] as? String ?? "") else { self.finish(reason:.remoteEnded); return }
        next["side"] = self.call["side"]
        let credentials = next
        next.removeValue(forKey:"meeting"); next.removeValue(forKey:"attendee")
        self.call = next
        if !ringing {
          self.request("/\(id)/heartbeat",method:"POST",body:["deviceId":device,"joined":self.joined]) { response in
            if version != self.generation { return }
            if case .failure(let error) = response, [401,403,404,409].contains((error as NSError).code) { self.finish(reason:.failed) }
          }
          if self.meeting == nil, credentials["meeting"] != nil { self.prepareMeeting(credentials) }
          self.startAudioIfReady()
        }
      }
    }
  }
  private func prepareMeeting(_ value: [String:Any]) {
    guard let m = value["meeting"] as? [String:Any], let a = value["attendee"] as? [String:Any],
          let placement = m["MediaPlacement"] as? [String:Any], let meetingId = m["MeetingId"] as? String,
          let region = m["MediaRegion"] as? String, let attendeeId = a["AttendeeId"] as? String,
          let token = a["JoinToken"] as? String,
          let fallback = placement["AudioFallbackUrl"] as? String, let host = placement["AudioHostUrl"] as? String,
          let signaling = placement["SignalingUrl"] as? String, let turn = placement["TurnControlUrl"] as? String else {
      lastError = "Thông tin kết nối chưa đầy đủ."; endOnServer(); finish(reason:.failed); return
    }
    let response = CreateMeetingResponse(meeting:Meeting(externalMeetingId:m["ExternalMeetingId"] as? String ?? meetingId,
      mediaPlacement:MediaPlacement(audioFallbackUrl:fallback,audioHostUrl:host,signalingUrl:signaling,turnControlUrl:turn),mediaRegion:region,meetingId:meetingId))
    let attendee = CreateAttendeeResponse(attendee:Attendee(attendeeId:attendeeId,externalUserId:a["ExternalUserId"] as? String ?? attendeeId,joinToken:token))
    let configuration = MeetingSessionConfiguration(createMeetingResponse:response,createAttendeeResponse:attendee)
    meeting = DefaultMeetingSession(configuration:configuration,logger:ConsoleLogger(name:"GoVietCall",level:.ERROR))
    meeting?.audioVideo.addAudioVideoObserver(observer:self)
  }
  private func configureAudio() throws {
    try AVAudioSession.sharedInstance().setCategory(.playAndRecord,mode:.voiceChat,options:[.allowBluetooth])
  }
  private func startAudioIfReady() {
    guard audioActive, let session = meeting, !startingAudio else { return }
    startingAudio = true
    do { try session.audioVideo.start(callKitEnabled:true) }
    catch { lastError = "Không mở được micro cuộc gọi."; endOnServer(); finish(reason:.failed) }
  }
  func mute(_ value: Bool) throws {
    guard let audio = meeting?.audioVideo else { throw NSError(domain:"GoVietCall",code:1,userInfo:[NSLocalizedDescriptionKey:"Âm thanh đang kết nối. Vui lòng thử lại."]) }
    guard value ? audio.realtimeLocalMute() : audio.realtimeLocalUnmute() else { throw NSError(domain:"GoVietCall",code:2,userInfo:[NSLocalizedDescriptionKey:"Chưa đổi được micro. Vui lòng thử lại."]) }
    muted = value
  }
  func speaker(_ value: Bool) throws {
    guard let audio = meeting?.audioVideo,
          let device = audio.listAudioDevices().first(where: { $0.type == (value ? .audioBuiltInSpeaker : .audioHandset) }) else {
      throw NSError(domain:"GoVietCall",code:3,userInfo:[NSLocalizedDescriptionKey:"Không tìm thấy thiết bị âm thanh phù hợp."])
    }
    audio.chooseAudioDevice(mediaDevice:device)
    loudspeaker = value
  }
  func providerDidReset(_ provider: CXProvider) { endOnServer(); finish(reason:.failed) }
  func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
    do { try configureAudio(); action.fulfill(); provider.reportOutgoingCall(with:action.callUUID,startedConnectingAt:Date()) }
    catch { action.fail(); endOnServer(); finish(reason:.failed) }
  }
  func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
    guard let id = call["id"] as? String, let device = config["deviceId"], uuid == action.callUUID else { action.fail(); return }
    let version = generation
    // Consent was explicitly granted in-app before this native session was stored.
    request("/\(id)/accept",method:"POST",body:["deviceId":device,"consent":true]) { result in
      guard version == self.generation else { action.fail(); return }
      switch result {
      case .failure(let error): self.lastError = error.localizedDescription; action.fail(); self.finish(reason:(error as NSError).code == 409 ? .answeredElsewhere : .failed)
      case .success:
        do { try self.configureAudio(); self.answered = true; action.fulfill(); self.tick() }
        catch { action.fail(); self.endOnServer(); self.finish(reason:.failed) }
      }
    }
  }
  func provider(_ provider: CXProvider, perform action: CXEndCallAction) { endOnServer(); finish(reason:.remoteEnded); action.fulfill() }
  func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) { do { try mute(action.isMuted); action.fulfill() } catch { action.fail() } }
  func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) { audioActive = true; startAudioIfReady() }
  func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) { audioActive = false }
  func provider(_ provider: CXProvider, timedOutPerforming action: CXAction) { endOnServer(); finish(reason:.failed); action.fail() }
  func audioSessionDidStartConnecting(reconnecting: Bool) {}
  func audioSessionDidStart(reconnecting: Bool) {
    DispatchQueue.main.async { try? self.mute(self.muted); try? self.speaker(self.loudspeaker); self.joined = true; if let id = self.uuid, self.call["side"] as? String == "caller" { self.provider.reportOutgoingCall(with:id,connectedAt:Date()) }; self.tick() }
  }
  func audioSessionDidDrop() { DispatchQueue.main.async { self.joined = false } }
  func audioSessionDidStopWithStatus(sessionStatus: MeetingSessionStatus) { DispatchQueue.main.async { if self.uuid != nil { self.endOnServer(); self.finish(reason:.failed) } } }
  func audioSessionDidCancelReconnect() { DispatchQueue.main.async { self.endOnServer(); self.finish(reason:.failed) } }
  func connectionDidRecover() {}
  func connectionDidBecomePoor() {}
  func remoteVideoSourcesDidBecomeAvailable(sources: [RemoteVideoSource]) {}
  func remoteVideoSourcesDidBecomeUnavailable(sources: [RemoteVideoSource]) {}
  func cameraSendAvailabilityDidChange(available: Bool) {}
  func videoSessionDidStartConnecting() {}
  func videoSessionDidStartWithStatus(sessionStatus: MeetingSessionStatus) {}
  func videoSessionDidStopWithStatus(sessionStatus: MeetingSessionStatus) {}

  private func request(_ path: String, method: String = "GET", body: [String:Any]? = nil, completion: @escaping (Result<[String:Any],Error>) -> Void) {
    guard let base = config["base"], let token = config["token"], let url = URL(string:base + "/api/trip-calls" + path) else { completion(.failure(failure("Vui lòng đăng nhập lại.",401))); return }
    var req = URLRequest(url:url,cachePolicy:.reloadIgnoringLocalCacheData,timeoutInterval:12)
    req.httpMethod = method
    req.setValue("Bearer \(token)",forHTTPHeaderField:"Authorization")
    req.setValue("application/json",forHTTPHeaderField:"Content-Type")
    if let body = body { req.httpBody = try? JSONSerialization.data(withJSONObject:body) }
    let bg = UIApplication.shared.beginBackgroundTask(expirationHandler:nil)
    URLSession.shared.dataTask(with:req) { data,response,error in
      DispatchQueue.main.async {
        defer { if bg != .invalid { UIApplication.shared.endBackgroundTask(bg) } }
        if let error = error { completion(.failure(error)); return }
        let object = data.flatMap { try? JSONSerialization.jsonObject(with:$0) as? [String:Any] } ?? [:]
        let status = (response as? HTTPURLResponse)?.statusCode ?? 503
        guard (200..<300).contains(status) else { completion(.failure(self.failure(object["message"] as? String ?? "Không kết nối được cuộc gọi.",status))); return }
        completion(.success(object))
      }
    }.resume()
  }
  private func failure(_ message: String, _ code: Int = 400) -> NSError { NSError(domain:"GoVietCall",code:code,userInfo:[NSLocalizedDescriptionKey:message]) }
  private static func parseDate(_ value: String) -> Date? {
    let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime,.withFractionalSeconds]
    return formatter.date(from:value) ?? ISO8601DateFormatter().date(from:value)
  }
}
