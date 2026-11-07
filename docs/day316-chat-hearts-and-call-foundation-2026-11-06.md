> Update: the follow-up APNs preparation is documented in day316-voip-push-preparation-2026-11-06.md. Backend VoIP registration and delivery now exist; native clients and real call testing are still pending.

# Chat hearts and voice-call backend preparation — 2026-11-06

## Delivery state

Hearts are implemented in the shared mobile chat (Driver/Rider/Admin) and shared web chat (customer/Admin/Partner). One heart per actor/message; explicit desired-state PUT makes retries safe; tapping again removes it. Counts and own selection return without disclosing other actors' IDs. Deleted, inaccessible and read-only messages cannot be reacted to. No reaction push or sound is created. Other clients see refreshed counts on the existing chat polling interval, not via new realtime events. Old clients may ignore the added fields.

Calling is NOT a finished or released feature. This change provides backend eligibility, reservations and call lifecycle plus AWS adapter and Admin-only playback UI. No phone button, native Chime audio bridge, CallKit/PushKit, Android Telecom/FCM call integration, device call-token registration, or live end-to-end call has been delivered. Do not enable calls for production yet.

## Voice backend implemented

- Ordinary trips resolve the actual passenger from verified riderPhone; riderId is never a fallback for bookings on behalf. Missing/ambiguous passenger account fails closed.
- Partner trips resolve the assigned dispatcher, including its Rider account alias. Managers/bookers have no call rights unless themselves the assigned dispatcher.
- Database reservations cover every account alias, across trips and devices. Independent pairs may reserve concurrently. First accepting device wins; others cannot fetch join tokens or hang up that device's call.
- Both creation and acceptance require a recording-consent flag; the native UI must still show the recording notice before collecting consent.
- Join credentials remain server-only until capture and concatenation pipelines are allocated. Recording allocation failure ends the call. Cleanup worker handles stale clients, ended trips and reassignment.
- Logs use ordinary TEXT messages for old-client compatibility. Recording-ready messages have audience ADMIN. Only the genuine ADMIN role (not STAFF) sees those messages, receives their push, or fetches a 60-second signed playback URL. Playback is audited.
- Calling AWS clients explicitly use EC2 instance metadata credentials, bypassing old upload keys; existing S3 clients and production .env were not changed.
- Default off unless TRIP_CALL_ENABLED is exactly true. Configuration when eventually ready: TRIP_CALL_AWS_REGION=ap-southeast-1, TRIP_CALL_RECORDINGS_BUCKET=goviet247-prod. SDK dependencies and pnpm lockfile updated.

## Validation

441 tests passed, 0 failed, 0 skipped, including real PostgreSQL concurrency/authorization tests on disposable localhost database goviet247_test, port 55487. AWS media operations in those tests were mocked: this does not prove AWS pipeline creation, native audio, ringtone delivery, recording contents or recording playback on a phone.

TypeScript checks passed for all three mobile apps. Both web and Partner web production builds passed using Node 24. Existing large bundle warnings remain. No production deployment, EAS build or Store submission was performed.

The disposable database from the previous audit had a schema but no migration history, so migrate deploy returned P3005. The two new SQL migration files were then applied transactionally to that local test database using psql; all tests passed. No reset/baseline action was attempted on any production database.

## Deployment dependencies

Hearts require the API schema migrations and generated Prisma client before releasing updated API/web/mobile clients. Follow the existing deployment process and confirm the production migration history first. Do not run a reset command against production.

Migrations:
- 20261106110000_chat_hearts
- 20261106111000_trip_calls_foundation

Calls must stay disabled until native call UI, audio SDK bridge, push credentials, incoming token registration and real-device tests are complete. Use a supported Node runtime for the new AWS SDK dependencies. API must run directly on the EC2 instance (or have working instance metadata access if containerized).

## Remaining voice work

1. Locate existing APNs signing key in Apple Developer → Certificates, Identifiers & Profiles → Keys, and determine which existing key supports the required apps/VoIP topics. Do not revoke working chat push credentials. Keep .p8 content out of chat and source control.
2. Native Chime audio integration and in-chat call UI, incoming/outgoing screens, mute/speaker/hangup, reconnect and heartbeat.
3. iOS PushKit/CallKit and Android incoming-call delivery; register account/session-bound device call tokens, revoke them on logout, ring eligible devices only.
4. AWS smoke test for capture, concat, exact final key layout and cleanup, including failures during provisioning. Recover resource allocations that succeed at AWS but fail before their IDs are persisted.
5. Finalize recording retention and configure S3 lifecycle limited to call-recordings/ (30 days was proposed, not configured). Test private playback and audit; no broad public access.
6. Test background, terminated app, two phones, busy, declined/missed, trip reassignment/completion, lost network, revoked login and actual audio recording/consent on both iOS and Android. Raise AWS pipeline quotas as needed before rollout.
