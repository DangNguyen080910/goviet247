# Review-only self-cancellation, booking chat and alerts

## Behavior

- Rider and partner self-cancellation requires PENDING, no approval flag/timestamp, no driver and no cancellation timestamp. Existing ownership/tenant/assignee checks still apply. Rider cancellation uses a conditional database update so approval winning a race prevents cancellation; partner cancellation rechecks while holding the trip row lock.
- Rider web/mobile hide self-cancellation after approval. Partner grid and details show cancel while in review; separate labels and filters distinguish review from awaiting driver acceptance.
- Rider/partner chat opens at booking, before approval or driver assignment, for support with GoViet247. Driver access still requires their assignment, and the acceptedAt history fence remains in place. Existing private-audience filters, phone-number blocking and media checks remain active.
- Booking writes a private SYSTEM/TEXT notice to RIDER or PARTNER plus GoViet247 in the same booking transaction. It explains the review state and invites requests in chat. Its stable per-trip key prevents duplicate notices for the same trip. Both authenticated creation and public OTP booking use the shared booking service.
- Web booking success offers a direct chat action; native Rider success offers chat or trip history.

## Alerts

Web: reuses/resumes an AudioContext after a user gesture instead of creating a suspended context for every beep; a visible enable-sound/notification prompt and incoming-message notice are included. Per-conversation message IDs detect incoming messages even when the overall unread count does not increase. Inbox polling is still 10 seconds and message polling follows the existing open-chat interval. Desktop notification clicks focus the tab and open the conversation. Browser permission and an open page are required; there is no closed-tab Web Push implementation in this change.

Mobile: bundles an original short WAV sound as an in-app foreground fallback; per-message gating deduplicates foreground polling versus push playback. Incoming chat while the same conversation is visible no longer disables sound outright. Background alerts continue through the existing Expo push worker and notification channels; permissions, system volume/channel settings and valid device registration are still required. The app must be updated to receive the new in-app sound and controls. No real device playback or external push was tested.

## Release

Update API and both web builds. Release Rider mobile for its cancellation controls, booking chat action and sound behavior; update Driver/Admin mobile for the shared alert improvements. No new schema migration is introduced; previous partner/private-chat migrations must already be applied. Existing API privacy and device-session checks remain required. Production has not been deployed by this task.

## Verification

- 52 focused chat, permissions, booking, media-route and native-linking tests passed; 10 focused self-service/sound tests passed (overlapping selection).
- 23 HTTP requests plus real isolated PostgreSQL assertions passed: initial notice/unread, pre-assignment chat, unauthorized participants, cancellation before/after approval, partner filters, and approval winning a simultaneous rider cancellation.
- Both web builds passed; modified mobile TS/TSX parses.
- Root regression suite plus shared/mobile tests: 125/126 pass. The remaining pre-existing driver-accept-ui test harness lacks tripAcceptFeedback.
- No production database, external push, account or server configuration was changed. Physical-device and browser audio permission QA remains to be performed after release.
