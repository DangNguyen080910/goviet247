import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pkg from '@prisma/client';
import {pathToFileURL} from 'node:url';
import {createNotificationOutbox,notificationAlreadyAccepted,recordNotificationAccepted} from '../src/services/notificationOutbox.js';
import {createBookingQuoteService} from '../src/services/bookingQuotes.js';
import {buildDestinationSnapshot,destinationSignature,assertDestinationQuote} from '../src/services/destinationService.js';
import {buildRegionalSurcharge,regionalPricingSignature,assertRegionalQuote} from '../src/services/regionalPricing.js';
const url=process.env.NOTIFICATION_TEST_DB_URL;
test('PostgreSQL: migrate, concurrent workers, restart, accepted-token checkpoint and retry',{skip:!url},async()=>{
  const parsed=new URL(url);
  assert.ok(['localhost','127.0.0.1'].includes(parsed.hostname));assert.match(parsed.pathname,/^\/goviet247_notification_test_[a-z0-9_]+$/);
  // CI/dev can generate an isolated client without replacing a shared workspace client.
  const client=process.env.NOTIFICATION_TEST_CLIENT ? await import(pathToFileURL(process.env.NOTIFICATION_TEST_CLIENT).href) : pkg;
  const db=new client.PrismaClient({datasources:{db:{url}}}),logger={error(){}};
  try{
    const sql=readFileSync(new URL('../prisma/migrations/20261123120000_notification_outbox/migration.sql',import.meta.url),'utf8');
    for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await db.$executeRawUnsafe(statement);
    const q1=createNotificationOutbox({db,logger}),q2=createNotificationOutbox({db,logger});
    for(let i=0;i<8;i++)await q1.enqueue('push',[i],()=>assert.fail('fallback'));
    const delivered=[];
    await Promise.all([q1.drain(async(_,args)=>{delivered.push(args[0]);}),q2.drain(async(_,args)=>{delivered.push(args[0]);})]);
    assert.equal(delivered.length,8);assert.equal(new Set(delivered).size,8);
    await q1.enqueue('retry',[],()=>assert.fail('fallback'));
    await q1.drain(async()=>{await recordNotificationAccepted('first-device');throw Error('second offline');});
    let rows=await db.$queryRawUnsafe('SELECT * FROM "NotificationJob" WHERE kind=$1','retry');
    assert.equal(rows[0].attempts,1);assert.equal(rows[0].completedAt,null);assert.equal(rows[0].acceptedTokens.length,1);
    await db.$executeRawUnsafe('UPDATE "NotificationJob" SET "runAt"=now() WHERE kind=$1','retry');
    const restarted=createNotificationOutbox({db,logger});let retried=0;
    await restarted.drain(async()=>{assert.equal(notificationAlreadyAccepted('first-device'),true);retried++;await recordNotificationAccepted('second-device');});
    rows=await db.$queryRawUnsafe('SELECT * FROM "NotificationJob" WHERE kind=$1','retry');assert.equal(retried,1);assert.ok(rows[0].completedAt);assert.equal(rows[0].attempts,2);assert.equal(rows[0].acceptedTokens.length,2);
    // Simulate a process dying with a lease. A different worker can reclaim it after expiry.
    await q1.enqueue('crash',[],()=>assert.fail('fallback'));
    await db.$executeRawUnsafe('UPDATE "NotificationJob" SET "lockedUntil"=now()-interval \'1 minute\',"lockToken"=$1 WHERE kind=$2','dead-worker','crash');
    let recovered=0;await restarted.drain(async kind=>{assert.equal(kind,'crash');recovered++;});assert.equal(recovered,1);
    // Also verify the earlier booking hotfix across a real PostgreSQL JSONB round trip.
    await db.$executeRawUnsafe('CREATE TABLE "BookingQuote" ("tokenHash" TEXT PRIMARY KEY,"requestHash" TEXT NOT NULL,route JSONB NOT NULL,pricing JSONB NOT NULL,"expiresAt" TIMESTAMPTZ(6) NOT NULL,"createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now())');
    const input={pickupAddress:'A',dropoffAddress:'B',stops:['B'],destinationAnchorAddress:'B',carType:'CAR_5',direction:'ONE_WAY',pickupTime:'2099-01-01T08:00:00+07:00'};
    const snapshot=buildDestinationSnapshot(null,input),regional=await buildRegionalSurcharge(input,null,100000);
    const data={finalPrice:100000,pricePerKm:10000,distanceKm:10,destinationService:snapshot,destinationServiceSignature:destinationSignature(snapshot),regionalSurcharge:regional,regionalPricingSignature:regionalPricingSignature(regional)};
    const quotes=createBookingQuoteService({db});
    const token=await quotes.issue(input,data,{distanceKm:10,driveMinutes:20});
    const held=await quotes.booking({...input,...token});
    assert.notEqual(JSON.stringify(held.pricing.destinationService),JSON.stringify(snapshot),'PostgreSQL must exercise its actual JSONB object ordering');
    assertDestinationQuote(data,held.pricing.destinationService,held.pricing.destinationServiceSignature);
    assertRegionalQuote(data,held.pricing.regionalSurcharge,held.pricing.regionalPricingSignature);
    assert.equal(held.pricing.totalPrice,100000);
  }finally{await db.$disconnect();}
});
