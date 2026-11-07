import ExpoModulesCore
import UIKit
import AVFoundation

public class GoVietTripCallingSubscriber: ExpoAppDelegateSubscriber {
  public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    GoVietCallManager.shared.boot()
    return true
  }
}

public class GoVietTripCallingModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GoVietTripCalling")
    Constants(["version": 1])
    AsyncFunction("microphone") { (promise: Promise) in
      AVAudioSession.sharedInstance().requestRecordPermission { allowed in promise.resolve(allowed) }
    }
    AsyncFunction("configure") { (configuration: [String: String]) in
      try GoVietCallManager.shared.configure(configuration)
    }.runOnQueue(.main)
    AsyncFunction("matchesSession") { (token: String) in GoVietCallManager.shared.matchesSession(token) }.runOnQueue(.main)
    AsyncFunction("clear") { GoVietCallManager.shared.clear() }.runOnQueue(.main)
    AsyncFunction("snapshot") { GoVietCallManager.shared.snapshot() }.runOnQueue(.main)
    AsyncFunction("outgoing") { (call: [String: Any], promise: Promise) in
      GoVietCallManager.shared.outgoing(call, promise: promise)
    }.runOnQueue(.main)
    AsyncFunction("answer") { (promise: Promise) in GoVietCallManager.shared.answer(promise) }.runOnQueue(.main)
    AsyncFunction("end") { GoVietCallManager.shared.end() }.runOnQueue(.main)
    AsyncFunction("mute") { (muted: Bool) in try GoVietCallManager.shared.mute(muted) }.runOnQueue(.main)
    AsyncFunction("speaker") { (speaker: Bool) in try GoVietCallManager.shared.speaker(speaker) }.runOnQueue(.main)
  }
}
