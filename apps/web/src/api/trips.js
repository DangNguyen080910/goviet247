import {reconcileBooking} from "../../../mobile-chat/reconcileBooking.js";
import {fetchWithTimeout} from "../../../mobile-chat/fetchWithTimeout.js";
import { readTripPages } from "../../../api/src/shared/tripPages.js";
// Path: goviet247/apps/web/src/api/trips.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";
const CUSTOMER_TOKEN_KEY = "gv247_customer_token";

/**
 * Tạo chuyến
 * - Guest: gửi như bình thường
 * - Logged-in customer: tự gắn Authorization Bearer token
 */
export async function createTrip(payload) {
  const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);

  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
  const res = await fetchWithTimeout(`${API_BASE}/api/trips`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Tạo chuyến thất bại.");
  }

  return data;
  } catch (error) {
    if(error?.code==='REQUEST_UNCONFIRMED'){
      const confirmed=await reconcileBooking(API_BASE,headers,payload.bookingRequestId || payload.quoteHistoryToken);
      if(confirmed)return confirmed;
    }
    throw error;
  }
}

/**
 * Lấy lịch sử chuyến của customer đang đăng nhập
 */
export async function getMyTrips(token) {
  return readTripPages(async cursor => {
    const qs = new URLSearchParams({pageSize:"100",...(cursor ? {cursor} : {})});
    const res = await fetchWithTimeout(`${API_BASE}/api/trips/my?${qs}`, {headers:{Authorization:`Bearer ${token}`}});
    const data = await res.json().catch(()=>({}));
    if (!res.ok) throw Object.assign(new Error(data.message || "Không tải được danh sách chuyến."),{status:res.status});
    return data;
  });
}
