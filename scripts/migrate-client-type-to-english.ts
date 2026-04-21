/**
 * One-shot migration: normaliza valores en español de client.type a inglés.
 *
 * Run: bun scripts/migrate-client-type-to-english.ts
 *
 * Background: el schema siempre documentó los valores en inglés ("tenant", "owner", etc.)
 * pero algunas rutas de API usaban "inquilino" al insertar. Este script corrige esos registros.
 */

import { db } from "../src/db";
import { client } from "../src/db/schema/client";
import { eq } from "drizzle-orm";

const MAPPING: Record<string, string> = {
  inquilino: "tenant",
  propietario: "owner",
  garante: "guarantor",
  contacto: "contact",
};

async function run() {
  for (const [spanish, english] of Object.entries(MAPPING)) {
    const result = await db
      .update(client)
      .set({ type: english })
      .where(eq(client.type, spanish))
      .returning({ id: client.id });

    if (result.length > 0) {
      console.log(`✓ ${result.length} cliente(s) actualizados: "${spanish}" → "${english}"`);
    }
  }

  console.log("Migración completada.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Error en migración:", err);
  process.exit(1);
});
