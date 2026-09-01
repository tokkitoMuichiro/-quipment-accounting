-- Quantity must stay positive (partial transfers never leave a zero lot).
ALTER TABLE "Equipment"
  ADD CONSTRAINT "Equipment_quantity_positive" CHECK (quantity > 0);

-- Exactly one owner: a person XOR a warehouse.
ALTER TABLE "Equipment"
  ADD CONSTRAINT "Equipment_owner_xor" CHECK (
    (
      "ownerType" = 'USER'
      AND "ownerUserId" IS NOT NULL
      AND "ownerWarehouseId" IS NULL
    )
    OR (
      "ownerType" = 'WAREHOUSE'
      AND "ownerWarehouseId" IS NOT NULL
      AND "ownerUserId" IS NULL
    )
  );
