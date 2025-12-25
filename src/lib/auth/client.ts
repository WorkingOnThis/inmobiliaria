import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "./index";

/**
 * Better Auth client for client-side usage
 * 
 * This client is used in React components to interact with Better Auth.
 * It provides type-safe methods for authentication operations.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 
           (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"),
  plugins: [inferAdditionalFields<typeof auth>()],
});
