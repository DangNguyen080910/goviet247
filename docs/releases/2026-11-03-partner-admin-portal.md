> Update: see 2026-11-03-completed-chat-web-parity.md for the completed-trip support policy and deferred Partner-portal Admin entry.

# GoViet247 Admin entry in Partner portal

The Partner login page now has separate Partner and GoViet247 administration choices. Administration reuses POST /api/admin/auth/login with the existing username/password; it does not require a company code and does not create a Partner member or duplicate administrator account. Only ADMIN accounts are accepted by this portal choice. API authorization independently checks the current active Admin record on every Partner request.

GET /api/partners/me now returns the validated Admin identity for superAdmin sessions, allowing reload/session restoration. The portal retains its own existing Partner token key and does not overwrite the main Admin website's token/user keys. Admin sessions retain the existing Admin JWT expiration policy; Partner remembered-login cookies and renewal do not extend Admin tokens.

The Admin portal embeds the existing Partner management console with explicit token/user props. The ordinary Admin page still falls back to its own existing session helpers. The embedded console provides company selection, trips, support booking with a required active dispatcher, employee management, settings/history and Partner creation. A persistent banner identifies the selected company and the header identifies the GoViet247 administrator. Support bookings and changes continue to use server-side GoViet247 audit attribution. Switching companies remounts the company panel to clear previous-company form/detail state. Closing a successful support-booking dialog returns to the trip tab.

Admin chat uses the validated Admin identity and its existing access to conversations; its floating launcher uses the administration layout. Ordinary Partner login, company scoping and remembered-session behavior remain intact.

## Validation

- 28 focused Admin login, Partner authorization/workflow and Partner session tests passed.
- 22 real local HTTP checks passed against disposable PostgreSQL: existing Admin credentials, restored Admin identity, two companies, audit attribution for company updates and support booking, correct selected-company booking scope, foreign dispatcher rejection, Staff/Partner isolation, wrong password and revoked Admin rejection.
- Both production web builds and git diff --check passed. No production account/database was modified and no new administrator account was created.
- The Partner workflow test harness now mocks the existing chatStoragePolicy import; production chat storage behavior was not changed by this task.
- Browser/device visual testing and production deployment were not performed.

## Deployment/use

Deploy API and both web builds because shared Partner management/chat/booking components changed. This change requires no migration, environment variable or mobile build.

At partners.goviet247.com choose “Quản trị GoViet247”, enter the same Admin credentials used on the Admin website, then select the company to support. Partner employees keep using the “Đối tác” choice and their own company/member credentials.
