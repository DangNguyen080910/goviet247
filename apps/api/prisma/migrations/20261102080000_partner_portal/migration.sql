-- CreateEnum
CREATE TYPE "PartnerRole" AS ENUM ('ADMIN', 'DISPATCHER');

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "partnerAssignedToId" TEXT,
ADD COLUMN     "partnerCompanyId" TEXT,
ADD COLUMN     "partnerCompanyName" TEXT,
ADD COLUMN     "partnerCreatedById" TEXT,
ADD COLUMN     "partnerGreeting" TEXT;

-- CreateTable
CREATE TABLE "PartnerCompany" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "managementName" VARCHAR(150) NOT NULL,
    "managementPhone" VARCHAR(30) NOT NULL,
    "logoUrl" TEXT,
    "greeting" VARCHAR(500) NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PartnerCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerMember" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "displayName" VARCHAR(150) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "PartnerRole" NOT NULL DEFAULT 'DISPATCHER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerAuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorLabel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerCompany_code_key" ON "PartnerCompany"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerMember_companyId_username_key" ON "PartnerMember"("companyId", "username");

-- CreateIndex
CREATE INDEX "PartnerAuditLog_companyId_createdAt_idx" ON "PartnerAuditLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Trip_partnerCompanyId_pickupTime_idx" ON "Trip"("partnerCompanyId", "pickupTime");

-- AddForeignKey
ALTER TABLE "PartnerMember" ADD CONSTRAINT "PartnerMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "PartnerCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAuditLog" ADD CONSTRAINT "PartnerAuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "PartnerCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_partnerCompanyId_fkey" FOREIGN KEY ("partnerCompanyId") REFERENCES "PartnerCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_partnerCreatedById_fkey" FOREIGN KEY ("partnerCreatedById") REFERENCES "PartnerMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_partnerAssignedToId_fkey" FOREIGN KEY ("partnerAssignedToId") REFERENCES "PartnerMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

