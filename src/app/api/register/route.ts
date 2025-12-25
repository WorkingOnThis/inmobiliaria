import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { user, account, verification, rateLimit } from "@/db/schema/better-auth";
import {
  validateRegistrationInput,
  emailExists,
} from "@/lib/auth/register";
import { sendEmail } from "@/lib/auth/email";
import { auth } from "@/lib/auth";
import { createEmailVerificationToken } from "better-auth/api";
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
    const baseURL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const secret = process.env.BETTER_AUTH_SECRET || "change-me-in-production";
    const expiresIn = 24 * 60 * 60; // 24 hours in seconds (Better Auth default)

    // Create user, account, verification token, and send email in a single atomic transaction
    try {
      await db.transaction(async (tx) => {
        // 1. Create Better Auth user with role "visitor" (FR-033, FR-034)
        await tx.insert(user).values({
          id: userId,
          name: fullName,
          email: normalizedEmail,
          emailVerified: false,
          role: "visitor",
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

        // 3. Generate verification token (JWT format that Better Auth expects)
        // Better Auth verifies the JWT directly, no need to store in verification table
        const token = await createEmailVerificationToken(
          secret,
          normalizedEmail,
          undefined,
          expiresIn
        );

        // 4. Send verification email (must be inside transaction for atomicity)
        // If this fails, the entire transaction will rollback
        const callbackURL = encodeURIComponent(`${baseURL}/verify-email?verified=true`);
        const verificationUrl = `${baseURL}/verify-email?token=${token}&callbackURL=${callbackURL}`;

        await sendEmail({
          to: normalizedEmail,
          subject: "Verifica tu dirección de correo electrónico",
          text: `Verifica tu dirección de correo electrónico\n\nHaz clic en el siguiente enlace para verificar tu correo:\n${verificationUrl}\n\nEste enlace expirará en 24 horas.\n\nSi no solicitaste esta verificación, por favor ignora este correo.`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Verifica tu dirección de correo electrónico</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin: 20px 0;">
                <h1 style="color: #2c3e50; margin-top: 0;">Verifica tu dirección de correo electrónico</h1>
                <p style="font-size: 16px; margin-bottom: 20px;">¡Gracias por registrarte! Por favor, haz clic en el botón de abajo para verificar tu dirección de correo electrónico:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${verificationUrl}" style="display: inline-block; background-color: #007bff; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 5px; font-weight: 600; font-size: 16px;">Verificar Correo Electrónico</a>
                </div>
                <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">O copia y pega este enlace en tu navegador:</p>
                <p style="font-size: 12px; color: #6c757d; word-break: break-all; background-color: #e9ecef; padding: 10px; border-radius: 4px;">${verificationUrl}</p>
                <p style="font-size: 14px; color: #6c757d; margin-top: 20px;"><strong>Este enlace expirará en 24 horas.</strong></p>
                <p style="font-size: 14px; color: #6c757d; margin-top: 20px; border-top: 1px solid #dee2e6; padding-top: 20px;">Si no solicitaste esta verificación, por favor ignora este correo.</p>
              </div>
            </body>
            </html>
          `,
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
      
      // Check if error is from email sending (will be thrown by sendEmail)
      if (dbError.message?.includes("Failed to send email") || dbError.message?.includes("email")) {
        console.error("Email sending failed during registration:", dbError);
        // Transaction already rolled back automatically, no need to manually delete
        return NextResponse.json(
          { error: "No se pudo enviar el email de verificación. Por favor intenta nuevamente." },
          { status: 500 }
        );
      }
      
      console.error("Database transaction error:", dbError);
      return NextResponse.json(
        { error: "Registration failed. Please try again." },
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

