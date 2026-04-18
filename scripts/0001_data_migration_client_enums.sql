-- Data Migration: Update client enum values to English
-- This script must be run BEFORE the schema migration (0002)
-- It converts all existing enum values in the client table

-- Update type enum values
UPDATE "client" SET "type" = 'owner' WHERE "type" = 'propietario';
UPDATE "client" SET "type" = 'tenant' WHERE "type" = 'inquilino';
UPDATE "client" SET "type" = 'guarantor' WHERE "type" = 'garante';
UPDATE "client" SET "type" = 'contact' WHERE "type" = 'contacto';

-- Update status enum values
UPDATE "client" SET "status" = 'active' WHERE "status" = 'activo';
UPDATE "client" SET "status" = 'suspended' WHERE "status" = 'suspendido';
UPDATE "client" SET "status" = 'inactive' WHERE "status" = 'baja';

-- Update tipoCuenta enum values
UPDATE "client" SET "tipoCuenta" = 'savings' WHERE "tipoCuenta" = 'caja_ahorro';
UPDATE "client" SET "tipoCuenta" = 'checking' WHERE "tipoCuenta" = 'cuenta_corriente';

-- Verify migration results (run these separately to check):
-- SELECT DISTINCT "type" FROM "client";
-- SELECT DISTINCT "status" FROM "client";
-- SELECT DISTINCT "tipoCuenta" FROM "client";
