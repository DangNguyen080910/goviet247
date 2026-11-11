import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {draftSchema,checkPublish,makeAdminContractController} from '../src/controllers/adminContractController.js';
import {activeDriverContract,currentDriverContract,contractHash,buildContractAcceptance,assertCurrentContractForNewTrip,validateRegistrationSubmission,registrationDriverContract} from '../src/services/driverContract.js';
import {makeDriverContractController} from '../src/controllers/driverContractController.js';
const c={...activeDriverContract({DRIVER_CONTRACT_VERSION:'v2.0-2026-11-09',DRIVER_CONTRACT_V2_APPROVED:'true'}),version:'v3-test'};delete c.contentHash;
const row={id:'v3',content:c,version:c.version,publishedAt:new Date('2026-01-01'),updatedAt:new Date('2026-01-01'),graceDays:7,requireForNewTrips:true,changeSummary:'Bổ sung thông tin'};
const res=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(b){this.body=b;return this;},setHeader(){}});
test('draft validation requires company, sections, confirmation and bounded grace; strips injected hash',()=>{
 const input={content:c,changeSummary:'Cập nhật',graceDays:7,requireForNewTrips:false};
 assert.equal(draftSchema.parse({...input,content:{...c,contentHash:'forged'}}).content.contentHash,undefined);
 for(const bad of [{graceDays:0},{graceDays:91},{content:{...c,company:{}}},{content:{...c,sections:[]}},{changeSummary:''}])assert.equal(draftSchema.safeParse({...input,...bad}).success,false);
});
test('publish rejects immutable content, stale preview and missing review',()=>{
 const body={expectedUpdatedAt:row.updatedAt.toISOString(),contentHash:contractHash(c),reviewed:true};
 assert.doesNotThrow(()=>checkPublish({...row,publishedAt:null},body));
 assert.throws(()=>checkPublish(row,body),e=>e.statusCode===409);
 assert.throws(()=>checkPublish({...row,publishedAt:null},{...body,contentHash:'old'}),e=>e.statusCode===409);
 assert.throws(()=>checkPublish({...row,publishedAt:null},{...body,reviewed:false}),e=>e.statusCode===400);
});
test('only published DB content is offered; exact content and version are bound to receipt',async()=>{
 const current=await currentDriverContract({driverContractVersion:{findFirst:async()=>row}},{});
 assert.equal(current.contract.version,'v3-test');assert.equal(current.release.deadline.toISOString(),'2026-01-08T00:00:00.000Z');
 const profile={id:'p',userId:'u',fullName:'Nguyễn An',citizenId:'001234567890',residentialAddress:'12 Nguyễn Trãi'};
 const body={contractAccepted:true,contractCode:c.code,contractVersion:c.version,contractFileHash:current.contract.contentHash};
 const receipt=buildContractAcceptance(body,profile,{}, {},current.contract);
 assert.equal(receipt.contentSnapshot.content.version,c.version);
 assert.throws(()=>buildContractAcceptance({...body,contractVersion:'v1.0'},profile,{}, {},current.contract),e=>e.statusCode===409);
});
test('old contracts remain fallback when there is no published version',async()=>{
 const current=await currentDriverContract({driverContractVersion:{findFirst:async()=>null}},{});assert.equal(current.contract.version,'v1.0');assert.equal(current.release,null);
});
test('new-trip restriction is opt-in, respects grace, and accepts only matching receipt',async()=>{
 let acceptance=null;let release={...row,requireForNewTrips:false};
 const db={driverContractVersion:{findFirst:async()=>release},driverContractAcceptance:{findFirst:async({where})=>acceptance&&acceptance.contractFileHash===where.contractFileHash?acceptance:null}};
 await assertCurrentContractForNewTrip(db,{id:'p'},{DRIVER_CONTRACT_RECONSENT_ENABLED:'true'});
 release={...row,publishedAt:new Date()};await assertCurrentContractForNewTrip(db,{id:'p'},{DRIVER_CONTRACT_RECONSENT_ENABLED:'true'});
 release=row;await assert.rejects(()=>assertCurrentContractForNewTrip(db,{id:'p'},{DRIVER_CONTRACT_RECONSENT_ENABLED:'true'}),e=>e.code==='CONTRACT_ACCEPTANCE_REQUIRED');
 acceptance={contractFileHash:contractHash(c)};await assertCurrentContractForNewTrip(db,{id:'p'},{DRIVER_CONTRACT_RECONSENT_ENABLED:'true'});
});
test('published row cannot be edited and failed save never writes',async()=>{
 let writes=0;const tx={$queryRaw:async()=>[],driverContractVersion:{findUnique:async()=>row,update:async()=>{writes++;}}};const db={$transaction:async fn=>fn(tx)};const output=res();
 await makeAdminContractController(db).save({params:{id:row.id},body:{content:c,changeSummary:'edit',graceDays:7,requireForNewTrips:false,expectedUpdatedAt:row.updatedAt.toISOString()},admin:{username:'Admin'}},output);
 assert.equal(output.statusCode,409);assert.equal(writes,0);
});
test('publication changes during reading rejects stale acceptance before any write',async()=>{
 let writes=0;const tx={$queryRaw:async()=>[],driverContractVersion:{findFirst:async()=>row},driverProfile:{findUnique:async()=>({id:'p',userId:'u',fullName:'A',citizenId:'001234567890',residentialAddress:'X',updatedAt:new Date('2026-01-01'),user:{phones:[]}})},driverContractAcceptance:{updateMany:async()=>{writes++;},create:async()=>{writes++;}}};
 const output=res();await makeDriverContractController({$transaction:async fn=>fn(tx)},{DRIVER_CONTRACT_RECONSENT_ENABLED:'true'}).accept({user:{uid:'u'},headers:{},body:{contractAccepted:true,contractCode:c.code,contractVersion:'v1.0',contractFileHash:'old',expectedUpdatedAt:'2026-01-01T00:00:00.000Z'}},output);
 assert.equal(output.statusCode,409);assert.equal(writes,0);
});

test('paused reconsent never blocks trips or writes an existing-driver acceptance', async () => {
 const tx = {$queryRaw: async () => [], driverContractVersion: {findFirst: async () => row}};
 await assertCurrentContractForNewTrip(tx,{id:'p'},{});
 const output=res();
 await makeDriverContractController({$transaction: fn => fn(tx)},{}).accept({user:{uid:'u'},body:{}},output);
 assert.equal(output.statusCode,409);
 assert.match(output.body.message,/tạm dừng/);
});

test('paused current endpoint tells already-installed clients not to prompt reconsent', async () => {
 const db={driverContractVersion:{findFirst:async()=>row},driverProfile:{findUnique:async()=>({id:'p',user:{phones:[]}})},driverContractAcceptance:{findFirst:async()=>null,findMany:async()=>[]}};
 const output=res();
 await makeDriverContractController(db,{}).current({user:{uid:'u'}},output);
 assert.equal(output.body.needsAcceptance,false);
 assert.equal(output.body.reconsentEnabled,false);
 assert.equal(output.body.contract.version,row.version);
});

test('official v2.3 enforces signing after rollout and keeps legacy registration working while paused', async () => {
 const migration = readFileSync(new URL('../prisma/migrations/20261111161000_official_driver_contract/migration.sql', import.meta.url), 'utf8');
 const content = JSON.parse(migration.split('$contract$')[1]);
 const official = {...row, version: content.version, content, graceDays: 0};
 const env = {DRIVER_CONTRACT_RECONSENT_ENABLED: 'false', DRIVER_REGISTRATION_ALLOW_LEGACY_V1: 'true'};
 const db = {
  driverContractVersion: {findFirst: async () => official},
  driverProfile: {findUnique: async () => ({id: 'p', user: {phones: []}})},
  driverContractAcceptance: {findFirst: async () => null, findMany: async () => []},
 };
 const output = res();
 await makeDriverContractController(db, env).current({user: {uid: 'u'}}, output);
 assert.equal(output.body.needsAcceptance, true);
 assert.equal(output.body.contract.version, 'v2.3');
 await assert.rejects(() => assertCurrentContractForNewTrip(db, {id: 'p'}, env), {code: 'CONTRACT_ACCEPTANCE_REQUIRED'});
 const body = {contractAccepted: true, contractCode: content.code, residentialAddress: 'Địa chỉ', contractVersion: 'v1.0'};
 await assert.rejects(() => validateRegistrationSubmission(db, body, env), {statusCode: 409});
 const contract = await validateRegistrationSubmission(db, {...body, contractVersion: content.version, contractFileHash: contractHash(content)}, env);
 assert.equal(contract.confirmation, content.confirmation);
 official.requireForNewTrips = false;
 await makeDriverContractController(db, env).current({user: {uid: 'u'}}, output);
 assert.equal(output.body.needsAcceptance, false);
 assert.equal(output.body.contract.version, 'v2.3');
 await assertCurrentContractForNewTrip(db, {id: 'p'}, env);
 assert.equal((await registrationDriverContract(db, env)).contract.version, 'v2.3');
 const oldBody = {...body, residentialAddress: undefined};
 const legacy = await validateRegistrationSubmission(db, oldBody, env);
 const legacyReceipt = buildContractAcceptance(oldBody, {id:'p', userId:'u', fullName:'Tài xế'}, {}, env, legacy);
 assert.equal(legacyReceipt.contractVersion, 'v1.0');
 assert.equal(legacyReceipt.contentSnapshot.contentVerified, false);
 await assert.rejects(() => validateRegistrationSubmission(db, oldBody, {}), {statusCode: 422});
 await assert.rejects(() => validateRegistrationSubmission(db, {...oldBody, contractVersion: 'v2.3', contractFileHash: contractHash(content)}, env), {statusCode: 422});
 official.requireForNewTrips = true;
 await assert.rejects(() => assertCurrentContractForNewTrip(db, {id: 'p'}, env), {code: 'CONTRACT_ACCEPTANCE_REQUIRED'});
 await assert.rejects(() => validateRegistrationSubmission(db, oldBody, env), {statusCode: 422});

});
