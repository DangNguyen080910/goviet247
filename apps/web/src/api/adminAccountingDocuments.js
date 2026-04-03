// Path: goviet247/apps/web/src/api/adminAccountingDocuments.js
import { getAdminToken } from "../utils/adminAuth";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";
const BASE_URL = `${API_BASE}/api/admin`;

async function parseJson(res) {
  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error(
      data?.message || "Có lỗi xảy ra khi gọi API tài liệu kế toán.",
    );
  }

  return data;
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });

  return search.toString();
}

export async function fetchAccountingDocuments(params = {}) {
  const token = getAdminToken();

  const res = await fetch(
    `${BASE_URL}/accounting-documents?${buildQuery(params)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return parseJson(res);
}

export async function createAccountingDocument(formData) {
  const token = getAdminToken();

  const res = await fetch(`${BASE_URL}/accounting-documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  return parseJson(res);
}

export async function deleteAccountingDocument(id) {
  const token = getAdminToken();

  const res = await fetch(`${BASE_URL}/accounting-documents/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseJson(res);
}

export async function fetchAccountingSummary(params = {}) {
  const token = getAdminToken();

  const res = await fetch(
    `${BASE_URL}/accounting-summary?${buildQuery(params)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return parseJson(res);
}

export async function fetchAccountingNotes(params = {}) {
  const token = getAdminToken();

  const res = await fetch(
    `${BASE_URL}/accounting-notes?${buildQuery(params)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return parseJson(res);
}

export async function createAccountingNote(payload) {
  const token = getAdminToken();

  const res = await fetch(`${BASE_URL}/accounting-notes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return parseJson(res);
}

export async function deleteAccountingNote(id) {
  const token = getAdminToken();

  const res = await fetch(`${BASE_URL}/accounting-notes/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseJson(res);
}

export async function exportAccountingNotesCsv(params = {}) {
  const token = getAdminToken();

  const res = await fetch(
    `${BASE_URL}/accounting-notes/export?${buildQuery(params)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) {
    let message = "Không thể export CSV ghi chú kế toán.";

    try {
      const data = await res.json();
      message = data?.message || message;
    } catch {
      // ignore
    }

    throw new Error(message);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  const quarter = params?.quarter || "";
  const year = params?.year || "";

  link.href = url;
  link.download = `ghi_chu_ke_toan_Q${quarter}_${year}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);

  return { success: true };
}

export async function fetchAccountingExportPreview(params = {}) {
  const token = getAdminToken();

  const res = await fetch(
    `${BASE_URL}/accounting-export/preview?${buildQuery(params)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return parseJson(res);
}

export async function exportAccountingZip(params = {}) {
  const token = getAdminToken();

  if (!token) {
    throw new Error("Không tìm thấy token admin.");
  }

  const query = buildQuery({
    ...params,
    token,
  });

  const downloadUrl = `${BASE_URL}/accounting-export/zip?${query}`;

  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return { success: true };
}

export async function fetchRevenueReport(params = {}) {
  const token = getAdminToken();

  const res = await fetch(`${BASE_URL}/revenue-report?${buildQuery(params)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return parseJson(res);
}
