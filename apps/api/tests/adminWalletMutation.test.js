import test from "node:test";
import assert from "node:assert/strict";
import { mutateAdminWallet } from "../src/services/adminWalletMutation.js";
import { readFileSync } from "node:fs";
// Isolate the controller's injected database from production notification/S3
// imports. No Prisma client, environment credentials or network are used.
const controllerSource = readFileSync(new URL("../src/controllers/adminController.js", import.meta.url), "utf8")
  .replace(/^import[\s\S]*?;\n/gm, "")
  .replace("export function makeAdminController", "function makeAdminController");
const makeAdminController = new Function("mutateAdminWallet", `${controllerSource}; return makeAdminController;`)(mutateAdminWallet);

function database() {
  let state = { profile: { id: "driver", balance: 0, fullName: "Test", user: { id: "user" } }, transactions: [], cash: [], withdraw: { id: "withdraw", status: "PENDING", amount: 100, driverProfileId: "driver" } };
  let tail = Promise.resolve();
  function api(data) {
    return {
      driverProfile: {
        findUnique: async () => structuredClone(data.profile),
        updateMany: async ({ where, data: change }) => {
          if (where.id !== data.profile.id || (where.balance && data.profile.balance < where.balance.gte)) return { count: 0 };
          data.profile.balance += change.balance.increment; return { count: 1 };
        },
        update: async ({ data: change }) => { data.profile.balance += change.balance.increment; return structuredClone(data.profile); },
      },
      driverWithdrawRequest: {
        findUnique: async () => structuredClone(data.withdraw),
        updateMany: async ({ where, data: change }) => {
          if (data.withdraw.status !== where.status) return { count: 0 };
          Object.assign(data.withdraw, change); return { count: 1 };
        },
        update: async ({ data: change }) => { Object.assign(data.withdraw, change); return structuredClone(data.withdraw); },
      },
      driverWalletTransaction: {
        findUnique: async ({ where }) => structuredClone(data.transactions.find((t) => t.id === where.id) || null),
        create: async ({ data: value }) => {
          if (value.id && data.transactions.some((t) => t.id === value.id)) throw Object.assign(new Error("duplicate"), { code: "P2002" });
          const row = { id: `txn-${data.transactions.length}`, ...value }; data.transactions.push(row); return row;
        },
      },
      companyCashTransaction: {
        findFirst: async () => null,
        create: async ({ data: value }) => { if (db.failCash) throw new Error("cash unavailable"); data.cash.push(value); return value; },
      },
    };
  }
  const db = {
    get state() { return state; }, failCash: false,
    driverWalletTransaction: { findUnique: (args) => api(state).driverWalletTransaction.findUnique(args) },
    driverProfile: { findUnique: (args) => api(state).driverProfile.findUnique(args) },
    driverWithdrawRequest: { findUnique: (args) => api(state).driverWithdrawRequest.findUnique(args) },
    systemNotification: { create: async () => { throw new Error("notification database unavailable"); } },
    $transaction: (fn) => {
      const work = tail.then(async () => { const copy = structuredClone(state); const result = await fn(api(copy)); state = copy; return result; });
      tail = work.catch(() => {}); return work;
    },
  };
  return db;
}
const input = { driverId: "driver", type: "TOPUP", amount: 500000, note: "Admin cộng ví", actorId: "admin", actorUsername: "admin", key: "wallet_test_12345678" };
function response() { return { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } }; }
function request(body = {}) { return { params: { id: "driver" }, admin: { id: "admin", username: "admin" }, body: { amount: 500000, note: input.note, ...body }, get: () => input.key, app: { get: () => ({ to() { throw new Error("socket failed"); } }) } }; }

test("same key submitted three times produces one topup and one cash entry", async () => {
  const db = database();
  const results = await Promise.all([1, 2, 3].map(() => mutateAdminWallet(db, input)));
  assert.equal(db.state.profile.balance, 500000); assert.equal(db.state.transactions.length, 1); assert.equal(db.state.cash.length, 1);
  assert.equal(results.filter((r) => r.replayed).length, 2);
});
test("new genuine payment with another key is counted; receipt replay uses current balance", async () => {
  const db = database(); await mutateAdminWallet(db, input); await mutateAdminWallet(db, { ...input, key: "wallet_another_123456" });
  const replay = await mutateAdminWallet(db, input); assert.equal(replay.balanceAfter, 1000000); assert.equal(db.state.cash.length, 2);
});
test("same key cannot change amount, driver, note or operation", async () => {
  const db = database(); await mutateAdminWallet(db, input);
  for (const change of [{ amount: 1 }, { driverId: "other" }, { note: "changed" }, { type: "ADJUST_ADD" }]) {
    await assert.rejects(mutateAdminWallet(db, { ...input, ...change }), { statusCode: 409 });
  }
  assert.equal(db.state.profile.balance, 500000);
});
test("cash failure rolls back wallet and receipt; retry later succeeds once", async () => {
  const db = database(); db.failCash = true; await assert.rejects(mutateAdminWallet(db, input));
  assert.equal(db.state.profile.balance, 0); assert.equal(db.state.transactions.length, 0);
  db.failCash = false; await mutateAdminWallet(db, input); assert.equal(db.state.profile.balance, 500000);
});
test("debit is conditional, replay safe, and does not invent a company cash outflow", async () => {
  const db = database(); await mutateAdminWallet(db, input);
  const debit = { ...input, type: "ADJUST_SUBTRACT", amount: 400000, key: "wallet_debit_12345678" };
  await mutateAdminWallet(db, debit); await mutateAdminWallet(db, debit);
  await assert.rejects(mutateAdminWallet(db, { ...debit, key: "wallet_debit_98765432" }));
  assert.equal(db.state.profile.balance, 100000); assert.equal(db.state.cash.length, 1);
});
test("post-commit notification and socket failures still return success", async () => {
  const db = database(); const res = response(); await makeAdminController(db).topupDriverWallet(request(), res);
  await new Promise(setImmediate);
  assert.equal(res.statusCode, 200); assert.equal(res.body.success, true); assert.equal(res.body.walletOperationVersion, 1);
  assert.equal(db.state.profile.balance, 500000);
});
test("two simultaneous withdraw rejections refund once", async () => {
  const db = database(); const controller = makeAdminController(db);
  const req = { ...request({ reason: "Test" }), params: { id: "withdraw" } };
  const a = response(), b = response();
  await Promise.all([controller.rejectDriverWithdrawRequest(req, a), controller.rejectDriverWithdrawRequest(req, b)]);
  assert.equal(db.state.profile.balance, 100); assert.equal(db.state.transactions.length, 1); assert.equal(db.state.withdraw.status, "REJECTED");
});
test("two simultaneous paid requests write company cash once", async () => {
  const db = database(); db.state.withdraw.status = "APPROVED";
  const controller = makeAdminController(db), req = { ...request(), params: { id: "withdraw" } };
  await Promise.all([controller.markDriverWithdrawRequestPaid(req, response()), controller.markDriverWithdrawRequestPaid(req, response())]);
  assert.equal(db.state.cash.length, 1); assert.equal(db.state.transactions.length, 1); assert.equal(db.state.withdraw.status, "PAID");
});
test("unique conflict returns committed receipt rather than running money twice", async () => {
  const db = database(); await mutateAdminWallet(db, input);
  db.$transaction = async () => { throw Object.assign(new Error("simultaneous unique conflict"), { code: "P2002" }); };
  const result = await mutateAdminWallet(db, input);
  assert.equal(result.replayed, true); assert.equal(db.state.profile.balance, 500000);
});
test("a hung post-commit notification does not hold the payment response", async () => {
  const db = database(); db.systemNotification.create = () => new Promise(() => {});
  const res = response(); await makeAdminController(db).topupDriverWallet(request(), res);
  assert.equal(res.body.success, true);
});
test("withdraw and ledger search resolve accented names and local/international phones before pagination", async () => {
  const driver = { id: "older-driver", fullName: "Nguyễn Tấn Hoàng", user: { displayName: "User", phones: [{ e164: "+84901234567" }] } };
  for (const method of ["listDriverWithdrawRequests", "listLedgerTransactions"]) {
    for (const q of ["nguyen tan hoang", "HOÀNG", "hoang nguyen", "0901234567", "+84 901 234 567", "090 123 4567"]) {
      let seen;
      const rows = {
        findMany: async (args) => {
          seen = args;
          const ids = args.where.OR[0].driverProfileId.in;
          return ids.includes(driver.id) ? [{ id: "old-record", driverProfile: driver }] : [];
        },
        count: async () => 1,
      };
      const db = { driverProfile: { findMany: async () => [driver] }, driverWithdrawRequest: rows, driverWalletTransaction: rows };
      const res = response();
      await makeAdminController(db)[method]({ query: { q, page: "1", pageSize: "50" } }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.items[0]?.driverProfile.fullName, driver.fullName, `${method}: ${q}`);
      assert.equal(seen.take, 50); assert.equal(seen.skip, 0);
    }
  }
});
