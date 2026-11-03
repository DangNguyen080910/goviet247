# Rider: personal and Partner company booking

Rider booking now loads active Partner companies from the signed-in user's verified phone records. A user with multiple companies can explicitly select one. The first visit defaults to the first company (name/id order); later visits restore the last explicit choice from per-user device storage. The current mode remains visible at the top of the form. A saved company that is no longer available leaves the selection empty and blocks booking until the user selects again. Network errors block booking and provide Retry.

Company mode hides passenger contact fields and sends bookingCompanyId to the API. The API resolves the actual active member from verified phones, supplies the Partner company/creator/assignee internally, clears ordinary rider/passenger identity, and reuses existing Partner trip creation, stop creation, audit, chat, privacy and notification flows. It checks permissions again in the booking transaction. A manager must have an active Partner member record with the matching phone (initial company admins already receive this contact); otherwise booking returns an actionable setup error rather than assigning another employee.

Personal mode retains ordinary Rider booking and does not inherit Partner IDs. Linked Partner users must confirm the personal booking at submission. Mode changes invalidate the quote. Duplicate taps during confirmation are blocked, and the quote is checked again after confirmation.

## Validation

- 55 focused tests passed, including the new verified-phone company booking authorization tests and existing Partner/chat/car availability coverage.
- 59 real local HTTP checks plus DB assertions passed with disposable PostgreSQL schemas: mobile employee/manager company bookings, multi-company choice, normal personal bookings, spoofed company fields ignored, contact input removed for company trips, verified-phone scope, private chat notices, stop/audit creation, notification recipient deduplication, disabled-company/member rejection, and driver privacy.
- Rider TypeScript and git diff --check passed.
- No production deployment, production data changes, external push delivery, store build or physical-device UI/audio testing performed.

## Release

Deploy the API and release a new Rider Mobile build. This batch adds no database migration; the earlier Partner contacts migration and regenerated Prisma client remain prerequisites. Admin/Driver apps and web frontends do not need another build specifically for this booking-mode change. Their earlier pending changes remain separate release requirements.

On device, verify first default, remembered personal/company choice after restart, account switching, multiple companies, stale company permissions, personal confirmation/cancel, and company booking with no passenger contact form.
