// Path: goviet247/apps/web/src/api/adminCashTransactions.js
import { getAdminToken } from "../utils/adminAuth";

const BASE_URL = "http://localhost:5050/api/admin";

async function parseJson(res) {
  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Có lỗi xảy ra khi gọi API thu chi công ty.");
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

export async function fetchCompanyCashTransactions(params = {}) {
  const token = getAdminToken();

  const query = buildQuery(params);
  const url = query
    ? `${BASE_URL}/cash-transactions?${query}`
    : `${BASE_URL}/cash-transactions`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseJson(res);
}

export async function fetchCompanyCashSummary(params = {}) {
  const token = getAdminToken();

  const query = buildQuery(params);
  const url = query
    ? `${BASE_URL}/cash-transactions/summary?${query}`
    : `${BASE_URL}/cash-transactions/summary`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await parseJson(res);
  return data.summary;
}

export async function createCompanyCashTransaction(payload = {}) {
  const token = getAdminToken();

  const res = await fetch(`${BASE_URL}/cash-transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return parseJson(res);
}

export async function deleteCompanyCashTransaction(id) {
  const token = getAdminToken();

  const res = await fetch(`${BASE_URL}/cash-transactions/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseJson(res);
}

// Việt: Export file CSV từ backend
export async function exportCompanyCashTransactions(params = {}) {
  const token = getAdminToken();

  const query = buildQuery(params);
  const url = query
    ? `${BASE_URL}/cash-transactions/export?${query}`
    : `${BASE_URL}/cash-transactions/export`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    let message = "Có lỗi xảy ra khi export CSV thu chi công ty.";

    try {
      const data = await res.json();
      message = data?.message || message;
    } catch {
      // Việt: bỏ qua nếu response không phải json
    }

    throw new Error(message);
  }

  const blob = await res.blob();

  // Việt: cố lấy tên file từ header, fallback nếu không có
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || "cash_transactions.csv";

  return {
    blob,
    filename,
  };
}