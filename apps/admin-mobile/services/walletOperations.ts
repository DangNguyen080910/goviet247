import AsyncStorage from "@react-native-async-storage/async-storage";
import { adminRequest } from "./adminRequest";
import { getAdminUser } from "./storage";

export type PendingWalletOperation = {
  key: string;
  driverId: string;
  type: "topup" | "adjust-add" | "adjust-subtract";
  amount: number;
  note: string;
};
let submitting = false;
async function journalKey() {
  const user = await getAdminUser();
  if (!user?.id) throw new Error("Vui lòng đăng nhập lại trước khi cập nhật ví.");
  return `admin_pending_wallet_v1:${user.id}`;
}
export async function readPendingWalletOperation(): Promise<PendingWalletOperation | null> {
  const raw = await AsyncStorage.getItem(await journalKey());
  return raw ? JSON.parse(raw) : null;
}

export async function submitWalletOperation(
  driverId: string, type: PendingWalletOperation["type"], payload: { amount: number | string; note?: string },
) {
  if (submitting) throw new Error("Giao dịch ví đang được xử lý. Vui lòng chờ.");
  submitting = true;
  try {
    const storageKey = await journalKey();
    const raw = await AsyncStorage.getItem(storageKey);
    const pending: PendingWalletOperation | null = raw ? JSON.parse(raw) : null;
    const amount = Number(payload.amount);
    const note = String(payload.note || "").trim();
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2147483647 || !note) {
      throw new Error("Vui lòng nhập số tiền hợp lệ và ghi chú.");
    }
    if (pending && (pending.driverId !== driverId || pending.type !== type || pending.amount !== amount || pending.note !== note)) {
      throw new Error("Còn giao dịch ví chưa xác nhận. Hãy bấm ‘Kiểm tra giao dịch đang chờ’ trước khi tạo giao dịch mới.");
    }
    // Fail closed against an older API that would ignore Idempotency-Key.
    const capabilities = await adminRequest("/api/admin/wallet-operations/capabilities");
    if (capabilities?.walletOperationVersion !== 1) throw new Error("Máy chủ chưa hỗ trợ cập nhật ví an toàn. Vui lòng cập nhật máy chủ trước.");
    const operation: PendingWalletOperation = pending || {
      key: `wallet_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`,
      driverId, type, amount, note,
    };
    // Persist BEFORE sending. Relaunching the app must retain the same key.
    await AsyncStorage.setItem(storageKey, JSON.stringify(operation));
    let result;
    try {
      result = await adminRequest(`/api/admin/drivers/${driverId}/wallet/${type}`, {
        method: "POST", headers: { "Idempotency-Key": operation.key },
        body: JSON.stringify({ amount, note }),
      });
      if (result?.walletOperationVersion !== 1 || !result?.item?.transaction?.id) {
        throw new Error("Chưa nhận được xác nhận giao dịch từ máy chủ.");
      }
    } catch (error: any) {
      // Validation/auth rejection is definitive; network/5xx/conflict is not.
      if ([400, 401, 403, 404].includes(error?.status)) {
        await AsyncStorage.removeItem(storageKey);
        throw error;
      }
      throw new Error("Chưa xác định được kết quả cập nhật ví. Đừng tạo giao dịch mới; bấm ‘Kiểm tra giao dịch đang chờ’ để xác nhận an toàn, không cộng/trừ thêm lần nữa.");
    }
    try {
      await AsyncStorage.removeItem(storageKey);
    } catch (error) {
      // Money succeeded; cleanup failure must never become a payment failure.
      console.error("clear confirmed wallet journal error:", error);
    }
    return result;
  } finally {
    submitting = false;
  }
}
