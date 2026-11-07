import test from 'node:test';
import assert from 'node:assert/strict';
import { makeAdminController } from '../src/controllers/adminController.js';
import { getAccountingPeriod } from '../src/services/accountingQuarter.js';
function response() { return { statusCode: 200, headers: {}, status(n) { this.statusCode=n; return this; }, json(body) { this.body=body; return this; }, setHeader(k,v) { this.headers[k]=v; }, send(body) { this.body=body; return this; } }; }
test('monthly boundaries use Vietnam time including leap year and year end', () => {
  const feb = getAccountingPeriod(2028, 4, 2);
  assert.equal(feb.start.toISOString(), '2028-01-31T17:00:00.000Z');
  assert.equal(feb.end.toISOString(), '2028-02-29T16:59:59.999Z');
  assert.equal(feb.quarter, 1);
  assert.equal(getAccountingPeriod(2026, 1, 12).end.toISOString(), '2026-12-31T16:59:59.999Z');
  assert.equal(getAccountingPeriod(2026, 4).periodKey, 'Q4_2026');
  assert.throws(() => getAccountingPeriod(2026, 1, 13));
});
test('commission detail and CSV retain per-trip fee, identity, zero and missing fee flags', async () => {
  let where;
  const ctrl = makeAdminController({ trip: { findMany: async args => {
    where=args.where;
    return [{id:'trip-A',updatedAt:new Date('2026-10-31T17:00:00Z'),driverId:'driver-A',totalPrice:1000000,
      commissionAmountSnapshot:108000,commissionPercentSnapshot:10.8,
      driver:{displayName:'A',phones:[{e164:'0123456789'}],driverProfile:{fullName:'Tài xế A',citizenId:'001234567890'}}},
      {id:'trip-B',updatedAt:new Date(),totalPrice:100,commissionAmountSnapshot:null}];
  } } });
  const res=response(); await ctrl.getCommissionDetails({query:{month:'11',year:'2026'}}, res);
  assert.equal(res.statusCode,200); assert.equal(where.status,'COMPLETED');
  assert.equal(where.updatedAt.gte.toISOString(),'2026-10-31T17:00:00.000Z');
  assert.deepEqual(res.body.totals,{gross:108000,net:100000,vat:8000});
  assert.match(res.body.items[1].note,/Thiếu/);
  assert.equal(res.body.items[0].citizenId,'001234567890');
  const csv=response(); await ctrl.getCommissionDetails({query:{quarter:'4',year:'2026',format:'csv'}},csv);
  assert.match(csv.headers['Content-Disposition'],/Q4_2026/);
  assert.ok(csv.body.startsWith('\uFEFF'));
  assert.match(csv.body,/"trip-A"/);assert.match(csv.body,/"108000","100000","8000"/);
});
test('invalid period does not query database', async () => {
  const ctrl=makeAdminController({});
  for (const query of [{month:'13',year:'2026'},{month:'1.5',year:'2026'},{quarter:'0',year:'2026'},{month:'11',year:'foo'}]) {
    const res=response();await ctrl.getCommissionDetails({query},res);assert.equal(res.statusCode,400);
    const preview=response();await ctrl.getAccountingExportPreview({query},preview);assert.equal(preview.statusCode,400);
  }
});
test('monthly package uses selected month for documents and all transaction ranges; flags unassigned documents', async () => {
  const docs=[], ranges=[];
  const empty = async args => { if (args?.where) ranges.push(args.where); return []; };
  const ctrl=makeAdminController({
    accountingDocument:{count:async ({where})=>{docs.push(where);return where.month===null ? 3 : 0;}},
    accountingNote:{count:async ({where})=>{assert.ok(where.createdAt);return 0;}},
    companyCashTransaction:{count:async ({where})=>{ranges.push(where);return 0;}},
    driverWalletTransaction:{findMany:empty}, driverWithdrawRequest:{count:async ({where})=>{ranges.push(where);return 0;}},
    trip:{findMany:empty,count:async ({where})=>{ranges.push(where);return 0;}},
    driverTripPenaltyLog:{findMany:empty,count:async ({where})=>{ranges.push(where);return 0;}},
  });
  const res=response();await ctrl.getAccountingExportPackage({query:{month:'11',year:'2026'}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.data.month,11);
  assert.match(res.body.data.zipFileName,/T11_2026/);
  assert.equal(res.body.data.unassignedDocumentCount,3);
  assert.equal(docs.filter(d=>d.month===11).length,5);
  for (const where of ranges) for (const value of Object.values(where)) if(value?.gte) {
    assert.equal(value.gte.toISOString(),'2026-10-31T17:00:00.000Z');
    assert.equal(value.lte.toISOString(),'2026-11-30T16:59:59.999Z');
  }
  assert.ok(res.body.data.groups.some(g=>g.key==='COMMISSION_DETAIL_EXPORT' && g.fileName.endsWith('T11_2026.csv')));
});

test('monthly ZIP contains commission CSV and monthly PDF labels', async () => {
  const { PassThrough } = await import('node:stream');
  const { writeFile, mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { execFileSync } = await import('node:child_process');
  const { join } = await import('node:path');
  const docs=[];
  const model={findMany:async()=>[],count:async()=>0,aggregate:async()=>({_sum:{},_count:{id:0}})};
  const prisma=new Proxy({}, {get:()=>model});
  const ctrl=makeAdminController({...prisma, trip:model, driverWalletTransaction:model, driverProfile:model,
    driverTripPenaltyLog:model, driverWithdrawRequest:model, companyCashTransaction:model, accountingNote:model,
    accountingDocument:{...model,findMany:async ({where})=>{docs.push(where);return [];}}});
  const res=new PassThrough(); res.headers={};res.setHeader=(k,v)=>res.headers[k]=v;
  res.status=code=>{throw new Error(`Unexpected status ${code}`);};
  const chunks=[];res.on('data',chunk=>chunks.push(chunk));
  await ctrl.exportAccountingZip({query:{month:'11',year:'2026'},admin:{username:'test'}},res);
  assert.match(res.headers['Content-Disposition'],/T11_2026/);
  assert.equal(docs.length,5);assert.ok(docs.every(d=>d.month===11 && d.quarter===4));
  const dir=await mkdtemp(join(tmpdir(),'goviet-accounting-'));
  try {
    const file=join(dir,'test.zip');await writeFile(file,Buffer.concat(chunks));
    const output=execFileSync('python3',['-c',`import zipfile,sys
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 assert '14-chi-tiet-hoa-hong/chi_tiet_hoa_hong_T11_2026.csv' in z.namelist()
 assert any(n.startswith('14-chi-tiet-hoa-hong/') and n.endswith('.pdf') for n in z.namelist())
 assert 'Tháng: 11' in z.read('README.txt').decode()
 assert all('Q4_' not in n for n in z.namelist())
 print('ZIP OK')`,file],{encoding:'utf8'});
    assert.match(output,/ZIP OK/);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('all ledger PDF report types export valid monthly PDFs', async () => {
  const ranges=[];
  const model={count:async()=>0,findMany:async args=>{ranges.push(args?.where);return [];},aggregate:async()=>({_sum:{},_count:{id:0}})};
  const ctrl=makeAdminController(new Proxy({}, {get:()=>model}));
  for(const reportType of ['cash','wallet','trips','withdraw','revenue','notes','commission','documents']) {
    const res=response();
    await ctrl.exportAccountingReportPdf({query:{year:'2026',month:'11',reportType,documentType:'BANK_STATEMENT'}},res);
    assert.equal(res.statusCode,200,reportType);
    assert.equal(res.headers['Content-Type'],'application/pdf');
    assert.match(res.headers['Content-Disposition'],/T11_2026/);
    assert.equal(res.body.subarray(0,4).toString(),'%PDF');
  }
  assert.ok(ranges.some(w=>w?.month===11));
  const invalid=response();await ctrl.exportAccountingReportPdf({query:{year:'2026',month:'13',reportType:'cash'}},invalid);assert.equal(invalid.statusCode,400);
});
