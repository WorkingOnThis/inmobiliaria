import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { user, account, verification, rateLimit } from "@/db/schema/better-auth";
import { agency } from "@/db/schema/agency";
import {
  validateRegistrationInput,
  emailExists,
} from "@/lib/auth/register";
import { sendEmail } from "@/lib/auth/email";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/**
 * Hash a password using scrypt (same algorithm as Better Auth)
 * Format: base64(hash).base64(salt)
 */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  // Better Auth scrypt parameters: costFactor=16384, blockSize=8, parallelization=1
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${hash.toString("base64")}.${salt.toString("base64")}`;
}

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Check rate limit for registration attempts
 * Returns true if rate limit is exceeded, false otherwise
 */
async function checkRateLimit(ip: string): Promise<{ exceeded: boolean; remainingSeconds?: number }> {
  const rateLimitKey = `register:${ip}`;
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;
  const now = Date.now();

  try {
    // Try to get existing rate limit record
    const existing = await db
      .select()
      .from(rateLimit)
      .where(eq(rateLimit.key, rateLimitKey))
      .limit(1);

    if (existing.length === 0) {
      // Create new rate limit record
      await db.insert(rateLimit).values({
        id: generateId(),
        key: rateLimitKey,
        count: 1,
        lastRequest: BigInt(now),
      });
      return { exceeded: false };
    }

    const record = existing[0];
    const lastRequest = Number(record.lastRequest || 0);
    const timeSinceLastRequest = now - lastRequest;

    if (timeSinceLastRequest > windowMs) {
      // Window expired, reset count
      await db
        .update(rateLimit)
        .set({
          count: 1,
          lastRequest: BigInt(now),
        })
        .where(eq(rateLimit.key, rateLimitKey));
      return { exceeded: false };
    }

    // Check if limit exceeded
    if (record.count >= maxAttempts) {
      const remainingSeconds = Math.ceil((windowMs - timeSinceLastRequest) / 1000);
      return { exceeded: true, remainingSeconds };
    }

    // Increment count
    await db
      .update(rateLimit)
      .set({
        count: record.count + 1,
        lastRequest: BigInt(now),
      })
      .where(eq(rateLimit.key, rateLimitKey));

    return { exceeded: false };
  } catch (error) {
    // If rate limiting fails, allow the request (fail open)
    console.error("Rate limit check error:", error);
    return { exceeded: false };
  }
}

/**
 * Register API Route
 * 
 * Handles user registration with email/password.
 * Creates Better Auth user and Agency in atomic transaction.
 */
export async function POST(request: NextRequest) {
  try {
    // Extract IP for rate limiting
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip") || "unknown";

    // Check rate limit
    const rateLimitCheck = await checkRateLimit(ip);
    if (rateLimitCheck.exceeded) {
      return NextResponse.json(
        {
          error: `Too many registration attempts. Please try again in ${rateLimitCheck.remainingSeconds} seconds.`,
        },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { agencyName, firstName, lastName, email, password } = body;

    // Validate input
    const validation = validateRegistrationInput({
      agencyName,
      firstName,
      lastName,
      email,
      password,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "Invalid input" },
        { status: 400 }
      );
    }

    // Check if email already exists
    if (await emailExists(email)) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }

    // Create Better Auth user and Agency in atomic transaction
    // Then use Better Auth API to send verification email (which generates token correctly)
    const fullName = `${firstName} ${lastName}`.trim();
    const userId = generateId();
    const hashedPassword = await hashPassword(password);
    const normalizedEmail = email.toLowerCase().trim();
    const agencyId = generateId();

    // Create user, account, and agency in a single atomic transaction
    try {
      await db.transaction(async (tx) => {
        // 1. Create Better Auth user
        await tx.insert(user).values({
          id: userId,
          name: fullName,
          email: normalizedEmail,
          emailVerified: false,
          role: "account_admin",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // 2. Create account with hashed password
        await tx.insert(account).values({
          id: generateId(),
          userId,
          accountId: normalizedEmail,
          providerId: "credential", // Better Auth uses "credential" for email/password
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // 3. Create Agency linked to Better Auth user (owner)
        await tx.insert(agency).values({
          id: agencyId,
          name: agencyName.trim(),
          ownerId: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });
    } catch (dbError: any) {
      // Check if it's a unique constraint violation (duplicate email)
      if (dbError.code === "23505" || dbError.constraint?.includes("email")) {
        return NextResponse.json(
          { error: "Email already registered" },
          { status: 400 }
        );
      }
      console.error("Database transaction error:", dbError);
      return NextResponse.json(
        { error: "Registration failed. Please try again." },
        { status: 500 }
      );
    }

    // After successful transaction, use Better Auth API to send verification email
    // This will generate the token in the correct format that Better Auth expects
    // If email sending fails, we'll delete the user to maintain consistency (FR-008, FR-014)
    try {
      const baseURL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      
      // Use Better Auth API to send verification email
      // This generates the token in the correct format that Better Auth can verify
      const response = await auth.api.sendVerificationEmail({
        body: {
          email: normalizedEmail,
          callbackURL: `${baseURL}/verify-email?verified=true`,
        },
        headers: new Headers(),
      });

      // If email sending fails, delete the user to maintain consistency
      if (!response || (response as any).error) {
        console.error("Failed to send verification email via Better Auth:", response);
        
        // Rollback: Delete user, account, and agency if email fails
        await db.transaction(async (tx) => {
          await tx.delete(agency).where(eq(agency.ownerId, userId));
          await tx.delete(account).where(eq(account.userId, userId));
          await tx.delete(user).where(eq(user.id, userId));
        });
        
        return NextResponse.json(
          { error: "Failed to send verification email. Please try again." },
          { status: 500 }
        );
      }
    } catch (emailError: any) {
      // If email sending fails, rollback by deleting the user
      console.error("Failed to send verification email:", emailError);
      
      try {
        await db.transaction(async (tx) => {
          await tx.delete(agency).where(eq(agency.ownerId, userId));
          await tx.delete(account).where(eq(account.userId, userId));
          await tx.delete(user).where(eq(user.id, userId));
        });
      } catch (deleteError) {
        console.error("Failed to rollback user creation after email failure:", deleteError);
      }
      
      return NextResponse.json(
        { error: "Failed to send verification email. Please try again." },
        { status: 500 }
      );
    }

    // Log successful registration
    console.log(`[REGISTRATION] User registered: ${email} (IP: ${ip})`);

    // Return success
    return NextResponse.json(
      {
        success: true,
        message: "Registration successful. Please check your email to verify your account.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration API error:", error);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}

