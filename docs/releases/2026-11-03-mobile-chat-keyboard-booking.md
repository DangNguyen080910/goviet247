# Mobile chat, keyboard and booking follow-up

Changes apply to Rider, Driver and Admin through the shared chat screen:
- Keyboard avoidance on iOS/Android; scrolling composer and bounded address picker on smaller screens. Quick replies collapse while typing; camera/voice actions dismiss the keyboard.
- Foreground chat pushes play the shared short sound and haptic using the same deduplication gate as polling. They do not also request a second system sound. Background pushes still use OS sound, existing channels and high-priority server outbox delivery.
- Explicit Android chat-channel vibration pattern and window resize configuration for all three apps.
- Follow-up at user's request: Rider keeps a visible Trip-chat tab with Ionicons chatbubbles/chatbubbles-outline on both platforms. Guest route remains hidden. Entry also remains the floating Tin nhắn and per-trip contact buttons.
- Booking success immediately replaces the booking screen with Hoạt động and the new trip ID. History reloads for a changed focus ID and waits for the target's layout before scrolling, including the list's offset.

No new native dependency, production deployment or EAS build was performed. No backend changes in this follow-up. Rebuild all three mobile apps to ship native configuration changes. Existing native folders must honor the app configuration during prebuild.

Validation: all three mobile TypeScript projects; chat sound/deduplication tests, keyboard/composer render regression tests, immediate booking navigation tests, route refresh tests and shared mobile tests. These are not physical-device keyboard/push tests.

Before release, on iOS and Android physical devices:
1. Open each role's chat, type multiline text, tap Send once with keyboard open; test address search, voice and image previews, narrow screen and landscape. Confirm composer stays accessible.
2. Send text/voice/location/image from a second account with recipient in chat, elsewhere in app, in background, and closed normally. Confirm one alert, vibration, notification tap and correct trip. Verify notification permission, Android channel sound/vibration, iOS sound/Focus settings.
3. Book a Rider trip twice in separate runs; confirm automatic Hoạt động navigation, correct highlighted trip, refreshed data and working contact button.
4. Android Settings force-stop requires reopening the app; disabled notifications, Focus/DND, missing connectivity, OS restrictions or invalid push credentials can prevent delivery/sound. OS delivery is not guaranteed.
