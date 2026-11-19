import { AUDIENCE_REGIONS } from './audienceFilters.js';

const GEOGRAPHIC_REGIONS = AUDIENCE_REGIONS.filter(region => region.provinceCodes.length);

// Persist approval intent, rather than inferring it later from driver profiles.
export function audienceRegionsForApproval(mode, regions = [], hasDriverIds = false) {
  if (mode === 'AUDIENCE_FILTER') {
    return AUDIENCE_REGIONS.filter(region => regions.includes(region.value)).map(region => region.value);
  }
  if (mode === 'SELECTED' || (mode === undefined && hasDriverIds)) return [];
  return AUDIENCE_REGIONS.map(region => region.value);
}

export function tripAudienceLabel(trip) {
  const regions = Array.isArray(trip.audienceRegions) ? trip.audienceRegions : [];
  const validRegions = regions.every(value => AUDIENCE_REGIONS.some(region => region.value === value));
  if (regions.length && validRegions) {
    if (GEOGRAPHIC_REGIONS.every(region => regions.includes(region.value))) return 'Toàn quốc';
    // Unconfirmed operating locations are an admin concern, not a geographic claim.
    if (regions.includes('UNCONFIRMED')) return 'Tài xế chỉ định';
    return GEOGRAPHIC_REGIONS.filter(region => regions.includes(region.value)).map(region => region.label).join(' · ');
  }
  // Older private approvals have no saved region selection. Do not guess it.
  return Array.isArray(trip.audienceDriverIds) && trip.audienceDriverIds.length === 0 ? 'Toàn quốc' : 'Tài xế chỉ định';
}
