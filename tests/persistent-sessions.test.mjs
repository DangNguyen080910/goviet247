import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionService } from '../apps/api/src/services/userSessions.js';
import { signToken, signPersistentToken, verifyJwtToken, signAdminToken } from '../apps/api/src/utils/jwt.js';
process.env.JWT_SECRET = 'test-only-secret-not-for-production';
process.env.ADMIN_JWT_SECRET = 'test-only-admin-secret';
process.env.JWT_EXPIRES = 'never';
const claims = { uid: 'u1', id: 'u1', role: 'RIDER', appRole: 'RIDER', phone: '+84000000000' };
function setup() {
  const rows = new Map();
  const db = { session: {
    async findUnique({where}) { return rows.get(where.id) || null; },
    async create({data}) { if(rows.has(data.id)) throw Object.assign(new Error('duplicate'),{code:'P2002'}); rows.set(data.id,data); return data; },
    async upsert({where,create,update}) { const value = rows.has(where.id) ? {...rows.get(where.id),...update} : create; rows.set(where.id,value); return value; },
  }};
  return { rows, db, service:createSessionService(db) };
}
test('persistent token has no exp, survives a new service instance, logout revokes it', async()=>{
  const {service,db}=setup(); const token=await service.issue(claims);
  assert.equal(verifyJwtToken(token).exp,undefined);
  const restarted=createSessionService(db); const verified=await restarted.verify(token);
  await restarted.revoke(token,verified);
  await assert.rejects(service.verify(token), {status:401});
});
test('legacy clients and admins retain bounded tokens even when persistent mode enabled',()=>{
  assert.ok(verifyJwtToken(signToken(claims)).exp);
  const admin=signAdminToken({id:'a',role:'ADMIN'});
  assert.ok(JSON.parse(Buffer.from(admin.split('.')[1],'base64url')).exp);
});
test('parallel legacy upgrades return the same token; revocation blocks both old and new',async()=>{
  const {service,rows}=setup(); const old=signToken(claims); const verified=await service.verify(old);
  const tokens=await Promise.all(Array.from({length:8},()=>service.issue(verified,old)));
  assert.equal(new Set(tokens).size,1);assert.equal(rows.size,1);
  await service.revoke(tokens[0],await service.verify(tokens[0]));
  await assert.rejects(service.verify(old),{status:401});
  await assert.rejects(service.issue(verified,old),{status:401});
});
test('logout before a late upgrade prevents resurrection',async()=>{
  const {service}=setup();const old=signToken(claims);const verified=await service.verify(old);
  await service.revoke(old,verified);
  await assert.rejects(service.issue(verified,old),{status:401});
});
test('revoking one device leaves a separate login active',async()=>{
  const {service}=setup();const a=await service.issue(claims);const b=await service.issue(claims);
  await service.revoke(a,await service.verify(a));assert.equal((await service.verify(b)).uid,'u1');
});
test('missing session, wrong token hash, untracked immortal and expired legacy are rejected',async()=>{
  const {service,rows}=setup();const token=await service.issue(claims);
  rows.values().next().value.refreshTokenHash='wrong';await assert.rejects(service.verify(token),{status:401});
  rows.clear();await assert.rejects(service.verify(token),{status:401});
  await assert.rejects(service.verify(signPersistentToken(claims)),{status:401});
  await assert.rejects(service.verify(signPersistentToken({...claims,exp:1})),{status:401});
});
test('database outage is not reported as expired credentials',async()=>{
  const {service,db}=setup();const token=await service.issue(claims);
  db.session.findUnique=async()=>{throw new Error('database unavailable');};
  await assert.rejects(service.verify(token),e=>e.message==='database unavailable' && e.status!==401);
});
