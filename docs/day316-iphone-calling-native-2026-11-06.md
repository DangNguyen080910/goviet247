> Latest update: Android native calling is now implemented locally alongside iPhone. See [cross-platform test status and remaining release checks](day316-android-iphone-call-test-2026-11-06.md). Historical pending items below are superseded by that report where explicitly noted.

# Day 316 — iPhone calling bridge and shared UI (2026-11-06)

Local source only. No production deployment, paid EAS build, Store upload, real APNs request or live AWS meeting was performed.

## Implemented in this step

- Shared Driver/Rider chat header phone action. Hidden when native calling is absent, the API feature is off, or trip eligibility denies calling (including bookers/managers outside the assigned calling pair).
- Full-screen outgoing/incoming/connecting/connected call UI, elapsed time, microphone mute, speaker and end/reject actions. Recording notice and explicit opt-in before registering native receiving; outgoing also confirms per call.
- Local Expo module `packages/trip-calling-native`, iOS only, pinned AmazonChimeSDK 0.27.4 / media 0.25.4. Driver and Rider depend on it through the workspace. Plugin supplies audio/VoIP background modes and microphone description during prebuild.
- Native PushKit registry and early Expo AppDelegate subscriber. Incoming VoIP pushes are reported immediately to CallKit before HTTP/React work; expired/unauthenticated pushes are reported then ended. Native CallKit default ringtone (subject to phone settings), no custom ringtone asset.
- Native HTTP accept/session/heartbeat/end so a suspended JS runtime is not responsible for maintaining a connected call. SDK media starts only after CallKit audio activation AND the server has supplied the attendee after recording resources exist. No video starts.
- Native session held in Keychain, AfterFirstUnlockThisDeviceOnly. API token is never logged or exposed in snapshots. Logging out removes the app login token and clears/unregisters native calling; consent/account-change races are guarded in JS.
- Registration retries transient failures; session/assignment revocation and acceptance on another device end local CallKit calls. Other devices use the existing server first-answer rule.
- Chat voice drafts are discarded (not auto-sent) on incoming/outgoing calls; foreground chat alert playback is suppressed while in a call.

## Validation

- New session tests exercise opt-in refusal, microphone refusal, disabled API, secure-session restoration, concurrent setup, account switching and logout during the consent dialog, stable installation ID, and unsupported platforms.
- Driver/Rider/Admin TypeScript checks passed.
- CocoaPods installed and resolved the new Expo module and pinned Chime frameworks. The `GoVietTripCalling` pod target compiled successfully for arm64 iOS Simulator using Xcode 26.5. This checks real SDK signatures and Expo module APIs, not actual calling.
- Whole-app Xcode build could not choose a destination: local Xcode reports the iOS 26.5 platform/runtime unavailable. No simulator runtime was downloaded. A signed physical-device build / properly installed simulator environment is still required.

## Still required before release

1. Android native audio/incoming-call implementation and its server push path are NOT implemented. The optional-module gate intentionally hides the phone action there. Web calling also remains pending; existing web chat/hearts/recording playback are separate.
2. Build fresh Driver and Rider binaries. Expo Go and older installed binaries cannot load this native module. Do not rely on an API-only or OTA update.
3. Keep `TRIP_CALL_ENABLED` and `TRIP_CALL_VOIP_PUSH_ENABLED` OFF on production until end-to-end checks pass. The APNs preparation file outside Git is not automatically loaded by the API. Server `.p8` path must refer to the server's private file, not the Mac path.
4. For test builds, `EXPO_PUBLIC_TRIP_CALL_APNS_ENV` is `sandbox` for a development APNs entitlement and `production` for TestFlight/App Store/ad-hoc production APNs. Default is sandbox in JS development and production in release; explicitly override if build signing differs. The API base must use HTTPS.
5. Test two authorized trip participants on real iPhones: both directions, foreground, background, locked screen, OS-terminated app, declined/missed calls, microphone refusal, DND, Bluetooth/speaker, network drop/reconnect, logout and assignment change. User force-quit delivery must be measured rather than promised.
6. Test two phones signed in to the same recipient; answering one must stop the other. Confirm unrelated accounts/trips can call concurrently and a reserved account gets busy.
7. Actual AWS capture/concat allocation and final recording layout still need a controlled smoke test. Confirm playback is available ONLY to genuine ADMIN and that STAFF/booker/manager cannot retrieve recording URLs. Configure agreed retention separately.
8. Prior backend resource-allocation persistence/recovery hardening remains documented in the foundation report; these local changes do not remove that release requirement.

## Secrets

The APNs `.p8` is outside the repository under the user's private configuration folder, chmod 600. It belongs only on the API host. It must not be included in mobile packages, source control, screenshots, or build output. This implementation does not embed it in either app.
