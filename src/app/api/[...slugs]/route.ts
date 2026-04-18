import { Elysia, t } from "elysia";
import { db } from "@/db";

// Create Elysia instance with API prefix
const app = new Elysia({ prefix: "/api" })
  // Root endpoint
  .get("/", () => ({
    message: "API is running",
    version: "1.0.0",
  }))
  // Health check endpoint
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));
// Example: Add your API routes here
// .get("/users", async () => {
//   const users = await db.select().from(users);
//   return { users };
// })
// .post(
//   "/users",
//   async ({ body }) => {
//     const newUser = await db.insert(users).values(body).returning();
//     return { user: newUser[0] };
//   },
//   {
//     body: t.Object({
//       name: t.String({ minLength: 1 }),
//       email: t.String({ format: "email" }),
//     }),
//   }
// );

// Export Elysia handlers for Next.js Route Handler
export const GET = app.fetch;
export const POST = app.fetch;
export const PUT = app.fetch;
export const PATCH = app.fetch;
export const DELETE = app.fetch;

// Export app type for Eden Treaty client (enables type-safe API calls)
export type AppType = typeof app;
