# Partner contacts linked to verified Rider accounts

PartnerMember now has a normalized Vietnamese mobile phone field, unique within a company. New members require it. The first company admin receives the management number by default. Existing first admins are seeded by the migration; other existing employees must supply their own mobile number through the member editor.

New bookings retain partnerManagerName/Phone and partnerBookerName/Phone snapshots for the two Admin columns. Original passenger name/phone and riderId remain empty for Partner bookings. The management and booking employee snapshots are not returned by driver serializers. Existing partner trips are backfilled from their company and creator/assigned member where available; initially missing employee snapshots are filled when their phone is first supplied.

## Authorization and notifications

- A Rider account must own a Phone row with isVerified=true (existing OTP flow).
- Current company management phone grants its company trips; an active member phone grants trips created by that member. GoViet247 support-created trips use the assigned member when there is no partner creator.
- A phone change or member/company disable removes the former mobile access. Snapshots are historical display data, not authorization inputs. Generic riderPhone/riderId never grant access to Partner trips.
- Authorized linked Rider users can read the trip list/detail, chat and unread inbox, and self-cancel only while awaiting approval. Existing company web admin/assignee permissions remain.
- Chat uses the same trip/thread. Linked Rider users act as PARTNER chat participants, see PARTNER system notices and never see DRIVER-only notices. Driver access still begins with acceptance and retains the acceptedAt history cutoff.
- Phone/user recipient sets are deduplicated. Manager self-booking yields one Rider recipient. Chat push, trip-status push, saved status notices and Rider socket updates address both verified management and booking accounts. Device permissions and valid push registration remain required.

## Deployment

1. Apply migration 20261103030000_partner_rider_contacts and generate Prisma Client before restarting the updated API. This migration is additive and backfills existing Partner contact data.
2. Release API and both web builds. Existing employee records lacking a phone must be completed before they book new trips.
3. Management/staff sign in to the Rider app with their matching mobile number using OTP. There is no Partner-password login inside Rider; it uses the existing Rider authentication.
4. The app/server changes from the earlier self-service/chat-alert batch remain part of the pending release. In particular the mobile sound/notification improvements require the updated mobile apps.

## Validation

- Migration ran successfully against an older disposable PostgreSQL schema and seeded initial admin contacts/backfilled existing trips.
- 44 real local HTTP checks plus database assertions passed: verified/unverified phones, management/creator scope, unrelated employee denial, shared chat from both mobile identities, driver joining after acceptance, private notice audiences, absence of management/employee phones in driver response, two saved notification targets, same-person deduplication, cancellation, phone change and disable revocation.
- No production database, real account, device push or external server was modified. Device delivery must still be checked on actual phones after deployment.

- Focused Partner/Rider/chat tests: 45/45 passed. Rider TypeScript check and both production web builds passed; git diff --check passed.
- Broader suite: 129/130 passed. Existing driver-accept-ui test harness fails with tripAcceptFeedback is not defined; unrelated to this contact linkage.
