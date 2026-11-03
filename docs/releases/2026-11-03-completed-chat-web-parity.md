> Superseded: 2026-11-03-release-readiness.md contains the final policy: completed chat is closed to all non-admin participants; GoViet247 administration retains read-only message history.

# Completed-trip support and consistent chat controls

This release supersedes the completed-chat closure policy in the earlier self-service/detail notes and defers the GoViet247 Admin entry on the Partner portal.

## Completed-trip support

- Rider web/mobile and Partner-side participants may continue messaging GoViet247 after COMPLETED, with a support notice and support-specific quick replies. Customer-facing completed trip chat buttons say “Hỗ trợ GoViet247”.
- Driver chat access, writes, media access and conversations are denied after COMPLETED/CANCELLED, including direct API calls; drivers receive no pending/new chat pushes for those statuses. Read-only trip detail access retains its existing permissions.
- Every message created while COMPLETED, including Admin replies and uploaded media, receives RIDER or PARTNER audience on the server. These messages stay hidden from drivers even if the trip is reopened. Existing accepted-at and private-audience filtering remains intact.
- Cancelled-trip customer chat remains closed. Existing ownership, verified-phone and company/assignment checks still apply.

## Web/mobile parity

- Web chat now imports the same safe HTTP(S) link parser used by mobile. Maps URLs and other supported web links are clickable; unsafe schemes and credential-bearing URLs remain plain text. Web links open separately; mobile retains native Linking behavior.
- Web location sending now matches mobile: request current device location and send it directly. Address search, manual place selection and the map-preview picker were removed from chat. The location remains a snapshot at send time, not live tracking. A pending GPS result is discarded if the chat changes before completion.
- Shared chat still provides full trip IDs, direct read-only trip details, images/camera, voice messages and draggable launchers.

## Partner sign-in

The active Partner bundle no longer imports/renders the Admin login entry or AdminPartnerPortal. The login form again contains company code, username, password and the existing Remember checkbox. An old GoViet247 Admin token in this portal is cleared with a request to sign in as a Partner. Existing GoViet247 Admin web Partner management/API authority is unchanged. The earlier Admin portal source is deferred/unreferenced, not a new hidden login mechanism.

## Validation/deployment

- 38 focused tests passed: completed/cancelled participant policy, driver exclusion from support pushes, Partner scope, voice/link handling, GPS send/permission denial/chat-switch race.
- 94 real local HTTP checks and DB assertions passed against disposable PostgreSQL. This includes completed support by Rider/Partner, Admin replies, verified passenger access, driver read/write denial, persisted private audience, and absence of support messages from driver history after reopening, plus existing booking/access/privacy/revocation regressions.
- Rider/Admin/Driver TypeScript checks, both production web builds and git diff --check passed. Actual device GPS permissions/map-app launching and browser UI were not exercised.
- Deploy API first, then web and web-partners; release all three mobile apps because chat is shared. No additional migration, environment setting or dependency is required specifically for these changes.
- No production deployment, production account/data changes or external device push was performed.
