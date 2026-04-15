import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    total: 9,
    items: [
      {
        id: "tarea-001",
        titulo: "Revisar borrador carta documento",
        propiedad: "Mitre 80 · Laura Suárez",
        fecha: "Vence hoy",
        prioridad: "urgente",
        origen: "auto",
      },
      {
        id: "tarea-002",
        titulo: "Aprobar actualización ICL",
        propiedad: "San Juan 88 · $142.500 → $156.000",
        fecha: "Mañana",
        prioridad: "urgente",
        origen: "auto",
      },
      {
        id: "tarea-003",
        titulo: "Confirmar intención renovación",
        propiedad: "Pueyrredón 3 · Vence 27 jul",
        fecha: "3 días",
        prioridad: "alta",
        origen: "auto",
      },
      {
        id: "tarea-004",
        titulo: "Seguimiento comprobante gas",
        propiedad: "Av. Colón 1280 · Sofía Ramírez",
        fecha: "5 días",
        prioridad: "alta",
        origen: "auto",
      },
      {
        id: "tarea-005",
        titulo: "Llamar propietario · Tucumán 445",
        propiedad: "Gestión de mora · R. Gómez",
        fecha: "Esta semana",
        prioridad: "media",
        origen: "manual",
      },
    ],
  });
}
