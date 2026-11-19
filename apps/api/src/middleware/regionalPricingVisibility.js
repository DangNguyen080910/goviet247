const hiddenFields = new Set(['regionalSurcharge', 'regionalPricingConfig']);

// Copy JSON containers only. Preserve Date/Decimal serialization and never mutate
// the stored snapshot, which remains available to admin and booking validation.
export function withoutRegionalPricingDetails(value) {
  if (Array.isArray(value)) return value.map(withoutRegionalPricingDetails);
  if (!value || typeof value !== 'object') return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !hiddenFields.has(key))
    .map(([key, item]) => [key, withoutRegionalPricingDetails(item)]));
}

export function regionalPricingVisibility(req, res, next) {
  const pathname = (req.originalUrl || req.url || '').split('?')[0];
  // Legacy admin routes share the /api/trips prefix; their existing auth applies.
  const admin = /^\/api\/(?:admin|trips\/admin)(?:\/|$)/i.test(pathname);
  const customerOrDriver = /^\/api\/(?:pricing|trips|public|partners|driver)(?:\/|$)/i.test(pathname);
  if (!admin && customerOrDriver) {
    const json = res.json;
    res.json = function (body) {
      return json.call(this, withoutRegionalPricingDetails(body));
    };
  }
  next();
}
