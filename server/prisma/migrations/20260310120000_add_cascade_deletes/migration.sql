-- DropForeignKey
ALTER TABLE "RecurringDonation" DROP CONSTRAINT IF EXISTS "RecurringDonation_memberId_fkey";
ALTER TABLE "OneTimeDonation" DROP CONSTRAINT IF EXISTS "OneTimeDonation_memberId_fkey";
ALTER TABLE "Bill" DROP CONSTRAINT IF EXISTS "Bill_memberId_fkey";
ALTER TABLE "ZellePayment" DROP CONSTRAINT IF EXISTS "ZellePayment_memberId_fkey";

-- AddForeignKey
ALTER TABLE "RecurringDonation" ADD CONSTRAINT "RecurringDonation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OneTimeDonation" ADD CONSTRAINT "OneTimeDonation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ZellePayment" ADD CONSTRAINT "ZellePayment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
