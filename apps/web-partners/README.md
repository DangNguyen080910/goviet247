# GoViet247 Partner Portal — initial version

One app serves all companies at the proposed host `partners.goviet247.com`.
The hostname is a deployment target; this change does not provision DNS or deploy anything.

## Routes

| Path | Purpose |
| --- | --- |
| `/dang-nhap` | Company code, username and password |
| `/dat-xe` | Booking using the existing web booking component |
| `/chuyen-xe` | Paginated trip grid, filters and unread chat counts |
| `/chuyen-xe/:id` | Trip details, assignment, chat and pending cancellation |
| `/nhan-vien` | Company admin member management |
| `/cai-dat` | Logo, password and company admin audit history |

Existing GoViet247 ADMIN accounts manage all companies at `/admin/partners` on the Admin web.
STAFF accounts have no partner management access. No second GoViet247 admin account is required.

## Local setup

Use Node 22.12+ (validated with 22.22.2) and the repository's pnpm version.
From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @goviet247/api exec prisma generate
```

Apply migrations to the intended **local/development** database using the existing project procedure.
The new migration is `20261102080000_partner_portal`. Never run reset against an existing database.

Copy `.env.example` to `.env.local` in this app and set `VITE_API_BASE` if needed.
Run the API normally, then `pnpm dev:partners`; the portal uses port 5174.
Add `http://localhost:5174` to the API's configured `CORS_ORIGINS` if it has an explicit allowlist.
Create a company and its first admin through the existing Admin → Đối tác screen.
The initial password must be changed before booking, chatting or managing staff.

## Production deployment

1. Review and back up the target database through the normal deployment procedure.
2. Install locked dependencies and generate Prisma Client.
3. Apply migrations using `prisma migrate deploy` as part of the normal release.
4. Build and release the API, Admin web and partner web together.
5. `.env.production` supplies `VITE_API_BASE=https://api.goviet247.com` for normal production builds. Override it only with an intentional HTTPS API origin. Production builds reject missing, HTTP or loopback API URLs; development still uses localhost.
6. Serve `apps/web-partners/dist` with HTTPS and SPA fallback to `index.html` for all application paths.
7. Provision DNS/TLS for `partners.goviet247.com` and append that exact origin to API `CORS_ORIGINS`.
8. Build/release driver-mobile to show partner labels and the company greeting. Older apps can still use existing chat, but do not show the new partner-specific labels.

Login has a bounded in-process throttle. Keep the deployment gateway's login rate limit enabled for multiple API instances.
Existing private chat media storage configuration remains required for image/audio messages.
No production migration, DNS update, account creation, mobile submission or deployment is performed by this change.

## Data and permissions

- Management contact lives on `PartnerCompany`; new trips keep partner contact snapshots for Admin columns.
  Verified management/creator phone accounts can now access their authorized Partner trips through Rider (see `docs/releases/2026-11-03-partner-rider-contacts.md`). They are never copied into the raw passenger `riderPhone` or exposed to drivers.
- Partner trip passenger name/phone are always empty. Notes reject phone numbers using the existing chat rule.
- Trip creation reuses the existing validation, fare calculation, booking availability lock, approval and notification flow.
  Company metadata, creator, assignee, stops and creation audit are saved with the booking transaction.
- The company code scopes usernames; member queries cannot override their company with request parameters.
- Company ADMIN manages members; DISPATCHER handles their assigned trip's chat and assignment/cancellation.
  Members can see their company's trip grid; only assigned dispatchers and company admins can access active chats.
- Disabling a member keeps records. Move open assignments first; at least one active company admin must remain.
- Password changes, resets and logout invalidate previous partner tokens by version. Disabled companies cannot log in or book.
- Active trip responses expose vehicle attributes without the driver's phone. Completed/cancelled responses omit vehicle data.
  Partner chat closes at trip completion/cancellation, following the customer-side chat policy.
- Existing GoViet247 ADMIN performs support under their own identity; partner audit records that identity.
- UI components currently share code directly from `apps/web` (the booking form, chat and partner console),
  following the repository's existing shared-source pattern. They are not copied. They can be extracted to a UI package later.

## Validation and remaining live checks

The new access/workflow tests cover tenant scope, scoped tokens, revocation, chat handover,
terminal-state privacy, booking identity override and safeguards around admin/member changes.
Run from the root:

```sh
node --test tests/partner-access.test.mjs tests/partner-workflows.test.cjs tests/booking-route-refresh.test.cjs tests/session-safety.test.cjs tests/trip-time.test.mjs
pnpm build:partners
pnpm --filter goviet247-web build
```

The implementation was also exercised against a disposable local PostgreSQL database with 31 real HTTP checks: company creation, first password change, member permissions, fare/booking, company isolation, driver chat, handover, terminal privacy and account/company revocation. No production data was used.

Full repository test run: 92/93 pass. The existing `driver-accept-ui.test.cjs` case for ordinary acceptance errors fails because its harness does not supply `tripAcceptFeedback`; this also fails on the unchanged baseline. Existing web ESLint configuration cannot load its recommended preset in the installed environment. Both web production builds pass.

Before production, complete the remaining end-to-end checks with a development PostgreSQL database,
two companies, an assigned driver and private chat media storage. Verify initial password change,
booking/approval/acceptance, chat and handover, account disable and completed-trip privacy.
The generated migration is additive; existing trips have null partner fields.
