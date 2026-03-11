-- AlterEnum
ALTER TYPE "DonationSource" ADD VALUE 'DONORS_FUND';

-- AlterTable: make memberId nullable, add donorName and externalId
ALTER TABLE "OneTimeDonation" ALTER COLUMN "memberId" DROP NOT NULL;
ALTER TABLE "OneTimeDonation" ADD COLUMN "donorName" TEXT;
ALTER TABLE "OneTimeDonation" ADD COLUMN "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "OneTimeDonation_externalId_key" ON "OneTimeDonation"("externalId");
