> Latest update: Android native calling is now implemented locally alongside iPhone. See [cross-platform test status and remaining release checks](day316-android-iphone-call-test-2026-11-06.md). Historical pending items below are superseded by that report where explicitly noted.

> Update: iPhone native bridge and call UI have now been added locally. See [native implementation and remaining release checks](day316-iphone-calling-native-2026-11-06.md). The historical preparation status below is not a release-readiness statement.

# VoIP push preparation — 2026-11-06

## Current state

Private APNs key supplied by the owner was extracted from the named ZIP entry, parsed as an EC P-256 PKCS#8 key and stored under the owner's private ~/.goviet247/private directory, outside the repository, with directory mode 700 and key/config mode 600. The source ZIP remains unchanged. No key contents, bearer JWT or device token were printed. The local private calls-apns.env contains key ID, team ID and an absolute path; it is not automatically loaded by the existing API process. No production file or environment was changed.

A local signature round-trip used the supplied key and its derived public key with a fake transport. It passed. This verifies key format and signing, not that Apple accepts the key ID/team/topic combination; an actual registered VoIP device is required for that check.

## Implemented locally

- Dedicated APNs HTTP/2 transport for incoming voice calls, with `.voip` topics fixed to the Driver/Rider bundle IDs. The client cannot supply an arbitrary hostname or topic.
- ES256 JWTs use raw P1363 signature encoding and a cached provider token, reused for 20 minutes. Sandbox and production destinations are separate. Invites expire with the 45-second ringing window.
- Stable UUID per call for native deduplication, with recording notice and no join credentials in the push payload. This transport only sends initial invites, never cancellation VoIP pushes.
- Session-bound native token registration/removal, separate from Expo chat tokens. DRIVER registration requires a verified driver profile; session appRole is checked. Returned registration response contains no token.
- Native registrations belong to an installation, app, authenticated account, session and generation. Repeated unchanged registration preserves its generation. Account changes, logout/revocation and expired sessions prevent stale queued deliveries. Device deletion cascades its outbox rows.
- Durable invite outbox with atomic claims, retry cooldown and maximum attempts. Permanent bad-device responses remove only the exact matching device registration; auth/server/rate-limit errors retain devices. Errors are stored as codes, not raw key/token details.
- Rechecks trip assignment, verified driver status, recipient alias and live session immediately before sending. Booker/manager accounts do not ring unless they are the actual permitted recipient.
- Bounded concurrency (eight deliveries) and an independent two-second push worker. APNs latency cannot block the existing five-second call recovery worker.

Both TRIP_CALL_ENABLED and TRIP_CALL_VOIP_PUSH_ENABLED must be exactly true to send calls. They remain off/unset. Existing AWS upload credentials, chat push keys and production service were not changed.

## Configuration for a future controlled deployment

Store the .p8 privately on the API host, not in the app bundle or repository. Set the following in the API's protected environment using the actual host key path:

```
TRIP_CALL_APNS_KEY_ID=<existing APNs key ID>
TRIP_CALL_APNS_TEAM_ID=<Apple Developer team ID>
TRIP_CALL_APNS_KEY_PATH=<absolute private .p8 path on API host>
```

The private Mac configuration file is local preparation only. Do not copy the Mac path unchanged into server configuration. Do not enable calls before native client integration and end-to-end verification.

API registration routes, gated by the calling feature switch:

- POST /api/trip-calls/devices: deviceId, appKind DRIVER/RIDER, native PushKit token, environment sandbox/production.
- DELETE /api/trip-calls/devices/:deviceId: removes only this authenticated account/session registration.

New migration: 20261106120000_trip_call_voip_devices. Apply through the existing reviewed deployment process before enabling the new endpoints. Production was not migrated during this work.

## Validation

473 tests passed, zero failures and zero skips across the complete local suite. Tests cover real PostgreSQL account/session binding, two phones, changed assignment, concurrent workers, expiration/revocation and retry deduplication. Unit tests cryptographically verify JWT signatures using disposable generated test keys and simulate HTTP/2 responses, timeout and cleanup.

No actual Apple push, AWS media pipeline, production call, EAS build or App Store upload was made. Test PostgreSQL was confined to localhost:55487/goviet247_test and shut down afterward.

## Still pending for the calling feature

- Native iOS PushKit registration and immediate CallKit incoming reporting, secure native auth handoff, recording-consent UI and native Chime audio bridge.
- Native Android incoming-call delivery and audio bridge; FCM server-side configuration may be needed separately.
- Phone button in shared chat and outgoing/incoming call UI, mute/speaker/end, background audio, heartbeat, first-answer-elsewhere teardown and session logout cleanup.
- Real-device tests for ringing while background/terminated, default ringtone and DND, two-device acceptance, rejected/missed/busy calls, network loss, record capture/concatenation and private Admin playback.
- Recovery for AWS allocation success followed by persistence failure; final recording retention/lifecycle and resource quota verification.

Official references:
- https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns
- https://developer.apple.com/documentation/pushkit/responding-to-voip-notifications-from-pushkit
