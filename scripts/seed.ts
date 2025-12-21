#!/usr/bin/env bun
/**
 * Seed script for development database
 *
 * Creates test users according to acceptance scenarios in login-spec.md
 *
 * Usage: bun run scripts/seed.ts
 * Or: bun run db:seed (after adding script to package.json)
 *
 * This script is idempotent - it can be run multiple times safely.
 */

import "dotenv/config";
import { db } from "@/db";
import { user, account } from "@/db/schema/better-auth";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/**
 * Hash a password using scrypt
 * Better Auth uses scrypt with specific parameters
 * Format: base64(hash).base64(salt)
 */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  // Better Auth scrypt parameters: costFactor=16384, blockSize=8, parallelization=1
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  // Better Auth format appears to be: hash.salt (both base64 encoded)
  return `${hash.toString("base64")}.${salt.toString("base64")}`;
}

/**
 * Generate a unique ID (Better Auth uses text IDs, typically UUID-like)
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Seed users according to acceptance scenarios
 */
async function seed() {
  console.log("🌱 Starting database seed...");

  try {
    // User 1: Verified user for login testing (US1, Scenario 1 and 2)
    const verifiedUserEmail = "usuario@ejemplo.com";
    const verifiedUserPassword = "password123";

    console.log(`\n📧 Creating verified user: ${verifiedUserEmail}`);

    const existingVerifiedUser = await db
      .select()
      .from(user)
      .where(eq(user.email, verifiedUserEmail))
      .limit(1);

    if (existingVerifiedUser.length > 0) {
      console.log(`   ✓ User already exists, skipping creation`);

      // Update emailVerified to true if not already verified
      if (!existingVerifiedUser[0].emailVerified) {
        await db
          .update(user)
          .set({ emailVerified: true })
          .where(eq(user.id, existingVerifiedUser[0].id));
        console.log(`   ✓ Updated emailVerified to true`);
      }
    } else {
      const userId = generateId();
      const hashedPassword = await hashPassword(verifiedUserPassword);

      // Create user
      await db.insert(user).values({
        id: userId,
        name: "Usuario de Prueba",
        email: verifiedUserEmail,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create account with password
      await db.insert(account).values({
        id: generateId(),
        userId: userId,
        accountId: verifiedUserEmail,
        providerId: "credential", // Better Auth uses "credential" for email/password
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`   ✓ Created verified user with ID: ${userId}`);
    }

    // User 2: Unverified user for email verification testing (optional)
    const unverifiedUserEmail = "no-verificado@ejemplo.com";
    const unverifiedUserPassword = "password123";

    console.log(`\n📧 Creating unverified user: ${unverifiedUserEmail}`);

    const existingUnverifiedUser = await db
      .select()
      .from(user)
      .where(eq(user.email, unverifiedUserEmail))
      .limit(1);

    if (existingUnverifiedUser.length > 0) {
      console.log(`   ✓ User already exists, skipping creation`);
    } else {
      const userId = generateId();
      const hashedPassword = await hashPassword(unverifiedUserPassword);

      // Create user (not verified)
      await db.insert(user).values({
        id: userId,
        name: "Usuario No Verificado",
        email: unverifiedUserEmail,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create account with password
      await db.insert(account).values({
        id: generateId(),
        userId: userId,
        accountId: unverifiedUserEmail,
        providerId: "credential",
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`   ✓ Created unverified user with ID: ${userId}`);
    }

    console.log("\n✅ Seed completed successfully!");
    console.log("\n📝 Test users created:");
    console.log(
      `   - ${verifiedUserEmail} / ${verifiedUserPassword} (verified)`
    );
    console.log(
      `   - ${unverifiedUserEmail} / ${unverifiedUserPassword} (unverified)`
    );
  } catch (error) {
    console.error("\n❌ Error seeding database:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run seed
seed();
