-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('MEMBER', 'NON_MEMBER');

-- CreateEnum
CREATE TYPE "DonationCategory" AS ENUM ('MEMBERSHIP_RECURRING', 'OTHER_RECURRING', 'ONE_TIME_DONATION');

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "manuallyEdited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "membershipStatus" "MembershipStatus" NOT NULL DEFAULT 'MEMBER',
ADD COLUMN     "statusManuallySet" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OneTimeDonation" ADD COLUMN     "category" "DonationCategory" NOT NULL DEFAULT 'ONE_TIME_DONATION',
ADD COLUMN     "donorId" TEXT,
ADD COLUMN     "manuallyMatched" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RecurringDonation" ADD COLUMN     "category" "DonationCategory" NOT NULL DEFAULT 'MEMBERSHIP_RECURRING';

-- AlterTable
ALTER TABLE "ZellePayment" ADD COLUMN     "donorId" TEXT,
ADD COLUMN     "manuallyMatched" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Donor" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "street" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "country" TEXT,
    "notes" TEXT,
    "wifeName" TEXT,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchRule" (
    "id" SERIAL NOT NULL,
    "donorName" TEXT NOT NULL,
    "memberId" TEXT,
    "donorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Donor_email_key" ON "Donor"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MatchRule_donorName_key" ON "MatchRule"("donorName");

-- AddForeignKey
ALTER TABLE "OneTimeDonation" ADD CONSTRAINT "OneTimeDonation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZellePayment" ADD CONSTRAINT "ZellePayment_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
