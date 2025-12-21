import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * Better Auth API Route Handler
 * 
 * This route handles all Better Auth API requests.
 * The [...all] catch-all route pattern captures all paths under /api/auth/*
 */
const handler = toNextJsHandler(auth);

export const GET = handler.GET;
export const POST = handler.POST;
export const PUT = handler.PUT;
export const PATCH = handler.PATCH;
export const DELETE = handler.DELETE;
