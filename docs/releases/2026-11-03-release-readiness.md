# Release readiness — final terminal chat policy

Final decision: COMPLETED/CANCELLED conversations are closed to Rider, verified passenger, Driver and Partner (including Partner company admins). Only the GoViet247 administration side may read retained history. No participant, including GoViet247 Admin, may add messages after the trip ends. Read-only trip metadata/detail remains available under existing ownership/assignment rules.

Chat controls on customer web/mobile and Partner tables/details are muted after completion/cancellation; pressing them explains that chat cannot be read/sent and directs the user to GoViet247 support via Zalo. Platform Admin Partner management retains a history entry; it is distinct from Partner company administration. Messaging, read markers, media and inbox permissions are enforced on the server; terminal non-admin pushes are excluded. Uploads that finish after a trip closes are rejected and private objects cleaned up. Existing Admin audit/moderation history behavior remains.

This supersedes the completed-trip support-chat allowance in 2026-11-03-completed-chat-web-parity.md. GPS-only sending, safe clickable Maps/web links, full trip IDs, direct trip details and the Partner-only sign-in form remain unchanged.

## Completed verification

- Final full suite: 354 passed, 0 failed, 0 skipped, including 18 real PostgreSQL acceptance/wallet/concurrency integration tests using an explicitly isolated local goviet247_test schema.
- Final local API scenario: 101 real HTTP checks plus DB assertions; ended customer/Partner/Driver reads/writes denied, Admin history readable with canSend=false, ended conversations absent from non-admin inboxes, platform Admin Partner history available, unauthorized/unknown detail IDs denied, existing booking/contact/private-message/assignment/revocation paths preserved.
- TypeScript passed for Rider, Driver and Admin Mobile.
- Native dependency/autolinking checks passed for all three apps on iOS and Android.
- Latest source exported six production JS/Hermes bundles (three apps × iOS/Android) successfully. These are not signed IPA/AAB builds.
- Production builds for web and web-partners passed; git diff --check passed.
- Earlier failing checks were repaired as stale test fixtures/harness dependencies, not by bypassing product authorization. Added explicit completed-image-upload rejection/cleanup coverage.

## Production checks (read-only)

- API /health returned ok; Partner CORS preflight accepted the exact Partner origin, credentials and X-Session-Mode header.
- Existing API process was online. Chat bucket/region were configured and the deployed private-bucket policy check passed (read-only AWS checks, not an upload).
- Required Partner phone/contact snapshot columns were present (5/5), inspected via information_schema only. No production customer data was read for this audit.
- No production deployment, restart, migration, wallet mutation, upload or real device push was performed.

## Rollout

1. Deploy the final API, then web and web-partners.
2. Build/sign all three mobile apps through the normal EAS workflow. Production profiles have autoIncrement enabled. Native directories are ignored/untracked in this checkout; the checked-in app configuration/plugins define permissions/dependencies for cloud prebuild.
3. Submit first to TestFlight/internal Android testing and exercise a real iPhone/Android before public release: Partner/personal booking; accept/chat/full trip link; voice/image/camera/GPS; map-link launching; foreground/background sounds and notification taps; complete trip and verify all three non-admin sides are blocked while Admin history stays read-only.
4. Release publicly after those device checks. No additional migration is introduced by the terminal-chat policy itself. API/media configuration readiness does not replace testing real uploads and device permissions.
