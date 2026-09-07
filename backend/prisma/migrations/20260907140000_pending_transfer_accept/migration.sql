-- Pending acceptance for transfers to a person. Existing rows stay COMPLETED.
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

ALTER TABLE "Transfer" ADD COLUMN "status" "TransferStatus" NOT NULL DEFAULT 'COMPLETED';

ALTER TABLE "Equipment" ADD COLUMN "pendingTransferId" TEXT;

CREATE UNIQUE INDEX "Equipment_pendingTransferId_key" ON "Equipment"("pendingTransferId");

ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_pendingTransferId_fkey" FOREIGN KEY ("pendingTransferId") REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
