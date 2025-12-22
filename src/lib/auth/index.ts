import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";

// Import email sending function
import { sendEmail } from "./email";

/**
 * Better Auth configuration
 * 
 * This is the main configuration file for Better Auth.
 * It sets up authentication with Drizzle ORM adapter for PostgreSQL.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg", // PostgreSQL
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      rateLimit: schema.rateLimit,
    },
  }),
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET || "change-me-in-production",
  
  // Email and Password configuration
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    
    // Send verification email callback
    sendVerificationEmail: async ({ user, url, token }, request) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email address",
        text: `Click the following link to verify your email: ${url}`,
        html: `
          <h1>Verify your email address</h1>
          <p>Click the following link to verify your email:</p>
          <a href="${url}">${url}</a>
          <p>This link will expire in 24 hours.</p>
        `,
      });
    },
    
    // Send password reset email callback (for future use)
    sendResetPassword: async ({ user, url, token }, request) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your password",
        text: `Click the following link to reset your password: ${url}`,
        html: `
          <h1>Reset your password</h1>
          <p>Click the following link to reset your password:</p>
          <a href="${url}">${url}</a>
          <p>This link will expire in 1 hour.</p>
        `,
      });
    },
  },
  
  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days for persistent sessions
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  
  // Rate limiting configuration
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    window: 60, // 60 seconds default window
    max: 100, // 100 requests per window
    customRules: {
      "/sign-in/email": {
        window: 15 * 60, // 15 minutes
        max: 5, // 5 failed attempts
      },
      "/sign-up/email": {
        window: 15 * 60, // 15 minutes
        max: 5, // 5 registration attempts per IP
      },
    },
    storage: "database", // Store rate limits in database
    modelName: "rateLimit", // Use the rateLimit table we defined
  },
  
  // Social providers (OAuth)
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      scope: ["email", "profile"],
    },
  },
  
  // Trusted origins for CORS (if needed)
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ],
});

export type Session = typeof auth.$Infer.Session;
