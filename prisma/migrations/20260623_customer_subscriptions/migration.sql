-- CreateTable: CustomerFarmSubscription
CREATE TABLE "CustomerFarmSubscription" (
    "id" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "optInEmail" BOOLEAN NOT NULL DEFAULT false,
    "optInWhatsApp" BOOLEAN NOT NULL DEFAULT false,
    "customerPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerFarmSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerFarmSubscription_customerEmail_farmId_key" ON "CustomerFarmSubscription"("customerEmail", "farmId");

-- CreateIndex
CREATE INDEX "CustomerFarmSubscription_farmId_optInEmail_idx" ON "CustomerFarmSubscription"("farmId", "optInEmail");

-- CreateIndex
CREATE INDEX "CustomerFarmSubscription_farmId_optInWhatsApp_idx" ON "CustomerFarmSubscription"("farmId", "optInWhatsApp");

-- AddForeignKey
ALTER TABLE "CustomerFarmSubscription" ADD CONSTRAINT "CustomerFarmSubscription_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
