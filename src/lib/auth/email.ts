/**
 * Email sending functions for Better Auth
 * 
 * This file contains functions for sending authentication emails.
 * Uses Resend for email delivery in production.
 */

import { Resend } from "resend";

export interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

// Initialize Resend client (lazy initialization)
let resendClient: Resend | null = null;

/**
 * Get or create Resend client instance
 */
function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

/**
 * Send an email using Resend
 * 
 * @param options Email options including recipient, subject, and body
 * @returns Promise that resolves when email is sent
 * @throws Error if email sending fails and API key is configured
 * 
 * @example
 * ```ts
 * await sendEmail({
 *   to: "user@example.com",
 *   subject: "Verify your email",
 *   text: "Click here to verify: https://example.com/verify?token=abc123"
 * });
 * ```
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const resend = getResendClient();
  const emailFrom = process.env.EMAIL_FROM;

  // Validate environment variables
  if (!resend) {
    const warning = "⚠️ RESEND_API_KEY not configured. Email will be logged to console.";
    console.warn(warning);
    console.log("📧 Email would be sent:", {
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    return;
  }

  if (!emailFrom) {
    const warning = "⚠️ EMAIL_FROM not configured. Email will be logged to console.";
    console.warn(warning);
    console.log("📧 Email would be sent:", {
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    return;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(options.to)) {
    throw new Error(`Invalid email address: ${options.to}`);
  }

  try {
    const result = await resend.emails.send({
      from: emailFrom,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (result.error) {
      console.error("Failed to send email:", {
        error: result.error,
        to: options.to,
        subject: options.subject,
      });
      throw new Error(`Failed to send email: ${result.error.message || "Unknown error"}`);
    }

    console.log("✅ Email sent successfully:", {
      to: options.to,
      subject: options.subject,
      id: result.data?.id,
    });
  } catch (error) {
    // Log error with context
    console.error("Error sending email:", {
      error: error instanceof Error ? error.message : String(error),
      to: options.to,
      subject: options.subject,
      type: "email_send_error",
    });

    // Re-throw to allow caller to handle
    throw error;
  }
}

