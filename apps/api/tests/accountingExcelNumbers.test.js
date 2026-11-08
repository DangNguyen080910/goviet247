import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { buildAccountingExcel, parseAccountingExcelNumber } from '../src/services/accountingExcel.js';
import { makeAdminController } from '../src/controllers/adminController.js';

async function cells(buffer, member) {
  const dir = await mkdtemp('/private/tmp/accounting-number-test-');
  try {
    const file = `${dir}/report.xlsx`; await writeFile(file, buffer);
    return JSON.parse(execFileSync('python3', ['-c', `import zipfile,sys,json,io,xml.etree.ElementTree as E
outer=zipfile.ZipFile(sys.argv[1])
with (zipfile.ZipFile(io.BytesIO(outer.read(sys.argv[2]))) if len(sys.argv)>2 else outer) as z:
 assert z.testzip() is None
 ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
 root=E.fromstring(z.read('xl/worksheets/sheet1.xml'))
 print(json.dumps({c.attrib['r']:{'type':c.attrib.get('t'),'style':c.attrib.get('s'),'value':''.join(c.itertext())} for c in root.findall('.//s:c',ns)}))`, file, ...(member ? [member] : [])], { encoding: 'utf8' }));
  } finally { await rm(dir, {recursive:true, force:true}); }
}

test('Vietnamese formatted amounts are parsed explicitly, including negatives, zero and decimals', () => {
  for (const [input, expected] of [['236.700',236700],['58.775',58775],['1.447.870',1447870],['309.610',309610],['500.000',500000],['-2.633.115',-2633115],['0',0],['584',584],['1.234,56',1234.56],['-62.400',-62400]])
    assert.equal(parseAccountingExcelNumber(input,'vi-VN'),expected,input);
  assert.equal(parseAccountingExcelNumber('6.5','raw'),6.5);
  assert.equal(parseAccountingExcelNumber(6.5,'vi-VN'),6.5);
  for (const input of ['', ' ', 'Chưa cập nhật', '=1+1', '12.34.567', '6.5', 'NaN', 'Infinity'])
    assert.equal(parseAccountingExcelNumber(input,'vi-VN'),null,input);
});

test('every affected monetary column exports actual numeric Excel cells; identities stay text', async () => {
  const headers=['Phí môi giới đã thu (đã gồm VAT)','Số tiền','Giá trị','Tổng khấu trừ','Tài xế thực nhận','Phạt huỷ chuyến','Tổng đã giữ','Số dư trước','Số dư sau','Số chuyến hoàn thành','CCCD / số định danh','SĐT','Mã chuyến','Ghi chú','Thuế suất VAT phí môi giới'];
  const values=['236.700','58.775','1.447.870','355.050','2.274.950','80.100','167.400','1.000.000','791.350','18','001234567890','0901234567','000123','=HYPERLINK("bad")','8%'];
  const result=await cells(await buildAccountingExcel([headers,values],{numberLocale:'vi-VN'}));
  const expected=[236700,58775,1447870,355050,2274950,80100,167400,1000000,791350,18];
  expected.forEach((value,i)=>{const cell=result[`${String.fromCharCode(65+i)}2`];assert.equal(cell.type,null);assert.equal(Number(cell.value),value);});
  for (const [ref,value] of [['K2','001234567890'],['L2','0901234567'],['M2','000123'],['N2','=HYPERLINK("bad")']]) {
    assert.equal(result[ref].type,'inlineStr');assert.equal(result[ref].value,value);
  }
  assert.equal(result.O2.value,'0.08');assert.equal(result.O2.style,'3');
});

test('raw commission percentages and numeric invoice values are never multiplied by 1000', async () => {
  const result=await cells(await buildAccountingExcel([
    ['Tỷ lệ hoa hồng (%)','Phí hoa hồng gồm VAT','VAT','Số tiền'],
    ['6.5','62400','4622','0'],
    [7.9,1234567,9.25,-500],
  ]));
  assert.equal(result.A2.value,'6.5');assert.equal(result.B2.value,'62400');
  assert.equal(result.A3.value,'7.9');assert.equal(result.B3.value,'1234567');
  assert.equal(result.C3.value,'9.25');assert.equal(result.D3.value,'-500');
});

test('standalone cash export passes localized CSV amounts through the correct number format', async () => {
  const ctrl=makeAdminController({companyCashTransaction:{findMany:async()=>[
    {txnDate:new Date('2026-08-05T00:00:00Z'),type:'OUT',category:'MARKETING',amount:58775,note:'Test'},
    {txnDate:new Date('2026-08-05T00:00:00Z'),type:'IN',category:'OTHER_IN',amount:1234567,note:'Test'},
  ]}});
  const res={statusCode:200,headers:{},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;},setHeader(k,v){this.headers[k]=v;},send(body){this.body=body;return this;}};
  await ctrl.exportAccountingReportPdf({query:{year:'2026',month:'8',reportType:'cash',format:'xlsx'}},res);
  assert.equal(res.statusCode,200);
  const result=await cells(res.body);
  assert.equal(result.F2.type,null);assert.equal(result.F2.value,'58775');
  assert.equal(result.F3.type,null);assert.equal(result.F3.value,'1234567');
});

test('standalone commission export keeps decimal percentage and raw VND values', async () => {
  const trip={id:'trip-test',updatedAt:new Date('2026-10-01T00:00:00Z'),driverId:'d1',totalPrice:960000,commissionAmountSnapshot:62400,commissionPercentSnapshot:6.5,
    driver:{displayName:'Tài xế',phones:[{e164:'0901234567'}],driverProfile:{citizenId:'001234567890'}}};
  const ctrl=makeAdminController({trip:{findMany:async()=>[trip]}});
  const res={status(n){throw Error(`Unexpected ${n}`);},setHeader(){},send(body){this.body=body;return this;}};
  await ctrl.exportAccountingReportPdf({query:{year:'2026',month:'10',reportType:'commission',format:'xlsx'}},res);
  const result=await cells(res.body);
  assert.equal(result.I2.value,'6.5');assert.equal(result.J2.value,'62400');
  assert.equal(result.F2.type,'inlineStr');assert.equal(result.F2.value,'001234567890');
});

test('accounting ZIP cash report exports nonempty localized amounts as numeric VND', async () => {
  const {PassThrough}=await import('node:stream');
  const model={findMany:async()=>[],count:async()=>0,aggregate:async()=>({_sum:{},_count:{id:0}})};
  const db=new Proxy({companyCashTransaction:{...model,findMany:async()=>[
    {txnDate:new Date('2026-08-05T00:00:00Z'),type:'OUT',category:'MARKETING',amount:58775,note:'Test'},
    {txnDate:new Date('2026-08-05T00:00:00Z'),type:'IN',category:'OTHER_IN',amount:1234567,note:'Test'},
  ]}}, {get:(target,key)=>target[key] || model});
  const res=new PassThrough();res.setHeader=()=>{};res.status=n=>{throw Error(`Unexpected ${n}`);};
  const chunks=[];res.on('data',chunk=>chunks.push(chunk));
  await makeAdminController(db).exportAccountingZip({query:{month:'8',year:'2026',format:'xlsx'},admin:{username:'test'}},res);
  const result=await cells(Buffer.concat(chunks),'04-thu-chi-cong-ty/thu_chi_cong_ty_T08_2026.xlsx');
  assert.equal(result.F2.type,null);assert.equal(result.F2.value,'58775');
  assert.equal(result.F3.type,null);assert.equal(result.F3.value,'1234567');
});
