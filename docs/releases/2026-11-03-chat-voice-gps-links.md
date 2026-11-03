# Chat voice, GPS and map-link follow-up

Shared mobile changes (Rider, Driver, Admin):
- Restore visible Rider Trip-chat tab with explicit Ionicons chatbubbles icons on iOS and Android; hide the tab bar within the conversation.
- Wait for active foreground after microphone permission before preparing the recorder. Retry the specific transient iOS audio-session/background error once, clean up failed recorders, and suppress local chat alert audio while preparing/recording. No background recording is enabled.
- Stop preview playback before voice upload. Preserve draft and clientId on upload failure; guard late completion after leaving the conversation.
- Gửi định vị sends the current GPS fix once on a user tap. Address autocomplete and arbitrary pin selection were removed from the shared mobile chat UI. Existing LOCATION messages remain readable. This is not live tracking or proof that client coordinates cannot be manipulated.
- Plain HTTP/HTTPS links become tappable without executing other schemes. Map universal/app links are passed unchanged to the OS; the installed associated app opens if supported, otherwise the browser handles the link. No map-link expansion or external content fetching is performed by GoViet247.

Android upload failure screenshot is a server configuration failure: TRIP_CHAT_AUDIO_BUCKET is missing. Images use the same private bucket. No mobile rebuild can resolve this server setting. AWS CLI access currently fails with InvalidClientTokenId, so no production infrastructure was created or changed.

Backend S3 region can now use TRIP_CHAT_AWS_REGION, falling back to AWS_REGION. This allows chat storage to use its own region without changing other AWS services.

## Create storage in AWS console

1. Open https://console.aws.amazon.com/s3/ in the same AWS account as the GoViet247 backend. Choose Create bucket.
2. General purpose; region Asia Pacific (Singapore), ap-southeast-1. Suggested bucket name: goviet247-trip-chat-private. If unavailable choose another unique name and replace it consistently below and in the policy file.
3. Object Ownership: ACLs disabled / Bucket owner enforced.
4. Keep Block all public access enabled (all four checks). Keep Versioning disabled initially and Object Lock disabled so Admin deletion can work normally.
5. Default encryption: SSE-S3 (Amazon S3 managed keys). Leave other settings at their defaults, then Create bucket. No public bucket policy, website hosting or CORS rule is needed for the current BE-proxied uploads.
6. Grant the identity actually used by the BE the policy from docs/goviet247-trip-chat-s3-policy.json. Do not grant public access. Prefer the EC2 IAM role: EC2 > Instances > backend instance > Security > IAM role; open the role in IAM and add an inline policy. If no role exists, create an IAM role trusted by EC2 with this policy, then EC2 > Actions > Security > Modify IAM role. If the backend already uses explicit AWS credentials, its IAM user/role needs these permissions instead; an attached EC2 role does not override explicit credentials.
7. On the server add to the API .env (or the deployment's persistent environment configuration):

   TRIP_CHAT_AUDIO_BUCKET=goviet247-trip-chat-private
   TRIP_CHAT_AWS_REGION=ap-southeast-1

   Keep existing AWS_REGION and credentials unchanged. Never put AWS keys in the mobile apps.
8. Deploy the backend region fallback change, then restart only its PM2 process using the existing deployment process, e.g. pm2 restart goviet247-prod-api --update-env. Check that the deployed API loads .env and that any stale process-level bucket/region values do not override the intended settings.
9. Test sending a short recording and a photo, receiving and replaying on a different authorized account, and Admin deletion. Check new objects exist under trip-chat/. Keep all four Block Public Access switches ON.

Use AWS's storage/request/transfer billing to monitor actual usage. Set retention policy separately after deciding how long chat evidence should be kept; no automatic expiry is added in this change.

## Validation and release

All three mobile TypeScript checks and regression tests for iOS permission recovery, bounded retries, permission denial, navigation cancellation, GPS, links, voice upload failure retention, keyboard layout and sound deduplication pass locally. Real iOS/Android microphone and S3 end-to-end upload tests remain required after configuration.

Rebuild all three mobile apps. Deploy the backend change if using TRIP_CHAT_AWS_REGION. No release/build/deployment was performed here.
