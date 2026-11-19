export type RegionalRoutePoint = { placeId: string; address: string };
export function regionalRoutePoints(pickup: { placeId?: string; fullAddress?: string } | null, destinations: Array<{ placeId?: string; fullAddress?: string } | null>): RegionalRoutePoint[];
export function regionalPricingLine(snapshot: unknown): string | null;
