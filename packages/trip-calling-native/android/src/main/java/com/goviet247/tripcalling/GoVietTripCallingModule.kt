package com.goviet247.tripcalling

import android.Manifest
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.Promise
import expo.modules.interfaces.permissions.PermissionsResponseListener
import expo.modules.interfaces.permissions.PermissionsStatus

class GoVietTripCallingModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GoVietTripCalling")
    Constants("version" to 1,"supported" to (Build.VERSION.SDK_INT>=26 && Build.SUPPORTED_ABIS.firstOrNull() in setOf("arm64-v8a","armeabi-v7a")))
    OnCreate { appContext.reactContext?.let { CallManager.init(it) } }
    AsyncFunction("matchesSession") { token: String -> CallManager.matchesSession(token) }.runOnQueue(Queues.MAIN)
    AsyncFunction("microphone") { promise: Promise ->
      val permissions=mutableListOf(Manifest.permission.RECORD_AUDIO)
      if(Build.VERSION.SDK_INT>=33) permissions.add(Manifest.permission.POST_NOTIFICATIONS)
      if(Build.VERSION.SDK_INT>=31) permissions.add(Manifest.permission.BLUETOOTH_CONNECT)
      val manager=appContext.permissions
      if(manager==null) promise.resolve(false)
      else manager.askForPermissions(PermissionsResponseListener { result -> promise.resolve(result.filterKeys { it!=Manifest.permission.BLUETOOTH_CONNECT }.values.all { it.status==PermissionsStatus.GRANTED }) },*permissions.toTypedArray())
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("configure") { value: Map<String,String> ->
      CallManager.init(requireNotNull(appContext.reactContext))
      CallManager.configure(value)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("clear") { CallManager.clear() }.runOnQueue(Queues.MAIN)
    AsyncFunction("snapshot") { CallManager.snapshot() }.runOnQueue(Queues.MAIN)
    AsyncFunction("outgoing") { value: Map<String,Any?> -> CallManager.outgoing(value) }.runOnQueue(Queues.MAIN)
    AsyncFunction("answer") { CallManager.answer() }.runOnQueue(Queues.MAIN)
    AsyncFunction("end") { CallManager.end() }.runOnQueue(Queues.MAIN)
    AsyncFunction("mute") { value: Boolean -> CallManager.mute(value) }.runOnQueue(Queues.MAIN)
    AsyncFunction("speaker") { value: Boolean -> CallManager.speaker(value) }.runOnQueue(Queues.MAIN)
  }
}
