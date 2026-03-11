-- CreateTable
CREATE TABLE "Receipt" (
    "id" SERIAL NOT NULL,
    "memberId" TEXT NOT NULL,
    "donationId" TEXT,
    "donationType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_donationId_donationType_key" ON "Receipt"("donationId", "donationType");
