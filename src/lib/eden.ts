import { treaty } from "@elysiajs/eden";
import type { AppType } from "@/app/api/[[...slugs]]/route";

// Create type-safe API client using Eden Treaty
// The URL will be automatically determined based on the environment
const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    // Browser: use relative URL
    return "";
  }
  // Server: use absolute URL from environment or default to localhost
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
};

export const api = treaty<AppType>(getBaseUrl()).api;
