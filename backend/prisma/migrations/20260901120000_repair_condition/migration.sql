-- AlterEnum
ALTER TYPE "EquipmentCondition" ADD VALUE 'IN_REPAIR';

-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN "conditionNote" TEXT;

-- AlterTable
ALTER TABLE "Warehouse" ADD COLUMN "slug" TEXT;
ALTER TABLE "Warehouse" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_slug_key" ON "Warehouse"("slug");
