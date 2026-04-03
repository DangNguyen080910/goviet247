-- CreateEnum
CREATE TYPE "AccountingDocumentType" AS ENUM ('BANK_STATEMENT', 'INPUT_INVOICE', 'OUTPUT_INVOICE', 'COMPANY_CASH_EXPORT', 'DRIVER_WALLET_EXPORT', 'TRIP_EXPORT', 'DRIVER_WITHDRAW_EXPORT', 'PAYROLL_HR', 'LEGAL_CONTRACT', 'ACCOUNTING_NOTE');

-- CreateTable
CREATE TABLE "AccountingDocument" (
    "id" TEXT NOT NULL,
    "documentType" "AccountingDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quarter" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "fileName" TEXT,
    "filePath" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "uploadedByAdminId" TEXT,
    "uploadedByUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountingDocument_documentType_quarter_year_idx" ON "AccountingDocument"("documentType", "quarter", "year");

-- CreateIndex
CREATE INDEX "AccountingDocument_year_quarter_idx" ON "AccountingDocument"("year", "quarter");
