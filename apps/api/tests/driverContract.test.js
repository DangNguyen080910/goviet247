import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {activeDriverContract,buildContractAcceptance,validateContractSubmission,acceptanceEvidence,renderContractEvidence} from '../src/services/driverContract.js';
import {makeDriverContractController} from '../src/controllers/driverContractController.js';
const legacyEnv={DRIVER_CONTRACT_RECONSENT_ENABLED:'true'};
const approvedEnv={DRIVER_CONTRACT_RECONSENT_ENABLED:'true',DRIVER_CONTRACT_VERSION:'v2.0-2026-11-09',DRIVER_CONTRACT_V2_APPROVED:'true'};
const profile={id:'d1',userId:'u1',fullName:'Nguyễn An',citizenId:'001234567890',residentialAddress:'12 Nguyễn Trãi',plateNumber:'51A12345',updatedAt:new Date('2026-11-09T01:00:00Z'),user:{phones:[{e164:'+84901234567'}]}};
const payload=env=>{const c=activeDriverContract(env);return {contractAccepted:true,contractCode:c.code,contractVersion:c.version,contractFileHash:c.contentHash,expectedUpdatedAt:profile.updatedAt.toISOString()};};
const response=()=>({headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(b){this.body=b;return this;},send(b){this.body=b;return this;}});
const old={id:'old',driverProfileId:'d1',contractCode:'GOVIET247_DRIVER_PARTNERSHIP',contractVersion:'v1.0',agreedAt:new Date('2026-07-03T03:00:00Z'),isActive:true,contractFileHash:null,contentSnapshot:null};
function store(records=[structuredClone(old)]){
 const tx={driverContractVersion:{findFirst:async()=>null},driverProfile:{findUnique:async()=>structuredClone(profile)},$queryRaw:async()=>[],driverContractAcceptance:{
  findFirst:async({where})=>records.find(row=>Object.entries(where).every(([k,v])=>row[k]===v)) || null,
  updateMany:async({where,data})=>{for(const row of records) if(row.driverProfileId===where.driverProfileId && row.isActive)Object.assign(row,data);},
  create:async({data})=>{const row={id:'new',agreedAt:new Date(),...structuredClone(data)};records.push(row);return row;},
  findMany:async()=>records,
 }};
 return {...tx,$transaction:async fn=>fn(tx),records};
}
test('v2 remains unavailable until explicitly approved; default stays v1',()=>{
 assert.equal(activeDriverContract({}).version,'v1.0');
 assert.throws(()=>activeDriverContract({DRIVER_CONTRACT_VERSION:approvedEnv.DRIVER_CONTRACT_VERSION}),e=>e.statusCode===503);
 assert.throws(()=>activeDriverContract({DRIVER_CONTRACT_VERSION:'invented'}),e=>e.statusCode===503);
 assert.equal(activeDriverContract(approvedEnv).version,approvedEnv.DRIVER_CONTRACT_VERSION);
});
test('altered/unknown versions and hashes cannot create evidence; legacy cannot claim v2',()=>{
 for(const patch of [{contractAccepted:false},{contractVersion:'v999'},{contractFileHash:'forged'},{contractCode:'forged'}])assert.throws(()=>validateContractSubmission({...payload(approvedEnv),...patch},approvedEnv),e=>e.statusCode===409);
 assert.throws(()=>validateContractSubmission({...payload(legacyEnv)},approvedEnv),e=>e.statusCode===409);
 assert.throws(()=>validateContractSubmission({...payload(approvedEnv),contractFileHash:undefined},approvedEnv),e=>e.statusCode===409);
});
test('legacy-client receipts never invent exact historical content or accept arbitrary file URLs',()=>{
 const record=buildContractAcceptance({...payload(legacyEnv),contractFileHash:undefined,contractFileUrl:'https://example.com/forged.pdf'},profile,{phoneE164:'+84901234567'},legacyEnv);
 assert.equal(record.contractVersion,'v1.0');assert.equal(record.contractFileUrl,null);assert.equal(record.contractFileHash,null);
 assert.equal(record.contentSnapshot.contentVerified,false);assert.equal(record.contentSnapshot.content,undefined);
});
test('verified snapshots bind original identity and content even after later profile changes',()=>{
 const source=structuredClone(profile);const record=buildContractAcceptance(payload(approvedEnv),source,{phoneE164:'+84901234567'},approvedEnv);
 source.fullName='Changed';source.citizenId='999999999999';
 assert.equal(record.contentSnapshot.identity.fullName,'Nguyễn An');assert.equal(record.contentSnapshot.identity.citizenId,'001234567890');
 assert.equal(record.contentSnapshot.content.version,approvedEnv.DRIVER_CONTRACT_VERSION);assert.equal(record.contractFileHash,activeDriverContract(approvedEnv).contentHash);
 assert.equal(record.otpVerifiedAt,undefined);
 assert.throws(()=>buildContractAcceptance(payload(approvedEnv),{...profile,residentialAddress:null},{},approvedEnv),e=>e.statusCode===422);
});
test('reading current contract never rewrites a previous acceptance',async()=>{
 const db=store();const before=structuredClone(db.records);const res=response();await makeDriverContractController(db,approvedEnv).current({user:{uid:'u1'}},res);
 assert.equal(res.body.contract.version,approvedEnv.DRIVER_CONTRACT_VERSION);assert.equal(res.body.acceptance.contractVersion,'v1.0');assert.deepEqual(db.records,before);
});
test('stale identity and invalid hash fail before modifying historical acceptance',async()=>{
 for(const patch of [{expectedUpdatedAt:'2020-01-01T00:00:00Z'},{contractFileHash:'wrong'}]){
  const db=store();const before=structuredClone(db.records);const res=response();await makeDriverContractController(db,approvedEnv).accept({user:{uid:'u1'},headers:{},body:{...payload(approvedEnv),...patch}},res);
  assert.equal(res.statusCode,409);assert.deepEqual(db.records,before);
 }
});
test('explicit current consent creates a new receipt; retry preserves dates and old content',async()=>{
 const db=store();const ctrl=makeDriverContractController(db,approvedEnv);const req={user:{uid:'u1'},headers:{},ip:'127.0.0.1',body:payload(approvedEnv)};
 const first=response();await ctrl.accept(req,first);assert.equal(first.body.success,true);assert.equal(db.records.length,2);
 assert.equal(db.records[0].contractVersion,'v1.0');assert.equal(db.records[0].agreedAt.toISOString(),old.agreedAt.toISOString());assert.equal(db.records[0].isActive,false);
 const second=response();await ctrl.accept(req,second);assert.equal(db.records.length,2);assert.equal(second.body.acceptance.agreedAt.toISOString(),first.body.acceptance.agreedAt.toISOString());
});
test('evidence export distinguishes current data from historical consent and escapes HTML',async()=>{
 const db=store();const res=response();await makeDriverContractController(db,approvedEnv).exportEvidence({params:{id:'d1'},query:{format:'html'}},res);
 assert.match(res.headers['Content-Disposition'],/\.html/);assert.match(res.body,/chưa có bản nội dung/);assert.doesNotMatch(res.body,/v2\.0-2026-11-09/);
 const html=renderContractEvidence({...profile,fullName:'<script>alert(1)</script>'},[old]);assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
 assert.match(acceptanceEvidence(old).evidenceNotice,/chưa có bản nội dung/);
});
test('DB upgrade is additive with no invented historical dates or consents',()=>{
 const migration=readFileSync(new URL('../prisma/migrations/20261109140000_driver_contract_content_snapshot/migration.sql',import.meta.url),'utf8');
 assert.match(migration,/ADD COLUMN "contentSnapshot" JSONB/);assert.doesNotMatch(migration,/\b(?:UPDATE|DELETE|INSERT)\b/i);
});
