-- CreateEnum
CREATE TYPE "StatusPostAnlass" AS ENUM ('FRESH_PRODUCT', 'NEW_SEASON', 'PROMOTION', 'ANNOUNCEMENT');

-- CreateTable
CREATE TABLE "StatusPost" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "anlass" "StatusPostAnlass" NOT NULL DEFAULT 'FRESH_PRODUCT',
    "photoUrl" TEXT,
    "linkedProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "showOnFarmPage" BOOLEAN NOT NULL DEFAULT true,
    "sentViaEmail" BOOLEAN NOT NULL DEFAULT false,
    "sentViaWhatsApp" BOOLEAN NOT NULL DEFAULT false,
    "emailRecipientCount" INTEGER NOT NULL DEFAULT 0,
    "whatsappRecipientCount" INTEGER NOT NULL DEFAULT 0,
    "whatsappSentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatusPost_farmId_publishedAt_idx" ON "StatusPost"("farmId", "publishedAt");

-- AddForeignKey
ALTER TABLE "StatusPost" ADD CONSTRAINT "StatusPost_farmId_fkey"
    FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
