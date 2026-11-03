# Use goviet247-prod for private chat media

Requested existing bucket: goviet247-prod, ap-southeast-1. Screenshot account: 122610490382. Screenshots show bucket-owner-enforced Object Ownership, and public GetObject allowed only on public/* and system-config/*. Keep those two statements and existing Block Public Access settings unchanged; switching on all four flags could break existing public assets.

1. In Create folder enter trip-chat (without trailing slash). Folder creation is optional; uploading the first object creates the prefix.
2. Permissions > Bucket policy > Edit: save a backup, then use docs/goviet247-prod-chat-bucket-policy.json, provided the existing policy still matches the two statements in the screenshot. If additional statements have since been added, preserve them and append only KeepTripChatPrivateToGoViet247Account. The new Deny applies only to trip-chat/* for anonymous and all other-account principals. It does not grant access to account users: they still need IAM authorization. BE must use an identity belonging to account 122610490382; presigned URLs signed by that identity continue to work.
3. Ensure the BE identity has docs/goviet247-prod-chat-iam-policy.json permissions. This is an IAM identity policy, not the bucket policy.
4. Add to the server API's persistent environment/.env:

TRIP_CHAT_AUDIO_BUCKET=goviet247-prod
TRIP_CHAT_AWS_REGION=ap-southeast-1
TRIP_CHAT_STORAGE_MODE=shared-prefix
TRIP_CHAT_AWS_ACCOUNT_ID=122610490382

5. Deploy the BE code including shared/chatStoragePolicy.js and services/tripChatService.js. Restart its PM2 process with the existing deployment workflow and updated environment. No new mobile build is required just for storage setup.
6. Send voice/photo and replay from another authorized participant. Test Admin deletion. An ordinary unsigned S3 object URL for a newly uploaded trip-chat object must return AccessDenied, while existing public/system-config asset URLs must still work. No production AWS requests or permission changes were executed in preparing this guide.

The backend keeps its existing fully-private-bucket path. Shared-prefix is explicitly enabled and verifies a strict Deny policy covering all of trip-chat/* and confirms the expected bucket owner through the S3 request. Missing/malformed/weakened policies fail closed. Do not remove the privacy check or grant public read to trip-chat/*.
