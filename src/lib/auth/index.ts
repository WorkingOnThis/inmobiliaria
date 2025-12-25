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
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000",
  basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET || "change-me-in-production",

  // User configuration with additional fields
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "visitor",
        input: false, // Don't allow user to set role during signup
      },
    },
  },

  // Email Verification configuration
  emailVerification: {
    // Send verification email callback
    sendVerificationEmail: async ({ user, url, token }, request) => {
      await sendEmail({
        to: user.email,
        subject: "Verifica tu dirección de correo electrónico",
        text: `Verifica tu dirección de correo electrónico\n\nHaz clic en el siguiente enlace para verificar tu correo:\n${url}\n\nEste enlace expirará en 24 horas.\n\nSi no solicitaste esta verificación, por favor ignora este correo.`,
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
                <a href="${url}" style="display: inline-block; background-color: #007bff; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 5px; font-weight: 600; font-size: 16px;">Verificar Correo Electrónico</a>
              </div>
              <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">O copia y pega este enlace en tu navegador:</p>
              <p style="font-size: 12px; color: #6c757d; word-break: break-all; background-color: #e9ecef; padding: 10px; border-radius: 4px;">${url}</p>
              <p style="font-size: 14px; color: #6c757d; margin-top: 20px;"><strong>Este enlace expirará en 24 horas.</strong></p>
              <p style="font-size: 14px; color: #6c757d; margin-top: 20px; border-top: 1px solid #dee2e6; padding-top: 20px;">Si no solicitaste esta verificación, por favor ignora este correo.</p>
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
        subject: "Restablece tu contraseña",
        text: `Restablece tu contraseña\n\nHaz clic en el siguiente enlace para restablecer tu contraseña:\n${url}\n\nEste enlace expirará en 1 hora.\n\nSi no solicitaste un restablecimiento de contraseña, por favor ignora este correo y tu contraseña permanecerá sin cambios.`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Restablece tu contraseña</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin: 20px 0;">
              <h1 style="color: #2c3e50; margin-top: 0;">Restablece tu contraseña</h1>
              <p style="font-size: 16px; margin-bottom: 20px;">Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para crear una nueva contraseña:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${url}" style="display: inline-block; background-color: #dc3545; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 5px; font-weight: 600; font-size: 16px;">Restablecer Contraseña</a>
              </div>
              <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">O copia y pega este enlace en tu navegador:</p>
              <p style="font-size: 12px; color: #6c757d; word-break: break-all; background-color: #e9ecef; padding: 10px; border-radius: 4px;">${url}</p>
              <p style="font-size: 14px; color: #6c757d; margin-top: 20px;"><strong>Este enlace expirará en 1 hora.</strong></p>
              <p style="font-size: 14px; color: #dc3545; margin-top: 20px; border-top: 1px solid #dee2e6; padding-top: 20px;"><strong>Aviso de seguridad:</strong> Si no solicitaste un restablecimiento de contraseña, por favor ignora este correo y tu contraseña permanecerá sin cambios.</p>
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
      enabled: false, // Deshabilitado para evitar problemas después del logout
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
    process.env.BETTER_AUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000",
  ],
});

export type Session = typeof auth.$Infer.Session;
