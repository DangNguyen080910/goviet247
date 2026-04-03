// Path: goviet247/apps/web/src/api/adminLedger.js
import { getAdminToken } from "../utils/adminAuth";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";
const BASE_URL = `${API_BASE}/api/admin`;

async function parseJson(res) {
  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Có lỗi xảy ra khi gọi API admin ledger.");
  }

  return data;
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });

  return query.toString();
}

export async function fetchLedgerSummary() {
  const token = getAdminToken();

  const res = await fetch(`${BASE_URL}/ledger/summary`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await parseJson(res);
  return data.summary;
}

export async function fetchLedgerTransactions(params = {}) {
  const token = getAdminToken();

  const res = await fetch(
    `${BASE_URL}/ledger/transactions?${buildQuery(params)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return parseJson(res);
}

export async function fetchWithdrawRequests(params = {}) {
  const token = getAdminToken();

  const res = await fetch(
    `${BASE_URL}/withdraw-requests?${buildQuery(params)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return parseJson(res);
}

export async function fetchDriverTripPenalties(params = {}) {
  const token = getAdminToken();

  const res = await fetch(
    `${BASE_URL}/driver-trip-penalties?${buildQuery(params)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return parseJson(res);
}

export async function approveDriverTripPenalty(id) {
  const token = getAdminToken();

  const res = await fetch(`${BASE_URL}/driver-trip-penalties/${id}/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  return parseJson(res);
}

export async function approveWithdrawRequest(id) {
  const token = getAdminToken();

  const res = await fetch(`${BASE_URL}/withdraw-requests/${id}/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  return parseJson(res);
}

export async function rejectWithdrawRequest(id, payload = {}) {
  const token = getAdminToken();

  const res = await fetch(`${BASE_URL}/withdraw-requests/${id}/reject`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return parseJson(res);
}

export async function fetchWeeklySettlementSummary(params = {}) {
  const token = getAdminToken();

  const res = await fetch(
    `${BASE_URL}/settlement/weekly?${buildQuery(params)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return parseJson(res);
}

export async function markWithdrawRequestPaid(id) {
  const token = getAdminToken();

  const res = await fetch(`${BASE_URL}/withdraw-requests/${id}/paid`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  return parseJson(res);
}

export async function markWeeklyCommissionTransferred(payload = {}) {
  const token = getAdminToken();

  const res = await fetch(`${BASE_URL}/settlement/weekly/transfer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return parseJson(res);
}

export async function fetchCommissionSummary() {
  const token = getAdminToken();

  const res = await fetch(`${BASE_URL}/commission/summary`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await parseJson(res);
  return data.summary;
}

export async function fetchCommissionPayouts(params = {}) {
  const token = getAdminToken();

  const res = await fetch(
    `${BASE_URL}/commission/payouts?${buildQuery(params)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return parseJson(res);
}

export async function createCommissionPayout(payload = {}) {
  const token = getAdminToken();

  const res = await fetch(`${BASE_URL}/commission/payouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return parseJson(res);
}

export async function fetchTripAccountingRows(params = {}) {
  const token = getAdminToken();

  const query = new URLSearchParams(params).toString();

  const res = await fetch(`${BASE_URL}/ledger/trip-accounting?${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseJson(res);
}