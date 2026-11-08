import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceDayPeriod, vietnamDay, getCommissionPeriod, commissionInvoiceSummary, runCommissionInvoiceReminder } from '../src/services/commissionInvoiceTracking.js';
import { makeCommissionInvoiceController } from '../src/controllers/commissionInvoiceController.js';
const response=()=>({code:200,status(n){this.code=n;return this;},json(body){this.body=body;return this;}});
test('Vietnam day boundaries, leap dates and month compatibility',()=>{
 const p=invoiceDayPeriod('2026-11-08');
 assert.equal(p.start.toISOString(),'2026-11-07T17:00:00.000Z');
 assert.equal(p.end.toISOString(),'2026-11-08T16:59:59.999Z');
 assert.equal(vietnamDay(new Date('2026-11-07T17:00:00Z')),'2026-11-08');
 for(const d of ['2026-02-29','2026-11-31','2026-1-01','1999-12-31','bad'])assert.throws(()=>invoiceDayPeriod(d));
 assert.equal(invoiceDayPeriod('2028-02-29').day,'2028-02-29');
 assert.equal(getCommissionPeriod({day:'2026-11-08'}).periodKey,'N2026-11-08');
 assert.equal(getCommissionPeriod({year:'2026',month:'10'}).start.toISOString(),'2026-09-30T17:00:00.000Z');
});
test('summary includes backlog and missing fee review while excluding zero fee trips',async()=>{
 const calls=[];const values=[5,2,3,7];
 const s=await commissionInvoiceSummary({commissionInvoiceState:{count:async q=>{calls.push(q);return values[calls.length-1];}}},'2026-11-08');
 assert.equal(s.totalPending,10);assert.equal(s.confirmedToday,2);
 assert.equal(calls[3].where.recognizedAt.lt.toISOString(),'2026-11-07T17:00:00.000Z');
 assert.deepEqual(calls[2].where.trip.OR,[{commissionAmountSnapshot:{gt:0}},{commissionAmountSnapshot:null}]);
 assert.equal(calls[2].where.issuedAt,null);
});
test('21h reminder persists once, targets admins and does not change invoice status',async()=>{
 let alert=null,locks=0,pushes=0,counts=0;
 const tx={$queryRaw:async()=>{locks++;},adminAlertLog:{findFirst:async()=>alert,create:async({data})=>(alert={id:'a1',...data})},commissionInvoiceState:{count:async()=>[3,1,2,4][counts++],findFirst:async()=>({tripId:'t1'})}};
 const db={$transaction:async fn=>fn(tx)};
 assert.equal(await runCommissionInvoiceReminder({db,now:new Date('2026-11-08T13:59:59Z')}),null);assert.equal(locks,0);
 const notify=async data=>{pushes++;assert.deepEqual(data.roles,['ADMIN','admin']);assert.equal(data.data.day,'2026-11-08');};
 const a=await runCommissionInvoiceReminder({db,notify,now:new Date('2026-11-08T14:00:00Z')});
 assert.match(a.message,/còn 2 chưa/);assert.match(a.message,/kỳ trước còn 4/);
 assert.equal(await runCommissionInvoiceReminder({db,notify,now:new Date('2026-11-08T15:00:00Z')}),null);
 assert.equal(pushes,1);assert.equal(locks,2);
});
test('no reminder when no pending invoices',async()=>{
 const db={$transaction:async fn=>fn({$queryRaw:async()=>{},adminAlertLog:{findFirst:async()=>null},commissionInvoiceState:{count:async()=>0}})};
 assert.equal(await runCommissionInvoiceReminder({db,now:new Date('2026-11-08T14:00:00Z')}),null);
});
test('manual confirmation writes only invoice state, validates input and rejects duplicates',async()=>{
 let saved=false,writes=0;
 const db={$transaction:async fn=>fn({commissionInvoiceState:{findUnique:async()=>({trip:{status:'COMPLETED',commissionAmountSnapshot:100}}),updateMany:async q=>{writes++;assert.equal(q.where.issuedAt,null);assert.equal(q.data.invoiceNumber,'ABC/123');assert.equal(q.data.issuedAt.toISOString(),'2026-10-30T17:00:00.000Z');if(saved)return{count:0};saved=true;return{count:1};}}})};
 const c=makeCommissionInvoiceController(db),req={params:{tripId:'t1'},body:{issuedDay:'2026-10-31',invoiceNumber:' ABC/123 '},admin:{username:'admin'}};
 let res=response();await c.confirmIssued(req,res);assert.equal(res.code,200);
 res=response();await c.confirmIssued(req,res);assert.equal(res.code,409);
 for(const body of [{issuedDay:'2026-02-30',invoiceNumber:'x'},{issuedDay:'2026-10-31',invoiceNumber:''},{issuedDay:'2100-01-01',invoiceNumber:'x'}]){res=response();await c.confirmIssued({...req,body},res);assert.equal(res.code,400);}
 assert.equal(writes,2);
});
