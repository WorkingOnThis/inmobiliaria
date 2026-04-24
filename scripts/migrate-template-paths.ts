/**
 * One-shot migration: renames all variable paths in documentTemplateClause.body
 * from dot-notation (locador.apellido) to snake_case (apellido_locador).
 *
 * Usage:
 *   bun scripts/migrate-template-paths.ts --dry-run   # preview, no DB writes
 *   bun scripts/migrate-template-paths.ts --apply     # apply + backup first
 *
 * The backup is always written before any DB change (JSON format, under backups/).
 * If the backup write fails the script aborts without touching the DB.
 */

import { db } from "../src/db";
import { documentTemplateClause } from "../src/db/schema/document-template";
import { migrateBody } from "../src/lib/document-templates/path-migration-map";
import { eq } from "drizzle-orm";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const isDryRun = process.argv.includes("--dry-run");
const isApply = process.argv.includes("--apply");

if (!isDryRun && !isApply) {
  console.error("Usage: bun scripts/migrate-template-paths.ts --dry-run | --apply");
  process.exit(1);
}

async function run() {
  const clauses = await db.select().from(documentTemplateClause);

  if (clauses.length === 0) {
    console.log("No clauses found. Nothing to migrate.");
    process.exit(0);
  }

  // ── Backup (always, before any writes) ────────────────────────────────────
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupDir = join(process.cwd(), "backups");
  const backupPath = join(backupDir, `document-template-clause-${timestamp}.json`);

  try {
    mkdirSync(backupDir, { recursive: true });
    writeFileSync(backupPath, JSON.stringify(clauses, null, 2), "utf-8");
    console.log(`✓ Backup saved → ${backupPath}`);
  } catch (err) {
    console.error("✗ Backup failed — aborting without touching the DB:", err);
    process.exit(1);
  }

  // ── Compute diffs ─────────────────────────────────────────────────────────
  type Diff = { id: string; templateId: string; old: string; new: string };
  const diffs: Diff[] = [];

  for (const clause of clauses) {
    if (!clause.body) continue;
    const migrated = migrateBody(clause.body);
    if (migrated !== clause.body) {
      diffs.push({
        id: clause.id,
        templateId: clause.templateId ?? "?",
        old: clause.body,
        new: migrated,
      });
    }
  }

  if (diffs.length === 0) {
    console.log("No clauses need migration — all paths are already up to date.");
    process.exit(0);
  }

  // ── Report diffs ──────────────────────────────────────────────────────────
  console.log(`\nClauses with changes: ${diffs.length} / ${clauses.length}\n`);
  for (const diff of diffs) {
    console.log(`─── Clause ${diff.id} (template: ${diff.templateId})`);
    const oldLines = diff.old.split("\n");
    const newLines = diff.new.split("\n");
    for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
      if (oldLines[i] !== newLines[i]) {
        console.log(`  - ${oldLines[i] ?? ""}`);
        console.log(`  + ${newLines[i] ?? ""}`);
      }
    }
    console.log();
  }

  if (isDryRun) {
    console.log("DRY RUN — no changes applied. Run with --apply to persist.");
    process.exit(0);
  }

  // ── Apply ─────────────────────────────────────────────────────────────────
  let applied = 0;
  for (const diff of diffs) {
    await db
      .update(documentTemplateClause)
      .set({ body: diff.new })
      .where(eq(documentTemplateClause.id, diff.id));
    applied++;
  }

  console.log(`✓ Applied ${applied} clause(s). Backup at: ${backupPath}`);
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
