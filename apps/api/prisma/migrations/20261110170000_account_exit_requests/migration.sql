CREATE TABLE "AccountExitRequest" (
  "userId" TEXT NOT NULL,
  "appRole" TEXT NOT NULL,
  "requestedAt" TIMESTAMPTZ(6) NOT NULL,
  "returnedAt" TIMESTAMPTZ(6),
  "requestCount" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "AccountExitRequest_pkey" PRIMARY KEY ("userId", "appRole"),
  CONSTRAINT "AccountExitRequest_appRole_check" CHECK ("appRole" IN ('DRIVER', 'RIDER')),
  CONSTRAINT "AccountExitRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
