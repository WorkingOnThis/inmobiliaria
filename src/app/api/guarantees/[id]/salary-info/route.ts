import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { guarantee } from "@/db/schema/guarantee";
import { guaranteeSalaryInfo } from "@/db/schema/guarantee-salary-info";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { requireAgencyId, requireAgencyResource, handleAgencyError } from "@/lib/auth/agency";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

const salaryInfoSchema = z.object({
  employerName: z.string().optional().nullable(),
  employerAddress: z.string().optional().nullable(),
  employerPhone: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  jobStartDate: z.string().optional().nullable(),
  employmentType: z.string().optional().nullable(),
  monthlyGrossSalary: z.string().optional().nullable(),
  cuitEmpleador: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const agencyId = requireAgencyId(session);

    if (!canManageClients(session!.user.role)) {
      return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const result = salaryInfoSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    await requireAgencyResource(guarantee, id, agencyId);

    const [parentGuarantee] = await db
      .select({ id: guarantee.id, kind: guarantee.kind })
      .from(guarantee)
      .where(and(eq(guarantee.id, id), eq(guarantee.agencyId, agencyId)))
      .limit(1);

    if (!parentGuarantee) {
      return NextResponse.json({ error: "Garantía no encontrada" }, { status: 404 });
    }

    if (parentGuarantee.kind !== "salaryReceipt") {
      return NextResponse.json(
        { error: "Solo se puede agregar ficha laboral a garantías de recibo de sueldo" },
        { status: 400 }
      );
    }

    const existing = await db
      .select({ id: guaranteeSalaryInfo.id })
      .from(guaranteeSalaryInfo)
      .where(eq(guaranteeSalaryInfo.guaranteeId, id))
      .limit(1);

    let salaryInfo;
    if (existing.length > 0) {
      const [updated] = await db
        .update(guaranteeSalaryInfo)
        .set({ ...result.data, updatedAt: new Date() })
        .where(eq(guaranteeSalaryInfo.guaranteeId, id))
        .returning();
      salaryInfo = updated;
    } else {
      const [created] = await db
        .insert(guaranteeSalaryInfo)
        .values({ guaranteeId: id, ...result.data })
        .returning();
      salaryInfo = created;
    }

    return NextResponse.json({ salaryInfo });
  } catch (error) {
    const resp = handleAgencyError(error);
    if (resp) return resp;
    console.error("Error upserting salary info:", error);
    return NextResponse.json({ error: "Error al guardar la ficha laboral" }, { status: 500 });
  }
}
