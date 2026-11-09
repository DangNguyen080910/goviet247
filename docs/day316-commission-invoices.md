# Daily commission invoice processing

Deploy database migration 20261108090000_commission_invoice_tracking before the new API; generate Prisma client and restart the API. Migration backfills completed trips with their current updatedAt and flags those timestamps as estimates. Verify historical dates with accounting before processing old commissions. New completions get an immutable recognition timestamp from the database trigger.

Commission filters and Excel/PDF accept day=YYYY-MM-DD in Vietnam time; month and quarter remain available. VIN basic import preserves 27 columns, fills MST and CCCD as text, buyer name and address, numeric VND amounts. Invoice export includes only unconfirmed positive commissions and blocks missing identity/fee data. Downloading does not issue invoices. Verify VAT, payment method, assigned invoice date and historical treatment with accounting; do not backdate automatically.

After actual issuance in VIN, record invoice number/reference and actual issue date per trip. This is a manual confirmation, not a VIN integration. Existing invoices must be reconciled and confirmed to avoid duplicate processing. Confirmation never changes Trip.updatedAt. Other accounting reports retain their prior date rules and may differ for historical trips.

The running API checks every minute, starting at 21:00 Asia/Ho_Chi_Minh. It persists at most one daily alert across replicas using a transaction advisory lock, and pushes to registered admin devices. Alert and push link to the daily list on Web/Mobile. No pending invoices means no alert. API downtime delays the reminder until restart that evening; missed prior days appear as backlog. Device permissions and push transport affect delivery.

Trips after 21:00 remain pending in the refreshed list and in the next reminder backlog; the first daily notification is not a complete final-day count. Reading an alert is separate from confirming an invoice. No automatic invoice signing, tax submission or issuance is performed.

## VIN payment method verified 2026-11-09

The legacy template comment for payment code 5 is outdated: VIN renders it as Không thu tiền. A one-row basic-template test rejected the literal text TM/CK/Bù trừ, but numeric code 20 updated the existing draft and rendered TM/CK/Bù trừ. The successful response was 0 created, 1 updated, 0 duplicate. Net 65,000 + VAT 5,200 = gross 70,200 remained unchanged. No signing or issuance was performed.

All future invoice exports now put numeric 20 in column M. Existing stable invoice identifiers remain unchanged. Do not blindly reimport prior drafts: the test also showed VIN resets the draft issue date to the import date (2026-11-09), even when it updates the same invoice. Review the accountant-approved issue date before bulk import. Re-exporting a file does not update any VIN draft automatically. No DB migration or new dependency is required for this correction.
