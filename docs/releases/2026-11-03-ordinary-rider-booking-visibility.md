# Ordinary Rider booking stays independent of Partner choices

The company/personal selector is rendered only after account verification finishes successfully, with a non-empty signed-in user ID and a non-empty active Partner company list. Guests, ordinary signed-in Riders, loading/error states and stale company data cannot display the selector. Ordinary users still enter the trip route and passenger details directly.

Personal-booking confirmation remains restricted to linked Partner accounts. An ordinary/guest payload omits bookingCompanyId when serialized, preserves the passenger name/phone and is saved as a normal trip. The server independently rejects an unauthenticated or unauthorized company selection. Old company permissions that were revoked still require an explicit confirmation before switching booking context; this is not displayed as the company selector for ordinary users.

## Verification after the TestFlight report

- 22 focused UI, effect lifecycle, serialized payload, Partner authorization and quote refresh tests passed. Coverage includes guest bypass of profile/company lookups, ordinary Rider default, late response cancellation after account switch, Partner remembered personal mode, hidden stale/loading company UI, and skipped personal confirmation for unlinked users.
- 105 real local HTTP checks plus DB assertions passed. Specific ordinary/guest checks created actual trip rows with no company/member association, no Partner audit entry, preserved passenger data and RIDER booking notices; unauthenticated forged company booking was rejected.
- Rider TypeScript and the locally exported Rider iOS bundle passed after the UI fix. No production code was changed during the follow-up recheck; only regression tests/documentation were added.
- No EAS build, paid/cloud build, production deployment or real account/data change was performed. The UI change requires the updated Rider app/bundle; the old installed TestFlight binary will not change automatically. Admin/Driver/web/API do not require another build specifically for this visibility fix.
