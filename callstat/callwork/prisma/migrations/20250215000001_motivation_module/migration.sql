-- Add enums for deals and payments
CREATE TYPE "DealStatus" AS ENUM ('OPEN', 'WON', 'LOST');
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- Deals table
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "budget" DECIMAL(12,2) NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'OPEN',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "isFocus" BOOLEAN NOT NULL DEFAULT false,
    "managerId" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- Motivation grades table
CREATE TABLE "MotivationGrade" (
    "id" SERIAL NOT NULL,
    "minTurnover" DECIMAL(12,2) NOT NULL,
    "maxTurnover" DECIMAL(12,2),
    "commissionRate" DECIMAL(5,4) NOT NULL,
    CONSTRAINT "MotivationGrade_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "Deal"
  ADD CONSTRAINT "Deal_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes for deals
CREATE INDEX "Deal_managerId_idx" ON "Deal"("managerId");
CREATE INDEX "Deal_status_paymentStatus_idx" ON "Deal"("status", "paymentStatus");
CREATE INDEX "Deal_isFocus_idx" ON "Deal"("isFocus");
CREATE INDEX "Deal_closedAt_idx" ON "Deal"("closedAt");
CREATE INDEX "Deal_paidAt_idx" ON "Deal"("paidAt");

-- Index for motivation grades
CREATE INDEX "MotivationGrade_minTurnover_maxTurnover_idx" ON "MotivationGrade"("minTurnover", "maxTurnover");
