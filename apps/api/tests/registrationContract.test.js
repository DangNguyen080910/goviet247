import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registrationDriverContract, activeDriverContract, contractHash, buildContractAcceptance, validateContractSubmission } from '../src/services/driverContract.js';
import { makeDriverContractController } from '../src/controllers/driverContractController.js';
const legacy = JSON.parse(readFileSync(new URL('../src/contracts/driver-partnership-v1.json',import.meta.url)));
const store = row => ({driverContractVersion:{findFirst:async()=>row}});

test('new registration gets only the softened clause under a new version and hash; legacy stays unchanged',async()=>{
 const oldHash=contractHash(legacy);
 const {contract,release}=await registrationDriverContract(store(null),{});
 assert.equal(contract.version,'v1.2-2026-11-11');
 assert.equal(release,null);
 assert.doesNotMatch(JSON.stringify(contract),/khách hàng được miễn phí|khoá vĩnh viễn|kể cả khi khách yêu cầu/);
 assert.match(JSON.stringify(contract),/tiếp nhận giải trình/);
 assert.match(JSON.stringify(contract),/nhận chuyến ngoài hệ thống/);
 assert.equal(contract.sections[0].paragraphs.length,legacy.sections[0].paragraphs.length+1);
 assert.equal(activeDriverContract({}).contentHash,oldHash);
 assert.notEqual(contract.contentHash,oldHash);
 const profile={id:'p',userId:'u',fullName:'A',citizenId:'001234567890',residentialAddress:'X'};
 const body={contractAccepted:true,contractCode:contract.code,contractVersion:contract.version,contractFileHash:contract.contentHash};
 const record=buildContractAcceptance(body,profile,{}, {},contract);
 assert.equal(record.contentSnapshot.content.version,contract.version);
 assert.equal(record.contentSnapshot.contentHash,contract.contentHash);
 assert.throws(()=>validateContractSubmission({...body,contractVersion:'v1.0',contractFileHash:oldHash},{},contract),e=>e.statusCode===409);
});

test('published harsh content is revised for registration without mutating its stored source',async()=>{
 const content={...structuredClone(legacy),version:'v-published'};
 const row={id:'r',version:content.version,content,publishedAt:new Date(),graceDays:7};
 const before=structuredClone(row);
 const result=await registrationDriverContract(store(row),{});
 assert.equal(result.contract.version,'v-published-contact-20261111');
 assert.doesNotMatch(JSON.stringify(result.contract),/khách hàng được miễn phí/);
 assert.deepEqual(row,before);
 const softened={...row,content:result.contract,version:result.contract.version};
 assert.equal((await registrationDriverContract(store(softened),{})).contract.version,result.contract.version);
});

test('registration endpoint serves softened content to users without a driver profile',async()=>{
 const db={...store(null),driverProfile:{findUnique:async()=>null}};
 const res={setHeader(){},json(body){this.body=body;return this;}};
 await makeDriverContractController(db,{}).current({user:{uid:'new'}},res);
 assert.equal(res.body.contract.version,'v1.2-2026-11-11');
 assert.equal(res.body.needsAcceptance,false);
 assert.equal(res.body.history.length,0);
});

test('temporary compatibility records the legacy app consent without claiming a verified snapshot', async () => {
 const { registrationContractForSubmission } = await import('../src/services/driverContract.js');
 const body = { contractAccepted: true, contractCode: legacy.code, contractVersion: legacy.version };
 const db = store(null);
 const env = { DRIVER_REGISTRATION_ALLOW_LEGACY_V1: 'true' };
 const selected = await registrationContractForSubmission(db, body, env);
 const record = buildContractAcceptance(body, {id:'p',userId:'u'}, {}, env, selected);
 assert.equal(record.contractVersion, 'v1.0');
 assert.equal(record.contentSnapshot.contentVerified, false);
 const strict = await registrationContractForSubmission(db, body, {});
 assert.throws(() => validateContractSubmission(body, {}, strict), {statusCode:409});
 const modern = await registrationDriverContract(db, env);
 const modernBody = {...body, contractVersion:modern.contract.version, contractFileHash:modern.contract.contentHash};
 assert.deepEqual(await registrationContractForSubmission(db, modernBody, env), modern.contract);
});
