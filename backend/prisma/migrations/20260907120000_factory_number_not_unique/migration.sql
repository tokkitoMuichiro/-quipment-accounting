-- Factory number is a label, not an identity. Identity is Equipment.id (UUID).
DROP INDEX IF EXISTS "Equipment_factoryNumber_key";

CREATE INDEX IF NOT EXISTS "Equipment_factoryNumber_idx" ON "Equipment"("factoryNumber");
