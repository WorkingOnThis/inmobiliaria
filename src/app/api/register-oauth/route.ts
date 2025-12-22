import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema/better-auth";
import { agency } from "@/db/schema/agency";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

/**
 * Register OAuth API Route
 * 
 * Completes OAuth registration by creating Agency entity
 * for a user that was already created via OAuth authentication.
 */
export async function POST(request: NextRequest) {
  try {
    // Get current session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userEmail = session.user.email;

    // Check if user already has agency
    const existingAgency = await db
      .select()
      .from(agency)
      .where(eq(agency.ownerId, session.user.id))
      .limit(1);

    if (existingAgency.length > 0) {
      return NextResponse.json(
        { error: "User already has an agency" },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { agencyName } = body;

    // Validate agency name
    if (!agencyName || !agencyName.trim()) {
      return NextResponse.json(
        { error: "Agency name is required" },
        { status: 400 }
      );
    }

    // Get Better Auth user
    const betterAuthUser = await db
      .select()
      .from(user)
      .where(eq(user.email, userEmail))
      .limit(1);

    if (betterAuthUser.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const userId = betterAuthUser[0].id;

    // Create Agency linked to user in transaction
    const agencyId = crypto.randomUUID();

    try {
      await db.transaction(async (tx) => {
        // Create Agency
        await tx.insert(agency).values({
          id: agencyId,
          name: agencyName.trim(),
          ownerId: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Ensure user has role set
        await tx
          .update(user)
          .set({ role: "account_admin" })
          .where(eq(user.id, userId));
      });
    } catch (dbError: any) {
      console.error("Database transaction error:", dbError);
      return NextResponse.json(
        { error: "Failed to create registration entities" },
        { status: 500 }
      );
    }

    // Log successful registration
    console.log(`[OAUTH REGISTRATION] User completed registration: ${userEmail}`);

    return NextResponse.json(
      {
        success: true,
        message: "Registration completed successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("OAuth registration API error:", error);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}


