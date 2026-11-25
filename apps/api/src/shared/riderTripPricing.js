import { destinationPackageLabel } from './destinationService.js';
export function riderPackageLines(snapshot) {
  return snapshot?.eligible === true ? [destinationPackageLabel(snapshot)] : [];
}
