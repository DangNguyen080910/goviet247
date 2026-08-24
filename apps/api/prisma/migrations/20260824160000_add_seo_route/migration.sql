CREATE TABLE "SeoRoute" (
    "id" BIGSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "routeText" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'V2HOT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SeoRoute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeoRoute_key_key" ON "SeoRoute"("key");
CREATE UNIQUE INDEX "SeoRoute_path_key" ON "SeoRoute"("path");
CREATE INDEX "SeoRoute_from_idx" ON "SeoRoute"("from");
CREATE INDEX "SeoRoute_to_idx" ON "SeoRoute"("to");
CREATE INDEX "SeoRoute_source_idx" ON "SeoRoute"("source");
