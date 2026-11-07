# Day 316 — Android + iPhone calling preparation (2026-11-06)

Latest status for the user's test pair: one iPhone and one Android. All changes are local. No production deployment, EAS build, Store upload, real call push or AWS meeting has been performed.

## Implemented

- The existing shared phone action/call screen now loads the optional native module on Android as well as iPhone. Older binaries and web remain gated. Android requires Android 8+ on ARM/ARM64; the audio SDK is not available in x86 builds.
- Android Expo native module, pinned Chime SDK 0.25.5 and audio-only media 0.25.4, no video/ML media dependency. No video session starts.
- Android uses the already configured Expo → FCM path. API sends an urgent, data-only `TRIP_CALL` envelope, no presentational title/body, maximum remaining ringing TTL of 45 seconds and no meeting credentials. No new Firebase private key is needed by this implementation.
- Dedicated subclass of Expo's Firebase service intercepts call envelopes; every other remote message goes directly to `super.onMessageReceived`. Token refresh/deleted-message callbacks remain inherited from Expo. The merged manifest removes the original Expo service, uses the call handler at priority 0 and retains Firebase's normal low-priority (-500) fallback.
- Self-managed Telecom PhoneAccount/ConnectionService, incoming CallStyle notification and default system ringtone channel. Native lock-screen call Activity includes answer, end, microphone and speaker controls when React is suspended/closed. Full-screen UI is used only when permitted by Android; notification/head-up is the fallback. No overlay permission or DND bypass.
- Separate ongoing silent call channel; native foreground service (phoneCall, plus microphone after answer). Native session/heartbeat/end requests keep a connected call independent of JS timers. Both platform implementations preserve a mute selected before media connection.
- Android API session encrypted with Android Keystore AES-GCM in noBackupFilesDir; it is not in preferences/logs/snapshots or Android backups. Logout removes/unregisters native session.
- Android registrations reuse the session-bound TripCallDevice/outbox with environment `android-expo`; Expo token case is preserved. iPhone APNs registrations remain separate. No additional database schema migration is needed for this Android step.
- Dispatcher/passenger/driver eligibility, booker exclusions, busy reservations and first-device-answer remain the existing server policy. The transport does not choose recipients independently.

## Validation completed

- Android native module compiled against the real Chime/Expo APIs. Driver app `processDebugMainManifest` passed and the selected FCM handler/Telecom/foreground service declarations were inspected in the merged manifest.
- iPhone native pod target had already compiled; rebuilt after the shared mute correction.
- Driver, Rider and Admin TypeScript checks passed after Android integration.
- Full suite: **490 passed, zero failed, zero skipped**, using the temporary local test database. Includes Android data-only payload/expiry, lazy APNs isolation, transient vs permanent transport errors, native consent/account races, case-sensitive Expo registration, iPhone+Android simultaneous deliveries, and previous trip/chat/recording security cases.
- These checks do not prove actual FCM/APNs delivery, audible ringing, Android background microphone behavior, AWS recording or signed full-app release builds.

## Next real-device test

1. Prepare a controlled API test deployment yourself (per prior instruction). Apply the three existing calling/chat Prisma migrations and deploy the local source. Keep production calls disabled until the controlled smoke test passes.
2. The test API needs Singapore role access, `TRIP_CALL_RECORDINGS_BUCKET=goviet247-prod`, and the APNs key config. The Mac private key path must be replaced with its protected location on the API host. No APNs private key belongs in mobile builds. `TRIP_CALL_ENABLED=true` and `TRIP_CALL_VOIP_PUSH_ENABLED=true` enable the controlled test; defaults remain off in source.
3. Build NEW Driver and Rider binaries containing `@goviet247/trip-calling-native`. Both apps need a new native build; API-only, Expo Go or OTA updates cannot supply this module. Use production APNs environment for TestFlight/App Store; align sandbox/production with signing for development builds. Set HTTPS API base for the test environment.
4. Native iOS/Android folders currently generated on the Mac are ignored, and some existing Android project IDs are older than app.json. Regenerate through Expo prebuild/EAS from tracked app.json + config plugins for distribution; do not publish the old generated project IDs. Both source google-services.json files include their corresponding current GoViet bundle/package IDs.
5. Sign in to actual driver and actual passenger accounts, accept a test trip, open updated apps and grant recording consent, microphone and notification permissions. Bluetooth permission is optional for speaker/earpiece calls.
6. Test iPhone→Android and Android→iPhone; then foreground/background/locked screen; reject, missed, remote hangup, speaker, Bluetooth, mute BEFORE answer, network failure, logout and assignment changes. Test one recipient on two devices: only first answer may hear audio, the other stops.
7. Verify private recording completion and ADMIN-only playback. Actual AWS capture/concat persistence/recovery, recording layout and retention checks from the foundation report remain release requirements.

Android force-stop, OS battery restrictions, DND and full-screen permission affect delivery/display. Their real-device behavior must be measured; these local changes do not guarantee ringing under all phone states. Expo push ticket success is enqueue acknowledgement, not proof the device received it.

## Scope still pending

No browser live-call implementation yet. Existing web chat/hearts/admin recording playback remain separate. No call recording retention policy was automatically added to the production bucket. No test or production account was messaged by these checks.
