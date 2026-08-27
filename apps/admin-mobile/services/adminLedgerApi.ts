import { adminRequest } from "./adminRequest";

function query(params: Record<string, string | number>) {
  const value = Object.entries(params)
    .map(([key, item]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`)
    .join("&");
  return value ? `?${value}` : "";
}

export async function fetchCashSummary(fromDate: string, toDate: string) {
  const data = await adminRequest(
    `/api/admin/cash-transactions/summary${query({ fromDate, toDate })}`,
    { method: "GET" },
  );
  return data?.summary || { totalIn: 0, totalOut: 0, balance: 0 };
}

export async function fetchRevenueReport(quarter: number, year: number) {
  const data = await adminRequest(
    `/api/admin/revenue-report${query({ quarter, year })}`,
    { method: "GET" },
  );
  return data?.data || null;
}
