export function normalizeRiderPlatform(value) {
  const platform = String(value || "").toLowerCase();
  return ["android", "ios"].includes(platform) ? platform : null;
}
export async function recordRiderAppUsage(db, userId, platform) {
  platform = normalizeRiderPlatform(platform);
  if (!platform) return;
  return db.riderAppUsage.upsert({
    where: { userId_platform: { userId, platform } },
    create: { userId, platform }, update: { lastSeenAt: new Date() },
  });
}
export function summarizeRiderAppUsage(customers) {
  const summary = { total: customers.length, recorded: 0, unrecorded: 0, android: 0, ios: 0, both: 0 };
  for (const customer of customers) {
    const platforms = new Set((customer.riderAppUsages || []).map(item => item.platform));
    const android = platforms.has("android"), ios = platforms.has("ios");
    if (android || ios) summary.recorded++; else summary.unrecorded++;
    if (android) summary.android++;
    if (ios) summary.ios++;
    if (android && ios) summary.both++;
  }
  return summary;
}
