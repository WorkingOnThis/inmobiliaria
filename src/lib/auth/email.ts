/**
 * Email sending functions for Better Auth
 * 
 * This file contains functions for sending authentication emails.
 * For production, integrate with a service like Resend, SendGrid, or similar.
 */

export interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

/**
 * Send an email
 * 
 * @param options Email options including recipient, subject, and body
 * @returns Promise that resolves when email is sent
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
  // TODO: Replace with actual email service integration (Resend, SendGrid, etc.)
  // For development, we'll just log to console
  console.log("📧 Email would be sent:", {
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });

  // In production, replace with actual email service:
  // 
  // import { Resend } from "resend";
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: process.env.EMAIL_FROM!,
  //   to: options.to,
  //   subject: options.subject,
  //   html: options.html,
  //   text: options.text,
  // });
}

