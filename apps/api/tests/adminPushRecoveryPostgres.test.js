import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pkg from '@prisma/client';
import {wakeUnsentAdminTripPush} from '../src/services/adminPushRecovery.js';
const url=process.env.ADMIN_PUSH_RECOVERY_DB_URL;
test('PostgreSQL recovery wakes only recent unsent alerts for unreviewed trips, never delivered/old/locked/other events',{skip:!url},async()=>{
  const parsed=new URL(url);assert.ok(['localhost','127.0.0.1'].includes(parsed.hostname));assert.match(parsed.pathname,/^\/goviet247_admin_push_test_[a-z0-9_]+$/);
  const db=new pkg.PrismaClient({datasources:{db:{url}}});
  try{
    const sql=readFileSync(new URL('../prisma/migrations/20261123120000_notification_outbox/migration.sql',import.meta.url),'utf8');
    for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.$executeRawUnsafe(statement);
    await db.$executeRawUnsafe('CREATE TABLE "Trip" (id TEXT PRIMARY KEY,status TEXT NOT NULL,"isVerified" BOOLEAN NOT NULL,"cancelledAt" TIMESTAMPTZ)');
    for(const [id,status,verified] of [['waiting','PENDING',false],['reviewed','PENDING',true],['cancelled','CANCELLED',false]])await db.$executeRawUnsafe('INSERT INTO "Trip" (id,status,"isVerified") VALUES ($1,$2,$3)',id,status,verified);
    const cases=[
      {id:'missed'}, {id:'retry',pending:true,error:'ADMIN_PUSH_NO_ACTIVE_DEVICE'},
      {id:'sent',accepted:['hash']},{id:'reviewed',trip:'reviewed'},{id:'cancelled',trip:'cancelled'},
      {id:'old',ageHours:3},{id:'locked',locked:true},{id:'other',source:'driver_accept_trip'},
      {id:'retry-network',pending:true,error:'TypeError'},
    ];
    for(const item of cases){
      await db.$executeRawUnsafe(`INSERT INTO "NotificationJob" (id,kind,payload,"expiresAt","createdAt","completedAt","acceptedTokens","lockedUntil",attempts,"lastError","runAt")
        VALUES ($1,'sendAdminPushNotification',$2::jsonb,now()+interval '1 day',now()-($3*interval '1 hour'),$4,$5::text[],$6,8,$7,now()+interval '1 hour')`,
        item.id,JSON.stringify([{data:{source:item.source || 'create_trip',tripId:item.trip || 'waiting'}}]),item.ageHours || 0,item.pending?null:new Date(),item.accepted || [],item.locked?new Date(Date.now()+60000):null,item.error || null);
    }
    assert.equal(await wakeUnsentAdminTripPush(db),2);
    const rows=await db.$queryRawUnsafe('SELECT id,attempts,"completedAt","lastError","runAt"<now() AS ready FROM "NotificationJob"');
    const ready=rows.filter(row=>row.ready).map(row=>row.id).sort();assert.deepEqual(ready,['missed','retry']);
    for(const row of rows.filter(row=>ready.includes(row.id))){assert.equal(row.attempts,0);assert.equal(row.completedAt,null);assert.equal(row.lastError,null);}
    assert.equal(await wakeUnsentAdminTripPush(db),0,'repeated registration cannot reset already recovered jobs again');
  }finally{await db.$disconnect();}
});
