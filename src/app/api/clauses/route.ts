import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { clauseTemplate } from "@/db/schema/clause";
import { auth } from "@/lib/auth";
import { canManageClauses } from "@/lib/permissions";
import {
  CLAUSE_CATEGORIES,
  MAX_TITLE_LENGTH,
  MAX_CONTENT_LENGTH,
} from "@/lib/clauses/constants";

/**
 * Generate a unique ID for database records
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Clauses API Route
 *
 * Handles creation of clause templates.
 * Requires user to have clause management permissions.
 */
export async function POST(request: NextRequest) {
  try {
    // Obtener sesión del usuario
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    // Verificar autenticación
    if (!session?.user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // Verificar permisos
    if (!canManageClauses(session.user.role)) {
      return NextResponse.json(
        { error: "No tienes permisos para crear cláusulas" },
        { status: 403 }
      );
    }

    // Parsear body
    const body = await request.json();
    const { title, category, content } = body;

    // Validar campos requeridos
    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "El título es requerido" },
        { status: 400 }
      );
    }

    if (!category || typeof category !== "string") {
      return NextResponse.json(
        { error: "La categoría es requerida" },
        { status: 400 }
      );
    }

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "El contenido es requerido" },
        { status: 400 }
      );
    }

    // Validar límites de longitud
    const trimmedTitle = title.trim();
    if (trimmedTitle.length === 0) {
      return NextResponse.json(
        { error: "El título no puede estar vacío" },
        { status: 400 }
      );
    }

    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        {
          error: `El título no puede exceder ${MAX_TITLE_LENGTH} caracteres`,
        },
        { status: 400 }
      );
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      return NextResponse.json(
        { error: "El contenido no puede estar vacío" },
        { status: 400 }
      );
    }

    if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        {
          error: `El contenido no puede exceder ${MAX_CONTENT_LENGTH} caracteres`,
        },
        { status: 400 }
      );
    }

    // Validar categoría
    if (!CLAUSE_CATEGORIES.includes(category as any)) {
      return NextResponse.json(
        { error: "La categoría seleccionada no es válida" },
        { status: 400 }
      );
    }

    // Crear cláusula en la base de datos
    const clauseId = generateId();
    const now = new Date();

    const [newClause] = await db
      .insert(clauseTemplate)
      .values({
        id: clauseId,
        title: trimmedTitle,
        category: category,
        content: trimmedContent,
        creatorId: session.user.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json(
      {
        message: "Cláusula creada exitosamente",
        clause: {
          id: newClause.id,
          title: newClause.title,
          category: newClause.category,
          createdAt: newClause.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating clause:", error);
    return NextResponse.json(
      {
        error: "Ocurrió un error al crear la cláusula. Por favor intenta de nuevo.",
      },
      { status: 500 }
    );
  }
}

