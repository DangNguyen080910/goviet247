// Keep late HTTP responses from restoring a trip removed by a realtime event.
export class AvailableTripState {
  constructor() {
    this.revision = 0;
    this.requestId = 0;
    this.unavailableIds = new Set();
  }

  beginRequest() {
    return { revision: this.revision, requestId: ++this.requestId };
  }

  /** @template {{id: string}} T
   * @param {{revision: number, requestId: number}} request
   * @param {T[]} items
   * @returns {T[] | null}
   */
  applySnapshot(request, items) {
    if (request.revision !== this.revision || request.requestId !== this.requestId) return null;
    // A fresh server response can reopen trips returned/cancelled by their driver.
    for (const item of items) this.unavailableIds.delete(item.id);
    return items;
  }

  /** @param {string} tripId */
  markUnavailable(tripId) {
    ++this.revision;
    this.unavailableIds.add(tripId);
  }

  /** @param {string} tripId */
  canAccept(tripId) {
    return !this.unavailableIds.has(tripId);
  }

  /** @param {{tripId?: string, id?: string, toStatus?: string, status?: string, driverId?: string | null, cancelledAt?: unknown} | null | undefined} payload */
  handleEvent(payload) {
    // Even a reopen event invalidates earlier snapshots; only the API can add a card.
    ++this.revision;
    const tripId = payload?.tripId || payload?.id;
    const status = payload?.toStatus || payload?.status;
    if (!tripId || !(payload?.driverId || payload?.cancelledAt || (status && status !== "PENDING"))) return null;
    this.unavailableIds.add(tripId);
    return tripId;
  }
}

/** @param {{code?: string, message?: string}} error */
export function confirmsTripUnavailable(error) {
  return ["TRIP_ALREADY_ACCEPTED", "TRIP_ALREADY_YOURS", "TRIP_CANCELLED", "TRIP_NOT_FOUND", "TRIP_NOT_AVAILABLE"].includes(error?.code || "") ||
    ["Chuyến đã có tài xế nhận", "Chuyến đã bị huỷ"].includes(error?.message || "");
}
