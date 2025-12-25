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
  
  // Email Verification configuration
  emailVerification: {
    // Send verification email callback
    sendVerificationEmail: async ({ user, url, token }, request) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email address",
        text: `Verify your email address\n\nClick the following link to verify your email:\n${url}\n\nThis link will expire in 24 hours.\n\nIf you did not request this verification, please ignore this email.`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify your email address</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin: 20px 0;">
              <h1 style="color: #2c3e50; margin-top: 0;">Verify your email address</h1>
              <p style="font-size: 16px; margin-bottom: 20px;">Thank you for registering! Please click the button below to verify your email address:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${url}" style="display: inline-block; background-color: #007bff; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 5px; font-weight: 600; font-size: 16px;">Verify Email Address</a>
              </div>
              <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">Or copy and paste this link into your browser:</p>
              <p style="font-size: 12px; color: #6c757d; word-break: break-all; background-color: #e9ecef; padding: 10px; border-radius: 4px;">${url}</p>
              <p style="font-size: 14px; color: #6c757d; margin-top: 20px;"><strong>This link will expire in 24 hours.</strong></p>
              <p style="font-size: 14px; color: #6c757d; margin-top: 20px; border-top: 1px solid #dee2e6; padding-top: 20px;">If you did not request this verification, please ignore this email.</p>
            </div>
          </body>
          </html>
        `,
      });
    },
  },
  
  // Email and Password configuration
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    
    // Send password reset email callback (for future use)
    sendResetPassword: async ({ user, url, token }, request) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your password",
        text: `Reset your password\n\nClick the following link to reset your password:\n${url}\n\nThis link will expire in 1 hour.\n\nIf you did not request a password reset, please ignore this email and your password will remain unchanged.`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset your password</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin: 20px 0;">
              <h1 style="color: #2c3e50; margin-top: 0;">Reset your password</h1>
              <p style="font-size: 16px; margin-bottom: 20px;">We received a request to reset your password. Click the button below to create a new password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${url}" style="display: inline-block; background-color: #dc3545; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 5px; font-weight: 600; font-size: 16px;">Reset Password</a>
              </div>
              <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">Or copy and paste this link into your browser:</p>
              <p style="font-size: 12px; color: #6c757d; word-break: break-all; background-color: #e9ecef; padding: 10px; border-radius: 4px;">${url}</p>
              <p style="font-size: 14px; color: #6c757d; margin-top: 20px;"><strong>This link will expire in 1 hour.</strong></p>
              <p style="font-size: 14px; color: #dc3545; margin-top: 20px; border-top: 1px solid #dee2e6; padding-top: 20px;"><strong>Security notice:</strong> If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
            </div>
          </body>
          </html>
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
