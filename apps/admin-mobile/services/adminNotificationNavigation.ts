import type * as Notifications from "expo-notifications";

type NotificationData = Record<string, unknown> | undefined;

function normalize(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

export function getAdminNotificationRoute(data: NotificationData) {
  const type = normalize(data?.type);
  const source = normalize(data?.source);
  const status = normalize(data?.status || data?.toStatus);

  if (type === "DRIVER_WITHDRAW_REQUEST_CREATED") {
    return "/wallets?tab=WITHDRAWS";
  }

  if (type === "FEEDBACK_CREATED" || source === "FEEDBACK_CREATED") {
    return "/feedback";
  }

  if (type === "NEW_DRIVER_PROFILE" || source === "DRIVER_PROFILE_CREATED") {
    return "/drivers";
  }

  if (type === "ADMIN_NEW_TRIP" || source === "CREATE_TRIP") {
    return "/pending-trips?tab=PENDING";
  }

  if (source === "DRIVER_CANCEL_TRIP") {
    return "/pending-trips?tab=PENDING";
  }

  if (source === "RIDER_CANCEL_TRIP") {
    return "/pending-trips?tab=CANCELLED";
  }

  if (
    type === "ADMIN_TRIP_STATUS_CHANGED" ||
    type === "ADMIN_TRIP_CANCELLED" ||
    source === "DRIVER_ACCEPT_TRIP" ||
    source === "DRIVER_CHANGE_TRIP_STATUS" ||
    source === "ADMIN_CHANGE_TRIP_STATUS"
  ) {
    const resolvedStatus = type === "ADMIN_TRIP_CANCELLED" ? "CANCELLED" : status;
    const tab = [
      "ACCEPTED",
      "CONTACTED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
    ].includes(resolvedStatus)
      ? resolvedStatus
      : "ACCEPTED";

    return `/assigned-trips?tab=${tab}`;
  }

  return "/home";
}

export function getAdminNotificationResponseRoute(
  response: Notifications.NotificationResponse | null | undefined,
) {
  return getAdminNotificationRoute(
    response?.notification?.request?.content?.data as NotificationData,
  );
}
