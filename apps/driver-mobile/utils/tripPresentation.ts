import { tripRoutePoints } from "../../api/src/shared/tripRoute.js";

type TripNotes = { dispatcherNote?: string | null; note?: string | null };
type NoteAddress = { address?: string | null; addressMasked?: string | null };
type NoteRoute = TripNotes & {
  dropoffAddress?: string | null;
  dropoffAddressMasked?: string | null;
  stops?: NoteAddress[] | null;
};

export function driverTripNotes(trip: TripNotes) {
  return [
    { kind: "dispatcher", label: "Ghi chú điều hành GoViet247", text: trip.dispatcherNote?.trim() || "" },
    { kind: "customer", label: "Ghi chú khách", text: trip.note?.trim() || "" },
  ].filter(note => note.text);
}

export function driverTripRoutePoints<T extends NoteRoute>(trip: T, options: { masked?: boolean } = {}) {
  // The API embeds this exact suffix for released Driver apps. Only remove the
  // matching note from display copies; keep stored addresses and API compatibility.
  const note = trip.note || "";
  const suffixes = [...new Set([note, note.trim().slice(0, 500)])]
    .filter(Boolean).map(text => `\n📝 Ghi chú khách: ${text}`);
  const addressOnly = (value?: string | null) => {
    const suffix = suffixes.find(candidate => value?.endsWith(candidate));
    return suffix ? value!.slice(0, -suffix.length) : value;
  };
  return tripRoutePoints({
    ...trip,
    dropoffAddress: addressOnly(trip.dropoffAddress),
    dropoffAddressMasked: addressOnly(trip.dropoffAddressMasked),
    stops: trip.stops?.map(stop => ({
      ...stop,
      address: addressOnly(stop.address),
      addressMasked: addressOnly(stop.addressMasked),
    })),
  }, options);
}
