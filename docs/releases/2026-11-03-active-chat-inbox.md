# Chat inbox contains only unfinished trips

GET /api/trip-chat/conversations now excludes COMPLETED and CANCELLED for every actor, including GoViet247 Admin/Staff. The condition is applied in the database query before the existing 200-row limit so archived trips cannot crowd active conversations out. A second guard after permission lookup also excludes a trip that ended during loading.

Returned unread totals sum only the remaining active entries. The shared Rider/Driver/Admin Mobile inboxes/badges and customer/Admin/Partner web inboxes use this endpoint, so they pick up the filter on their next existing refresh. No frontend change or mobile/EAS build is introduced by this filter.

Messages are retained. Direct authorized Admin history access remains available, read-only for ended trips. Non-admin history/media restrictions remain unchanged. This hides conversations from the inbox; it does not delete or alter the archived messages.

Validation: 27 focused filtering/navigation/authorization tests passed. 12 real local HTTP checks plus DB assertions passed with all four roles and 205 additional archived trips; active rows remained visible, terminal rows/unread were absent, non-admin direct reads stayed denied, Admin direct history remained readable and message row counts were unchanged. Syntax and git diff --check passed.

Deploy API only for this filter; no migration or environment change is required. The separate inbox-button fix still requires its frontend/mobile update. No production deployment, data mutation or EAS build was performed during this task.
