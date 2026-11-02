# Private acceptance reminders

On successful driver acceptance, the existing acceptance transaction now creates two TEXT chat notices from Hệ thống GoViet247:

- Rider bookings: one RIDER notice and one DRIVER notice bound to the accepting driver's user ID.
- Partner bookings: one PARTNER notice and one DRIVER notice that directs the driver to dispatch chat.
- GoViet247 chat admins see both, with audience labels in the web and shared mobile chat UI.

Ordinary chat remains shared. Initial reminders create conversations and unread counts before either side sends a message. The existing chat worker delivers mobile push notifications only to the eligible audience; web and partner web use the existing inbox polling/browser notification mechanism. Browser notifications still depend on permission and the page being open.

The message filter applies to history, previews, counts, pagination cursors, read acknowledgements and media access. The partner trip-grid unread count uses the same audience rule. Driver reminders are bound to the accepting driver, and the existing acceptedAt boundary prevents a replacement driver from reading an earlier assignment's conversation.

Creation is atomic with acceptance and wallet deductions. Keys use the accepted trip version and timestamp; retrying the same event cannot duplicate messages. A genuine later acceptance creates another pair. Delayed pushes for an acceptance that is no longer current are discarded. No historical backfill is performed.

## Release

Apply `20261102090000_private_acceptance_chat` after the partner-portal migration and regenerate Prisma Client. Release/restart all API instances together before accepting new trips; an old API instance does not know how to filter private rows. No mixed-version API rollout should serve chats after private messages start being created.

The notices use kind TEXT, so existing installed apps can display their contents after the API/database update. Updating web and mobile adds explicit audience labels for admins. No production migration, external notification, deployment or mobile submission is performed by this source change.

## Validation

`node --test tests/trip-acceptance-chat.test.mjs tests/partner-access.test.mjs tests/partner-workflows.test.cjs`

Also exercise real PostgreSQL/API acceptance, both audience views and unread counts, unauthorized read/cursor requests, reassignment, and transaction rollback if notice persistence fails. Existing repository-wide baseline has one unrelated failure in `driver-accept-ui.test.cjs` (its harness omits tripAcceptFeedback).

Validation performed on 2026-11-02:

- 11 new acceptance-chat unit tests pass; focused chat/partner/session selection: 51/51 pass.
- Real isolated PostgreSQL/API test: 25 HTTP checks plus database assertions pass, including hidden history/cursor/read filtering, per-side unread counts, partner grid, repeated acceptance, replacement driver, push recipients and rollback of wallet/acceptance when a database trigger rejects notices. No external push was sent.
- Applied the additive migration to an older disposable schema; existing chat messages retained audience ALL.
- Both Admin/customer web and partner web production builds pass; shared mobile chat TSX parses and native-linking tests pass.
- Full repository + mobile-chat tests: 105/106 pass, with only the pre-existing driver-accept-ui harness failure described above.
- Production database and deployment were not changed.
