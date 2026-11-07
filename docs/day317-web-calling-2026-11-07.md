# Day 317 — Calling on Partner web and Rider web

Implemented locally on 2026-11-07; not deployed and no real calls/pushes sent.

## Behavior

- Partner portal mounts shared WebTripChat. Only the assigned dispatcher is eligible, as enforced by existing trip-call API policy. Company managers/bookers retain chat/history unless they are the assigned call participant.
- Rider web mounts the same component outside /admin routes. The API resolves the actual passenger from verified phone accounts; a booker is not automatically a call participant.
- Phone action in the conversation header, incoming call modal, explicit recording consent on outgoing and incoming, mute/unmute, hang up, elapsed duration, browser ringtone and optional desktop notification.
- Browser polling every 2 seconds while the page is running, including when another portal route is open. Background tabs may be throttled by the browser. Closed tabs/browser, sleeping computers, or suspended mobile browsers do not reliably receive calls. Use native apps for these cases.
- Enable ringing with the “Bật chuông cuộc gọi” control. Microphone access and HTTPS are required; browser playback can require the “Bật âm thanh” control. Output follows the computer's audio device settings.
- One browser-tab identity per mount; no Chime credentials persisted. API enforces the first answer across tabs/app devices and global busy state. Per-user state remains isolated across customer/partner sessions and logout.
- Shared chat stops audio playback/voice recording during a call. Logs and admin-only recordings use the existing backend flow.

## Deployment

No additional DB migration or API environment variable is introduced by this web addition. The 3 earlier calling/hearts migrations and existing calling API/env configuration are still required.

Install dependencies using the committed pnpm lockfile, build both web projects with VITE_API_BASE pointing at the HTTPS API, and deploy their generated dist artifacts through the existing deployment procedure. Use Node 20.19+ / 22.12+ (validated with Node 24).

```
pnpm --filter goviet247-web build
pnpm --filter @goviet247/web-partners build
```

Both projects pin amazon-chime-sdk-js 3.30.0. SDK is loaded dynamically when joining a call. API uses EC2 role; APNs key remains on server and never enters the web bundle.

## Validation and remaining live checks

Web calling controller tests cover permission denial, stale polling responses during outgoing calls, consent/idempotency fields, first-answer conflict, joined-only heartbeat, hangup during network failure, logout during permission prompt, disposal during media join, ended sessions, and network-loss audio cleanup. Related session/chat tests also pass. Production builds of Rider and Partner web pass; targeted ESLint passes.

Still requires live two-party audio, actual AWS capture/concatenation/cleanup, browser autoplay/microphone permissions, and cross-device first-answer verification. Existing backend allocation-persistence recovery release caveat remains; this web change does not resolve it. Calling flags are global rather than restricted to tester accounts.

Suggested test matrix: web partner ↔ Driver app, Rider web ↔ Driver app, same recipient open on web + Rider app (answer each side first), two different trips simultaneously, booker/nonassigned manager cannot call, assignment revoked mid-call, reject/missed/busy, mute/end/network loss/logout/refresh, completed trip, final recording visible only to real Admin.
