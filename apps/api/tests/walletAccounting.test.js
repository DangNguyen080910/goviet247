import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDriverWalletItemsForAccounting } from "../src/services/walletAccounting.js";

const row = (id, driverProfileId, tripId, type, amount, minute) => ({
  id, driverProfileId, tripId, type, amount,
  createdAt: new Date(`2026-09-20T00:${String(minute).padStart(2, "0")}:00Z`),
});

test("reassigned trip retains the second driver's hold and counts the first debit once", () => {
  const firstHold = row("a-hold", "A", "trip", "COMMISSION_HOLD", -100, 1);
  const oldPenalty = row("a-penalty", "A", "trip", "TRIP_CANCEL_PENALTY", -100, 2);
  const secondHold = row("b-hold", "B", "trip", "COMMISSION_HOLD", -100, 3);
  const actual = normalizeDriverWalletItemsForAccounting([firstHold, oldPenalty, secondHold]);
  assert.deepEqual(actual.map((item) => item.id), ["a-hold", "b-hold"]);
  assert.equal(actual.reduce((sum, item) => sum + item.amount, 0), -200);
});

test("cross-quarter penalty is matched against the prior hold without moving cash twice", () => {
  const firstHold = row("a-hold", "A", "trip", "COMMISSION_HOLD", -100, 1);
  const oldPenalty = row("a-penalty", "A", "trip", "TRIP_CANCEL_PENALTY", -100, 2);
  assert.deepEqual(normalizeDriverWalletItemsForAccounting([oldPenalty], [firstHold]), []);
});

test("unmatched penalty is retained for review", () => {
  const penalty = row("unmatched", "A", "trip", "TRIP_CANCEL_PENALTY", -100, 2);
  assert.deepEqual(normalizeDriverWalletItemsForAccounting([penalty]).map((item) => item.id), ["unmatched"]);
});

test("the same driver accepting again keeps the later hold", () => {
  const firstHold = row("hold-1", "A", "trip", "COMMISSION_HOLD", -100, 1);
  const penalty = row("penalty", "A", "trip", "TRIP_CANCEL_PENALTY", -100, 2);
  const secondHold = row("hold-2", "A", "trip", "COMMISSION_HOLD", -100, 3);
  assert.deepEqual(normalizeDriverWalletItemsForAccounting([firstHold, penalty, secondHold])
    .map((item) => item.id), ["hold-1", "hold-2"]);
});

test("admin wallet subtraction exports a negative movement matching the balance change", () => {
  const debit = { ...row("debit", "A", null, "ADJUST_SUBTRACT", 500000, 4), balanceBefore: 1000000, balanceAfter: 500000 };
  const [exported] = normalizeDriverWalletItemsForAccounting([debit]);
  assert.equal(exported.amount, -500000);
  assert.equal(exported.balanceBefore + exported.amount, exported.balanceAfter);
  assert.equal(debit.amount, 500000);
});

for (const scoped of [true,false]) test(`refund then same-driver reassignment counts only real movements (scoped=${scoped})`,()=>{
 const types=['COMMISSION_HOLD','COMMISSION_REFUND','COMMISSION_HOLD','TRIP_CANCEL_PENALTY'];
 const rows=types.map((type,i)=>({...row(String(i),'A','trip',type,i===1?100:-100,i+1),...(scoped?{walletHoldId:i<2?'first':'second'}:{})}));
 const result=normalizeDriverWalletItemsForAccounting(rows);
 assert.equal(result.reduce((sum,r)=>sum+r.amount,0),-100);
 assert.deepEqual(result.map(r=>r.id),['0','1','2']);
 assert.deepEqual(normalizeDriverWalletItemsForAccounting([rows[3]],rows.slice(0,3)),[]);
});
test('scoped penalty never matches a different acceptance with the same amount',()=>{
 const hold={...row('h','A','trip','COMMISSION_HOLD',-100,1),walletHoldId:'old'};
 const penalty={...row('p','A','trip','TRIP_CANCEL_PENALTY',-100,2),walletHoldId:'new'};
 assert.equal(normalizeDriverWalletItemsForAccounting([hold,penalty]).length,2);
});
