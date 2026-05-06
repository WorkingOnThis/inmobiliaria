-- SEC-3: Add agencyId to 14 business tables
-- Backfill assumes a single agency exists in DB (true in production at time of migration).
-- For multi-agency scenarios, redesign backfill before applying.

BEGIN;

-- 1. client
ALTER TABLE "client" ADD COLUMN "agencyId" text;
UPDATE "client" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "client" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "client" ADD CONSTRAINT "client_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 2. property
ALTER TABLE "property" ADD COLUMN "agencyId" text;
UPDATE "property" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "property" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "property" ADD CONSTRAINT "property_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 3. contract
ALTER TABLE "contract" ADD COLUMN "agencyId" text;
UPDATE "contract" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "contract" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "contract" ADD CONSTRAINT "contract_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 4. cash_movement
ALTER TABLE "cash_movement" ADD COLUMN "agencyId" text;
UPDATE "cash_movement" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "cash_movement" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 5. task
ALTER TABLE "task" ADD COLUMN "agencyId" text;
UPDATE "task" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "task" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "task" ADD CONSTRAINT "task_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 6. service
ALTER TABLE "service" ADD COLUMN "agencyId" text;
UPDATE "service" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "service" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "service" ADD CONSTRAINT "service_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 7. guarantee
ALTER TABLE "guarantee" ADD COLUMN "agencyId" text;
UPDATE "guarantee" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "guarantee" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "guarantee" ADD CONSTRAINT "guarantee_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 8. clauseTemplate (note: camelCase table name)
ALTER TABLE "clauseTemplate" ADD COLUMN "agencyId" text;
UPDATE "clauseTemplate" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "clauseTemplate" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "clauseTemplate" ADD CONSTRAINT "clauseTemplate_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 9. contract_amendment
ALTER TABLE "contract_amendment" ADD COLUMN "agencyId" text;
UPDATE "contract_amendment" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "contract_amendment" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "contract_amendment" ADD CONSTRAINT "contract_amendment_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 10. contract_document
ALTER TABLE "contract_document" ADD COLUMN "agencyId" text;
UPDATE "contract_document" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "contract_document" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "contract_document" ADD CONSTRAINT "contract_document_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 11. contract_participant
ALTER TABLE "contract_participant" ADD COLUMN "agencyId" text;
UPDATE "contract_participant" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "contract_participant" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "contract_participant" ADD CONSTRAINT "contract_participant_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 12. property_co_owner
ALTER TABLE "property_co_owner" ADD COLUMN "agencyId" text;
UPDATE "property_co_owner" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "property_co_owner" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "property_co_owner" ADD CONSTRAINT "property_co_owner_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 13. property_room
ALTER TABLE "property_room" ADD COLUMN "agencyId" text;
UPDATE "property_room" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "property_room" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "property_room" ADD CONSTRAINT "property_room_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

-- 14. tenant_ledger
ALTER TABLE "tenant_ledger" ADD COLUMN "agencyId" text;
UPDATE "tenant_ledger" SET "agencyId" = (SELECT id FROM agency LIMIT 1);
ALTER TABLE "tenant_ledger" ALTER COLUMN "agencyId" SET NOT NULL;
ALTER TABLE "tenant_ledger" ADD CONSTRAINT "tenant_ledger_agencyId_fk"
  FOREIGN KEY ("agencyId") REFERENCES agency(id) ON DELETE CASCADE;

COMMIT;
