# Session persistence audit — 2026-09-08

Scope: API, Rider Mobile, Driver Mobile, customer web, admin web and Admin Mobile in this repository. This is a source review, not verification of the deployed server configuration or installed app versions.

## Changes

- Rider and Driver bootstrap retain saved credentials on network failures, 5xx responses and malformed account responses. Retry reuses the stored token. Unmounted bootstrap effects ignore late responses. HTTP 401 still rejects the session.
- Driver profile reads preserve HTTP status and validate the response before navigation. The dashboard no longer guesses token expiry from error-message text or removes credentials merely because a driver profile has not been created. A transient guard failure blocks that load and offers a retry via the existing refresh UI.
- Driver OTP verification saves the issued token and delegates account/profile loading to bootstrap. An outage after verification no longer consumes another OTP just to repeat profile loading.
- Customer web retains credentials and cached user information on transient failures, retries on online/focus, and ignores stale responses after token changes or logout. A confirmed 401 still clears the session. Cached UI information never substitutes for backend authorization.
- Rider layout retains previously verified UI state on transient API failures.
- Admin startup no longer routes to login merely because notification handling or another startup dependency failed. Storage-read failures offer retry. Existing adminRequest handling still clears credentials on 401.

Explicit logout, successful account deletion, driver role rejection and driver access restrictions were not relaxed. Admin web clears storage on explicit logout; no blanket network-error logout was found there.

## Lifetime is a separate concern

The API signs user JWTs with JWT_EXPIRES (fallback 30d), and admin JWTs with ADMIN_JWT_EXPIRES. Expiry is embedded when issued; changing configuration does not extend existing tokens. Keep signing secrets stable across restarts.

There is a Session model with refreshTokenHash and expiresAt, but the reviewed auth flow does not use it to refresh or revoke user JWTs. Current clients remove their local token on logout; this does not revoke copies of that JWT on the server. Do not use an empty value or 0 as an unlimited-session configuration. This patch deliberately does not introduce immortal tokens or alter expiry checks.

To provide long-lived login without repeated OTP, a separate implementation needs device sessions, revocable refresh credentials, rotation/replay handling, client refresh/retry logic, logout revocation and account-disable checks. It should preserve migration behavior for existing JWTs. Device data deletion, explicit logout and security-related invalidation can still require authentication.

## Validation and rollout

Run `node --test tests/session-safety.test.cjs` for mocked device/network regression tests executing the startup components and web provider. These are not on-device UI tests.

Release the changed Rider/Driver/Admin app code and deploy the web build to apply the fixes. Restarting only the API does not update installed client behavior. This patch does not change the production environment, database or token lifetimes.
