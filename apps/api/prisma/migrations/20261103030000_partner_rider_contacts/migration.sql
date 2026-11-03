-- AlterTable
ALTER TABLE "PartnerMember" ADD COLUMN     "phone" VARCHAR(30);

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "partnerBookerName" TEXT,
ADD COLUMN     "partnerBookerPhone" TEXT,
ADD COLUMN     "partnerManagerName" TEXT,
ADD COLUMN     "partnerManagerPhone" TEXT;

-- CreateIndex
CREATE INDEX "PartnerCompany_managementPhone_idx" ON "PartnerCompany"("managementPhone");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerMember_companyId_phone_key" ON "PartnerMember"("companyId", "phone");


-- Normalize existing mobile management numbers for verified Rider matching.
UPDATE "PartnerCompany" SET "managementPhone" = CASE
 WHEN regexp_replace("managementPhone", '[^0-9]', '', 'g') ~ '^0[35789][0-9]{8}$'
 THEN '+84' || substring(regexp_replace("managementPhone", '[^0-9]', '', 'g') FROM 2)
 WHEN regexp_replace("managementPhone", '[^0-9]', '', 'g') ~ '^84[35789][0-9]{8}$'
 THEN '+' || regexp_replace("managementPhone", '[^0-9]', '', 'g')
 ELSE "managementPhone" END;

-- Seed the first company admin only; other existing employees must supply their own number.
UPDATE "PartnerMember" m SET "phone" = c."managementPhone"
FROM "PartnerCompany" c
WHERE m."companyId" = c."id" AND m."phone" IS NULL
 AND c."managementPhone" ~ '^\+84[35789][0-9]{8}$'
 AND m."id" = (SELECT a."id" FROM "PartnerMember" a WHERE a."companyId"=c."id" AND a."role"='ADMIN' ORDER BY a."createdAt",a."id" LIMIT 1);

WITH contacts AS (
 SELECT t."id",c."managementName",c."managementPhone",m."displayName",m."phone"
 FROM "Trip" t JOIN "PartnerCompany" c ON c."id"=t."partnerCompanyId"
 LEFT JOIN "PartnerMember" m ON m."id"=COALESCE(t."partnerCreatedById",t."partnerAssignedToId")
)
UPDATE "Trip" t SET "partnerManagerName"=c."managementName", "partnerManagerPhone"=c."managementPhone",
 "partnerBookerName"=c."displayName", "partnerBookerPhone"=c."phone"
FROM contacts c WHERE t."id"=c."id";
