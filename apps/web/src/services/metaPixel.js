// Path: apps/web/src/services/metaPixel.js

export function track(eventName, params = {}) {
  if (typeof window === "undefined") return;

  if (!window.fbq) return;

  window.fbq("track", eventName, params);
}

export function trackCustom(eventName, params = {}) {
  if (typeof window === "undefined") return;

  if (!window.fbq) return;

  window.fbq("trackCustom", eventName, params);
}