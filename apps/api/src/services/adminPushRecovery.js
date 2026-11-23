// Registration repairs legacy bindings using the verified Admin JWT, never device-supplied expiry.
// Revisit only recent, unsent new-trip alerts for trips still awaiting Admin review.
export async function wakeUnsentAdminTripPush(db){
  return db.$executeRawUnsafe(`UPDATE "NotificationJob" AS j
    SET "runAt"=now(),attempts=0,"completedAt"=NULL,"lockedUntil"=NULL,"lockToken"=NULL,"lastError"=NULL
    WHERE j.kind='sendAdminPushNotification'
      AND j.payload #>> '{0,data,source}'='create_trip'
      AND j."createdAt">now()-interval '2 hours' AND j."expiresAt">now()
      AND COALESCE(cardinality(j."acceptedTokens"),0)=0
      AND (j."completedAt" IS NOT NULL OR j."lastError"='ADMIN_PUSH_NO_ACTIVE_DEVICE')
      AND (j."lockedUntil" IS NULL OR j."lockedUntil"<now())
      AND EXISTS(SELECT 1 FROM "Trip" t WHERE t.id=j.payload #>> '{0,data,tripId}'
        AND t.status='PENDING' AND t."isVerified"=false AND t."cancelledAt" IS NULL)`);
}
