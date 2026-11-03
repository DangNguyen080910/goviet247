# Chat inbox opens messages; trip detail stays inside conversation

This corrects the earlier placement of the trip-detail button in the conversation list.

- Inbox cards show the full trip ID, pickup → destination, last message preview and unread count.
- On mobile, tapping the card or “Xem tin nhắn” navigates to the conversation. The button stops propagation to avoid double navigation.
- On web, both the message preview area and “Xem tin nhắn” select the conversation. There is no inbox trip-detail action.
- Inside an open conversation, “Xem chuyến” remains and opens that trip's read-only details.
- The API adds pickupAddress/dropoffAddress only after chatAccess authorizes the trip. Older API responses without these optional fields still render and open chat normally.
- This applies to the shared Rider/Driver/Admin Mobile screen and customer/Admin/Partner web chat. Terminal-chat restrictions, map links/GPS, media and Partner booking policies are unchanged.

Validation: 14 focused tests passed, including invoking the actual native/web inbox click handlers, verifying no detail request from an inbox tap, verifying the in-conversation detail action, route serialization and keyboard/layout checks. All three mobile TypeScript checks and both production web builds passed. No EAS build, Store submission, production deployment or physical-device UI test was performed.

Deployment: update API and both web builds for route labels and corrected web navigation. Mobile button text/actions are bundled in the installed app, so the existing App Store/TestFlight binary needs a mobile update to change them. Current mobile configuration has no configured EAS Update channel/runtime. Server-only deployment cannot replace that native-bundled inbox action. No migration or environment change is required.
