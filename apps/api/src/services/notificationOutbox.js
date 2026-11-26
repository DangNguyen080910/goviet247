import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash,randomUUID} from 'node:crypto';
import {prisma} from '../utils/db.js';

const delivery=new AsyncLocalStorage();
const digest=token=>createHash('sha256').update(token).digest('hex');
export const isDeliveringNotification=()=>Boolean(delivery.getStore());
export const notificationAlreadyAccepted=token=>delivery.getStore()?.accepted.has(digest(token)) || false;
export async function recordNotificationAccepted(token){
  const job=delivery.getStore(),hash=digest(token);
  if(!job || job.accepted.has(hash))return;
  if(job.id){
    const updated=await job.db.$executeRawUnsafe('UPDATE "NotificationJob" SET "acceptedTokens"=array_append("acceptedTokens",$1), "lockedUntil"=now()+interval \'2 minutes\' WHERE id=$2 AND "lockToken"=$3',hash,job.id,job.lockToken);
    if(!updated)throw new Error('NOTIFICATION_LEASE_LOST');
  }
  job.accepted.add(hash);
}
export const AUTO_APPROVAL_JOB_KINDS=['tripAutoApprove','tripAutoApprovalRealtime'];
export function createNotificationOutbox({db=prisma,logger=console,kinds=null,excludeKinds=[]}={}){
  let running=false,workerRetryAt=0;
  const run=(job,fn)=>delivery.run({...job,db,accepted:new Set(job.acceptedTokens || [])},fn);
  async function enqueue(kind,args,fallback){
    const json=JSON.stringify(args);
    try{
      await db.$executeRawUnsafe('INSERT INTO "NotificationJob" (id,kind,payload,"expiresAt") VALUES ($1,$2,$3::jsonb,now()+interval \'24 hours\')',randomUUID(),kind,json);
      return {queued:true};
    }catch(error){
      // A notification failure after the business commit must never report a failed booking/payment.
      // This also keeps old API/DB deployment order compatible while the additive migration runs.
      logger.error('[NotificationOutbox] enqueue failed; using process fallback',error.code || error.name);
      void Promise.resolve().then(()=>run({acceptedTokens:[]},fallback)).catch(e=>logger.error('[NotificationOutbox] fallback failed',e.code || e.name));
      return {queued:false};
    }
  }
  async function drain(deliver){
    if(running || Date.now()<workerRetryAt)return;running=true;
    try{
      const token=randomUUID();
      const filteredKinds=kinds || excludeKinds;
      const kindFilter=filteredKinds.length ? ` AND kind ${kinds ? '= ANY' : '<> ALL'}($2::text[])` : '';
      const jobs=await db.$queryRawUnsafe(`UPDATE "NotificationJob" SET attempts=attempts+1,"lockToken"=$1,"lockedUntil"=now()+interval '2 minutes'
        WHERE id IN (SELECT id FROM "NotificationJob" WHERE "completedAt" IS NULL AND attempts<8 AND "expiresAt">now() AND "runAt"<=now()
          AND ("lockedUntil" IS NULL OR "lockedUntil"<now()) ${kindFilter} ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 4) RETURNING *`,token,...(filteredKinds.length ? [filteredKinds] : []));
      workerRetryAt=0;
      await Promise.all(jobs.map(async job=>{
        const heartbeat=setInterval(()=>{void db.$executeRawUnsafe('UPDATE "NotificationJob" SET "lockedUntil"=now()+interval \'2 minutes\' WHERE id=$1 AND "lockToken"=$2',job.id,job.lockToken).catch(e=>logger.error('[NotificationOutbox] heartbeat',e.code || e.name));},30000);
        heartbeat.unref?.();
        try{
          await run(job,()=>deliver(job.kind,job.payload));
          await db.$executeRawUnsafe('UPDATE "NotificationJob" SET "completedAt"=now(),"lockedUntil"=NULL,"lockToken"=NULL,"lastError"=NULL WHERE id=$1 AND "lockToken"=$2',job.id,job.lockToken);
        }catch(error){
          logger.error('[NotificationOutbox] delivery pending',job.id,error.code || error.name);
          await db.$executeRawUnsafe('UPDATE "NotificationJob" SET "runAt"=now()+($1 * interval \'1 second\'),"lockedUntil"=NULL,"lockToken"=NULL,"lastError"=$2 WHERE id=$3 AND "lockToken"=$4',Math.min(3600,15*2**Math.min(job.attempts,8)),String(error.code || error.name || 'DELIVERY_ERROR').slice(0,100),job.id,job.lockToken);
        }finally{clearInterval(heartbeat);}
      }));
    }catch(error){workerRetryAt=Date.now()+30000;logger.error('[NotificationOutbox] worker unavailable',error.code || error.name);}
    finally{running=false;}
  }
  return {enqueue,drain,run};
}
export const notificationOutbox=createNotificationOutbox({excludeKinds:AUTO_APPROVAL_JOB_KINDS});
export function startNotificationOutboxWorker(deliver){
  const timer=setInterval(()=>{void notificationOutbox.drain(deliver);},1000);timer.unref();
  const cleanup=setInterval(()=>{void prisma.$executeRawUnsafe('DELETE FROM "NotificationJob" WHERE "createdAt"<now()-interval \'7 days\'').catch(e=>console.error('[NotificationOutbox] cleanup',e.code || e.name));},3600000);cleanup.unref();
  return ()=>{clearInterval(timer);clearInterval(cleanup);};
}
