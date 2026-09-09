-- Fill review workflow + Bitrix notification preference
CREATE TYPE "FillStatus" AS ENUM ('OK', 'NEEDS_FIX', 'PENDING_REVIEW');

ALTER TABLE "User" ADD COLUMN "notifyBitrix" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Equipment" ADD COLUMN "fillStatus" "FillStatus" NOT NULL DEFAULT 'OK';
ALTER TABLE "Equipment" ADD COLUMN "fillComment" TEXT;
ALTER TABLE "Equipment" ADD COLUMN "flaggedById" TEXT;
ALTER TABLE "Equipment" ADD COLUMN "flaggedAt" TIMESTAMP(3);

CREATE INDEX "Equipment_fillStatus_idx" ON "Equipment"("fillStatus");

ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_flaggedById_fkey" FOREIGN KEY ("flaggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
