-- CreateTable
CREATE TABLE "AccountingNote" (
    "id" TEXT NOT NULL,
    "quarter" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdByAdminId" INTEGER,
    "createdByUsername" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AccountingNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountingNote_year_quarter_idx" ON "AccountingNote"("year", "quarter");

-- CreateIndex
CREATE INDEX "AccountingNote_quarter_year_createdAt_idx" ON "AccountingNote"("quarter", "year", "createdAt");

-- CreateIndex
CREATE INDEX "AccountingNote_createdAt_idx" ON "AccountingNote"("createdAt");
