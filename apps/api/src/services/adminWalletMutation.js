import { createHash } from "node:crypto";

function fail(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

// Reuse the wallet transaction primary key: no separate, expiring dedup cache.
export async function mutateAdminWallet(prisma, { driverId, type, amount, note, actorId, actorUsername, key }) {
  if (!["TOPUP", "ADJUST_ADD", "ADJUST_SUBTRACT"].includes(type)) throw fail(400, "Loại giao dịch không hợp lệ.");
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2147483647) throw fail(400, "Số tiền không hợp lệ.");
  if (!note) throw fail(400, "Vui lòng nhập ghi chú.");
  if (key && (!actorId || !/^[a-zA-Z0-9_-]{16,128}$/.test(key))) throw fail(400, "Mã giao dịch không hợp lệ.");
  const transactionId = key ? `admin-wallet-${createHash("sha256").update(`${actorId}:${key}`).digest("hex")}` : null;
  const storedNote = `[ADMIN ${actorUsername}] ${note}`;
  const include = { user: { select: { id: true, displayName: true, phones: { select: { e164: true, isVerified: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } } } };

  async function replay(db) {
    if (!transactionId) return null;
    const transaction = await db.driverWalletTransaction.findUnique({ where: { id: transactionId } });
    if (!transaction) return null;
    if (transaction.driverProfileId !== driverId || transaction.type !== type || transaction.amount !== amount || transaction.note !== storedNote) {
      throw fail(409, "Mã giao dịch đã dùng với nội dung khác. Hãy kiểm tra lịch sử ví.");
    }
    const profile = await db.driverProfile.findUnique({ where: { id: driverId }, include });
    return { profile, transaction, balanceAfter: profile?.balance, amount, driverUserId: profile?.user?.id, replayed: true };
  }

  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await replay(tx);
        if (existing) return existing;
        const delta = type === "ADJUST_SUBTRACT" ? -amount : amount;
        // Atomic increment and conditional debit: no stale read/absolute write.
        const changed = await tx.driverProfile.updateMany({
          where: { id: driverId, ...(delta < 0 ? { balance: { gte: amount } } : {}) },
          data: { balance: { increment: delta } },
        });
        if (!changed.count) throw fail(400, "Không tìm thấy tài xế hoặc số dư ví không đủ để trừ.");
        const profile = await tx.driverProfile.findUnique({ where: { id: driverId }, include });
        const balanceAfter = profile.balance;
        const transaction = await tx.driverWalletTransaction.create({ data: {
          ...(transactionId ? { id: transactionId } : {}), driverProfileId: driverId, type, amount,
          balanceBefore: balanceAfter - delta, balanceAfter, note: storedNote,
        } });
        let cashTransaction;
        if (type === "TOPUP") {
          cashTransaction = await tx.companyCashTransaction.create({ data: {
            txnDate: new Date(), type: "IN", category: "DRIVER_TOPUP", amount,
            note: `Tài xế ${profile.fullName || profile.user?.displayName || "Tài xế"} nạp ví. ${note}`,
            source: "DRIVER_WALLET_TOPUP", referenceCode: transaction.id,
            createdByAdminId: actorId, createdByUsername: actorUsername,
          } });
        }
        return { profile, transaction, cashTransaction, driverUserId: profile.user?.id, balanceAfter, amount, replayed: false };
      });
    } catch (error) {
      // A simultaneous retry can lose the unique-key race. Its balance change
      // rolls back with the transaction; return the winner's receipt.
      if (error.code === "P2002" && transactionId) {
        const existing = await replay(prisma);
        if (existing) return existing;
      }
      if (error.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
}
