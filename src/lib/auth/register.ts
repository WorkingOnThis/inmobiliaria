import { db } from "@/db";
import { user } from "@/db/schema/better-auth";
import { eq } from "drizzle-orm";

/**
 * Registration logic utilities
 */

export interface RegisterWithEmailPasswordInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password meets minimum requirements
 * Minimum 8 characters (Better Auth handles this, but we validate too)
 */
function isValidPassword(password: string): boolean {
  return password.length >= 8 && password.length <= 128;
}

/**
 * Check if email already exists in Better Auth user table
 */
export async function emailExists(email: string): Promise<boolean> {
  const existingUser = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  return existingUser.length > 0;
}

/**
 * Validate registration input
 */
export function validateRegistrationInput(
  input: RegisterWithEmailPasswordInput
): { valid: boolean; error?: string } {
  if (!input.firstName || !input.firstName.trim()) {
    return { valid: false, error: "First name is required" };
  }
  if (!input.lastName || !input.lastName.trim()) {
    return { valid: false, error: "Last name is required" };
  }
  if (!isValidEmail(input.email)) {
    return { valid: false, error: "Invalid email format" };
  }
  if (!isValidPassword(input.password)) {
    return {
      valid: false,
      error: "Password must be at least 8 characters long",
    };
  }
  return { valid: true };
}
