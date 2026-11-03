# Partner remembered login

The Partner login page now offers an unchecked “Ghi nhớ đăng nhập trên thiết bị này” checkbox.

- Ordinary login retains a 12-hour access token and no refresh cookie.
- Remembered login receives a 12-hour access token and a separate refresh credential valid for at most 30 days from the original login. Refreshing and changing the password preserve that original remembered deadline. Access-token expiry never exceeds the deadline.
- The refresh credential is stored only in an HttpOnly, SameSite=Lax, host-scoped cookie under /api/partners. Production cookies require HTTPS. It is never returned in JSON or stored in localStorage. Access tokens remain in the existing localStorage key for existing Partner/chat integration.
- The Partner client renews before expiry or recovers an expired remembered access token after reopening. API requests and chat share a single in-flight refresh per tab. It retries an unauthorized request once; ordinary sessions and the Admin web authentication flow do not use Partner refresh.
- Logout, password reset/change, member edits that increment sessionVersion, and member/company disabling invalidate old credentials. Existing logout semantics revoke all sessions for that member. Password change issues replacement credentials only for the current browser.
- A late refresh cannot overwrite a newer login/password token or restore a token cleared by logout in the same tab or another tab. Network failures keep the stored credentials and allow retry rather than treating connectivity loss as expiry.
- Refresh requires the partner-refresh value in X-Session-Mode and an allowed Origin. The current CORS header list already permits X-Session-Mode. Refresh and access tokens have distinct JWT audiences.

## Server settings

Defaults apply without adding anything to the server .env:

```dotenv
PARTNER_SESSION_HOURS=12
PARTNER_REMEMBER_DAYS=30
PARTNER_WEB_ORIGINS=https://partners.goviet247.com
```

Session hours accept integers 1–24; remembered days accept integers 1–90. PARTNER_WEB_ORIGINS is a comma-separated exact origin list for refresh requests; CORS_ORIGINS must also allow the actual Partner frontend origin. For local HTTP testing use NODE_ENV=development/test and explicitly configure the local frontend origin. Production uses HTTPS for the frontend and API.

## Deployment and validation

- Deploy the API and rebuild/deploy web-partners. Deploy the web build as well because its shared Partner request/chat modules changed; ordinary Admin authentication remains unchanged.
- No migration, dependency addition or mobile rebuild is required specifically for this session change. Earlier pending feature/migration/mobile changes remain independent release requirements.
- Existing tokens retain their original expiry. Users must sign in once and select Remember to opt into the new remembered session.
- 20 real local HTTP checks passed against disposable PostgreSQL: default expiry/cookie clear, remembered cookie flags, expired-access recovery, fixed refresh deadline, separate audiences, foreign-origin/missing-header denial, password replacement, logout, disabled member and disabled company.
- Automated client checks cover concurrent refresh, connectivity errors, normal/Admin isolation, late refresh after logout/password/login and cross-tab invalidation. Additional focused Partner and booking-route checks passed; production builds and diff whitespace validation were checked.
- The broad test run exposed the existing driver-accept-ui harness ReferenceError (tripAcceptFeedback). The booking-route harness was updated with the new company-mode fixture values from the earlier Rider change; its actual stale-quote behavior is unchanged.
- No production deployment, production database change, real browser cookie persistence test or real account operation was performed. After deployment verify Remember checked/unchecked, reopening the browser, logout, password change and the secure cookie in the actual HTTPS environment.
