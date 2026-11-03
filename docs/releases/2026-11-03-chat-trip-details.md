> Update: see 2026-11-03-completed-chat-web-parity.md for the completed-trip support policy and deferred Partner-portal Admin entry.

# Full trip codes and direct details from chat

Chat inbox entries and conversation headers now display the complete case-sensitive trip ID instead of the final eight characters. The web new-message banner and API chat push title also use the full ID. Long IDs wrap; native conversation/detail IDs can be selected and copied.

Both inbox entries and open conversations have “Xem chuyến”. It fetches the trip directly by ID and opens a read-only detail panel, so no trip-list filter, pagination or status-tab lookup is required. The panel shows status, schedule, car type, complete itinerary, return leg, distance, price and Partner company where applicable. It includes loading/error/retry and returns to the current chat without losing it. Request sequencing prevents an older response from replacing a newer selected trip or reopening a dismissed panel.

This is a direct detail view within chat; it does not open the existing edit/approval forms. Trip management actions remain in the existing management screens.

## Authorization/privacy

GET /api/trip-chat/:id/trip uses the existing chat authentication and ownership/company/assignment checks, with a server-only allowEnded option for read-only details. Completed/cancelled trip details may be read by authorized participants, while existing ended-chat restrictions remain unchanged for messages/media. Callers cannot turn on allowEnded through a request parameter.

The response is explicitly allowlisted and omits rider/Partner contact numbers, driver identity/contact/vehicle fields, internal notes and payment secrets. Changing the selected trip cannot grant access to another company's trip. Unknown or unauthorized IDs show the appropriate error. Driver access continues to require the existing assigned-driver and profile checks; no replacement-driver history permission was added.

## Surfaces and deployment

- Shared apps/mobile-chat/TripChat.tsx supplies Rider, Driver and Admin Mobile, so all three apps need the updated release despite the individual screen wrappers being unchanged.
- Shared TripChatHub supplies customer web, Admin web and Partner web, including the GoViet247 Admin Partner portal.
- Deploy the API before the two web builds, and release all three updated mobile apps. No new migration, environment setting or package dependency is needed for this feature.

## Validation

- 18 focused detail serialization/presentation and Partner authorization/workflow tests passed, including ended-detail access with default ended-chat denial and unrelated-account/company denial.
- 81 real local HTTP checks plus database assertions passed using disposable PostgreSQL: Admin, Rider-linked management/employee, Partner password login and Driver; pending/current/completed/cancelled details; unknown/unauthorized IDs; unchanged ended-chat denial and privacy allowlist; existing booking, chat, notification recipient, assignment and revocation flows.
- TypeScript checks passed for Rider, Driver and Admin Mobile. Both production web builds and git diff --check passed.
- No production deployment/data change, real push delivery or physical-device/browser visual testing was performed.
