import { readFileSync } from "node:fs";
export const PROVINCES = JSON.parse(readFileSync(new URL("../data/vietnam-provinces.json", import.meta.url), "utf8"));
export const isProvinceCode = code => typeof code === "string" && PROVINCES.some(p => p.code === code);
export function driverProvinceSummary(drivers) {
  const rows = PROVINCES.map(p => ({ ...p, total: 0, confirmed: 0, unconfirmed: 0 }));
  const byCode = new Map(rows.map(p => [p.code, p]));
  for (const driver of drivers) {
    const row = byCode.get(driver.operatingProvinceCode || "79");
    if (!row) continue;
    row.total++;
    if (driver.operatingProvinceConfirmedAt) row.confirmed++; else row.unconfirmed++;
  }
  return rows;
}
