import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    total: 3,
    monto_total: 486000,
    items: [
      {
        id: "mora-001",
        iniciales: "LS",
        nombre: "Laura Suárez",
        propiedad: "Mitre 80",
        contrato: "CON-2024-0022",
        monto: 198500,
        dias: 32,
      },
      {
        id: "mora-002",
        iniciales: "JP",
        nombre: "Jorge Paz",
        propiedad: "Tucumán 445",
        contrato: "CON-2024-0029",
        monto: 142000,
        dias: 17,
      },
      {
        id: "mora-003",
        iniciales: "FM",
        nombre: "Federico Molina",
        propiedad: "Pueyrredón 3",
        contrato: "CON-2025-0011",
        monto: 145500,
        dias: 8,
      },
    ],
  });
}
