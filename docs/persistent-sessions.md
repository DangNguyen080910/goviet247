# Persistent Rider / Driver sessions

Source changes only; deploy backend and updated clients before enabling.

## Server rollout

1. Back up the database. Apply the new migration with `prisma migrate deploy` using the API schema, then `prisma generate`.
2. Deploy the API and set `JWT_EXPIRES=never` in the server environment. Keep `JWT_SECRET` unchanged. Keep `ADMIN_JWT_EXPIRES` bounded (for example `30d`); Admin does not use persistent sessions.
3. Restart the actual PM2 application with `--update-env` if its environment is supplied by PM2. If the application reads a dotenv file, ensure the deployed process reads the file you edited. Verify the effective behavior through login rather than printing secrets.
4. Deploy Rider Web and release the updated Rider and Driver mobile builds.

Updated clients opt in with `X-Session-Mode: persistent-v1`. Old clients still get finite JWTs (30 days when the global setting is `never`) because they cannot revoke server sessions on logout. Valid old tokens are upgraded on `/auth/me` in updated clients without another OTP. Already expired or missing tokens cannot be upgraded.

The new JWT has no `exp`, but every authenticated HTTP request checks its persisted Session record and SHA-256 token hash. `expiresAt = NULL` means persistent; epoch means revoked. Logout revokes only that login, including the legacy token it was upgraded from. Concurrent upgrades are idempotent. Database outages produce a retryable response, not a credentials-expired response. There is no timer-based refresh flow.

Logout requires a successful server response (or confirmation that credentials are already invalid). Offline users retain the local session and see a retry message. App updates and PM2 restarts preserve login provided app storage, database and JWT secret remain intact. Uninstalling, clearing storage, changing the signing secret or explicitly revoking sessions can still require OTP.

Changing the setting back to `30d` changes future issuance, not existing persistent sessions. Revoke selected Session rows by setting expiresAt to the current time if required. Do not delete legacy revocation records before the original legacy JWT expires.

## Scope and remaining constraints

This change covers user HTTP token validation, device registration and explicit logout in the three updated clients. Admin authentication remains separate. Existing Socket.IO registration uses user ids rather than these HTTP tokens; this change does not add socket authorization or disconnect every remote socket upon revocation. Account deletion now revokes registered sessions, but its pre-existing phone anonymization/deletion implementation needs a separate correction; unregistered legacy JWTs retain their original expiry.

Before rollout, test a real-device upgrade with a still-valid saved login, restart the API, log out and confirm the prior token returns 401. Test network loss during startup and logout. Local automated checks do not replace this deployment smoke test.
