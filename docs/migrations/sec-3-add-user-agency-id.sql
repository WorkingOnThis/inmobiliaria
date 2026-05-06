-- SEC-3: Add agencyId to user table for Better Auth additionalFields
-- Backfill via agency.ownerId = user.id
-- agencyId stays nullable: visitors who haven't completed agency registration have no agency.

BEGIN;

ALTER TABLE "user" ADD COLUMN "agencyId" text;

UPDATE "user"
SET "agencyId" = (
  SELECT a.id FROM agency a WHERE a."ownerId" = "user".id LIMIT 1
);

ALTER TABLE "user" ADD CONSTRAINT "user_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE SET NULL;

COMMIT;
