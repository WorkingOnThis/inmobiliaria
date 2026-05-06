import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { user, account, rateLimit } from "@/db/schema/better-auth";
import {
  validateRegistrationInput,
  emailExists,
} from "@/lib/auth/register";
import { auth } from "@/lib/auth";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

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
        lastRequest: now,
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
          lastRequest: now,
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
        lastRequest: now,
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
 * Creates Better Auth user in atomic transaction with email verification.
 * Note: Inmobiliaria is NOT created during registration (FR-031, FR-036).
 * Users can create or join an inmobiliaria after registration.
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
    const { firstName, lastName, email, password } = body;

    // Validate input
    const validation = validateRegistrationInput({
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

    // Create Better Auth user, verification token, and send email in atomic transaction
    // If email sending fails, entire transaction is rolled back (FR-008, FR-014)
    // Note: Inmobiliaria is NOT created during registration (FR-031, FR-036)
    // Users can create or join an inmobiliaria after registration
    const fullName = `${firstName} ${lastName}`.trim();
    const userId = generateId();
    const hashedPassword = await hashPassword(password);
    const normalizedEmail = email.toLowerCase().trim();

    try {
      await db.transaction(async (tx) => {
        await tx.insert(user).values({
          id: userId,
          name: fullName,
          email: normalizedEmail,
          emailVerified: false,
          role: "visitor",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await tx.insert(account).values({
          id: generateId(),
          userId,
          accountId: normalizedEmail,
          providerId: "credential",
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });
    } catch (dbError: any) {
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

    // Send verification email. If it fails, delete the user so they can retry.
    try {
      await auth.api.sendVerificationEmail({
        body: { email: normalizedEmail, callbackURL: "/login" },
      });
    } catch (emailError) {
      console.error("Verification email failed, rolling back user:", emailError);
      await db.delete(user).where(eq(user.id, userId)); // cascade deletes account
      return NextResponse.json(
        { error: "No se pudo enviar el email de verificación. Por favor intenta nuevamente." },
        { status: 500 }
      );
    }

    // Log successful registration
    console.log(`[REGISTRATION] User registered: ${email} (IP: ${ip})`);

    // Return success
    return NextResponse.json(
      {
        success: true,
        message: "Registro exitoso. Por favor revisa tu correo electrónico para verificar tu cuenta.",
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

