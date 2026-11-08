import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCommissionInvoiceExcel, invoiceHeaders, invoiceIssues } from '../src/services/commissionInvoice.js';
import { makeAdminController } from '../src/controllers/adminController.js';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const item = {tripId:'trip-1',driverId:'d1',driverName:'Nguyễn An',citizenId:'001234567890',residentialAddress:'12 Nguyễn Trãi',driverPhone:'0901234567',commissionGross:108000,commissionNet:100000,commissionVat:8000,vatRate:8,note:''};
test('VIN-HOADON exports 27 ordered columns, independent invoices, typed amounts and text identities', async () => {
  const dir=await mkdtemp('/private/tmp/invoice-test-');
  try {
    const file=dir+'/invoice.xlsx';
    await writeFile(file,await buildCommissionInvoiceExcel([item,{...item,tripId:'trip-2'}]));
    const result=JSON.parse(execFileSync('python3',['-c',`import zipfile,sys,json,xml.etree.ElementTree as E
with zipfile.ZipFile(sys.argv[1]) as z:
 root=E.fromstring(z.read('xl/worksheets/sheet1.xml'))
 ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
 rows=[]
 for row in root.findall('.//s:row',ns):
  rows.append([{ 'ref':c.attrib['r'], 'type':c.attrib.get('t'), 'v': ''.join(c.itertext()) } for c in row])
 print(json.dumps(rows))`,file],{encoding:'utf8'}));
    assert.deepEqual(result[0].map(c=>c.v),invoiceHeaders);
    assert.equal(result.length,3);
    for (const row of result.slice(1)) {
      assert.equal(row.length,27);
      assert.equal(row[1].v,item.citizenId);assert.equal(row[1].type,'inlineStr');
      assert.equal(row[3].v,item.driverName);
      assert.equal(row[5].v,'001234567890');assert.equal(row[5].type,'inlineStr');
      assert.equal(row[8].v,'0901234567');assert.equal(row[8].type,'inlineStr');
      assert.equal(row[7].v,item.residentialAddress);
      assert.equal(row[12].v,'5');assert.equal(row[17].v,'1');
      assert.equal(row[20].v,'1');assert.equal(row[21].v,'100000');
      assert.equal(row[23].v,'8');assert.equal(row[25].v,'8000');
      assert.equal(row[26].v,'108000');assert.equal(row[26].type,null);
    }
    assert.notEqual(result[1][0].v,result[2][0].v);
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('incomplete identity and missing or zero fees are reported rather than silently skipped', async () => {
  assert.deepEqual(invoiceIssues([item]),[]);
  for (const patch of [{citizenId:''},{residentialAddress:' '},{commissionGross:0},{note:'Thiếu phí'}]) {
    assert.equal(invoiceIssues([{...item,...patch}]).length,1);
    await assert.rejects(buildCommissionInvoiceExcel([{...item,...patch}]));
  }
  const ctrl=makeAdminController({trip:{findMany:async()=>[{id:'bad',updatedAt:new Date(),commissionAmountSnapshot:null}]}});
  const res={status(n){this.code=n;return this;},json(body){this.body=body;return this;}};
  await ctrl.getCommissionDetails({query:{year:'2026',month:'10',format:'invoice-xlsx'}},res);
  assert.equal(res.code,422);assert.equal(res.body.issues[0].tripId,'bad');
});
