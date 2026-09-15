-- AlterTable
ALTER TABLE "BitrixPortal" ADD COLUMN "accountingFolderId" TEXT;
ALTER TABLE "BitrixPortal" ADD COLUMN "docsFolderId" TEXT;

-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN "bitrixFolderId" TEXT;

-- CreateTable
CREATE TABLE "EquipmentDocument" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "bitrixFileId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EquipmentDocument_equipmentId_idx" ON "EquipmentDocument"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentDocument_bitrixFileId_key" ON "EquipmentDocument"("bitrixFileId");

-- AddForeignKey
ALTER TABLE "EquipmentDocument" ADD CONSTRAINT "EquipmentDocument_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentDocument" ADD CONSTRAINT "EquipmentDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
