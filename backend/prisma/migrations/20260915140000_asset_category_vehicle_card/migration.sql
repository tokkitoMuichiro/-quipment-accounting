-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('EQUIPMENT', 'VEHICLE', 'CARD');

-- CreateEnum
CREATE TYPE "VehicleKind" AS ENUM ('PASSENGER', 'TRUCK', 'SPECIAL', 'MOTORCYCLE', 'TRAILER');

-- CreateEnum
CREATE TYPE "CardKind" AS ENUM ('TRANSPONDER', 'FUEL', 'BUSINESS');

-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN "category" "AssetCategory" NOT NULL DEFAULT 'EQUIPMENT';
ALTER TABLE "Equipment" ADD COLUMN "plateNumber" TEXT;
ALTER TABLE "Equipment" ADD COLUMN "vehicleKind" "VehicleKind";
ALTER TABLE "Equipment" ADD COLUMN "cardKind" "CardKind";
ALTER TABLE "Equipment" ADD COLUMN "cardNumber" TEXT;

-- CreateIndex
CREATE INDEX "Equipment_category_idx" ON "Equipment"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_plateNumber_key" ON "Equipment"("plateNumber");
