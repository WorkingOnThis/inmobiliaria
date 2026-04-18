"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Printer, ArrowLeft } from "lucide-react";

function formatMonto(val: string | number) {
  return "$" + Number(val).toLocaleString("es-AR", { minimumFractionDigits: 2 });
}

function formatFecha(iso: string) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function formatPeriodo(p: string | null) {
  if (!p) return null;
  const [year, month] = p.split("-");
  const nombres = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${nombres[parseInt(month) - 1]} ${year}`;
}

function montoEnLetras(monto: number): string {
  // Implementación básica para montos típicos de alquiler
  const enLetras = (n: number): string => {
    const unidades = ["","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve","diez","once","doce","trece","catorce","quince","dieciséis","diecisiete","dieciocho","diecinueve","veinte"];
    const decenas = ["","","veinti","treinta","cuarenta","cincuenta","sesenta","setenta","ochenta","noventa"];
    const centenas = ["","ciento","doscientos","trescientos","cuatrocientos","quinientos","seiscientos","setecientos","ochocientos","novecientos"];
    if (n === 0) return "cero";
    if (n === 100) return "cien";
    if (n <= 20) return unidades[n];
    if (n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      if (d === 2 && u > 0) return `veinti${unidades[u]}`;
      return u === 0 ? decenas[d] : `${decenas[d]} y ${unidades[u]}`;
    }
    if (n < 1000) {
      const c = Math.floor(n / 100);
      const rest = n % 100;
      return rest === 0 ? centenas[c] : `${centenas[c]} ${enLetras(rest)}`;
    }
    if (n < 1000000) {
      const miles = Math.floor(n / 1000);
      const rest = n % 1000;
      const milStr = miles === 1 ? "mil" : `${enLetras(miles)} mil`;
      return rest === 0 ? milStr : `${milStr} ${enLetras(rest)}`;
    }
    return n.toString();
  };

  const entero = Math.floor(monto);
  const centavos = Math.round((monto - entero) * 100);
  let resultado = enLetras(entero).toUpperCase();
  resultado += centavos > 0 ? ` CON ${String(centavos).padStart(2,"0")}/100 PESOS` : " PESOS";
  return resultado;
}

export default function ReciboPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading, error } = useQuery<{
    movimiento: {
      id: string;
      reciboNumero: string;
      fecha: string;
      descripcion: string;
      monto: string;
      categoria: string | null;
      periodo: string | null;
      nota: string | null;
    };
    inquilino: {
      firstName: string;
      lastName: string | null;
      dni: string | null;
      email: string | null;
    } | null;
    propiedad: {
      address: string;
      floorUnit: string | null;
    } | null;
    contrato: {
      contractNumber: string;
    } | null;
  }>({
    queryKey: ["receipt", id],
    queryFn: async () => {
      const res = await fetch(`/api/receipts/${id}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al cargar el recibo");
      }
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-muted-foreground">
        <div className="text-[0.85rem]">{(error as Error)?.message ?? "Recibo no encontrado"}</div>
        <button onClick={() => router.back()} className="text-[0.72rem] text-primary hover:underline flex items-center gap-1">
          <ArrowLeft size={12} /> Volver
        </button>
      </div>
    );
  }

  const { movimiento, inquilino, propiedad, contrato } = data;
  const montoNum = Number(movimiento.monto);
  const nombreInquilino = inquilino
    ? inquilino.lastName
      ? `${inquilino.firstName} ${inquilino.lastName}`
      : inquilino.firstName
    : "—";

  return (
    <div className="min-h-screen bg-bg">
      {/* Barra de acciones — solo en pantalla, no imprime */}
      <div className="print:hidden h-14 bg-surface border-b border-border flex items-center justify-between px-7">
        <button
          onClick={() => router.back()}
          className="text-[0.8rem] text-text-secondary hover:text-primary flex items-center gap-1"
        >
          <ArrowLeft size={13} /> Volver
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-primary text-white text-[0.8rem] font-semibold px-4 py-2 rounded-[8px] hover:bg-primary/90 transition-colors"
        >
          <Printer size={14} /> Imprimir recibo
        </button>
      </div>

      {/* Recibo — centrado en A4 */}
      <div className="mx-auto max-w-[700px] p-8 print:p-0 print:max-w-none">
        <div className="bg-white border border-border rounded-[12px] print:border-0 print:rounded-none overflow-hidden">
          {/* Encabezado */}
          <div className="bg-primary px-8 py-6 text-white print:bg-primary">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[1.5rem] font-bold tracking-tight">ARCE ADMINISTRACIÓN</div>
                <div className="text-[0.78rem] opacity-80 mt-0.5">Gestión Inmobiliaria</div>
              </div>
              <div className="text-right">
                <div className="text-[0.7rem] opacity-70 uppercase tracking-wider">Recibo N°</div>
                <div className="text-[1.8rem] font-bold leading-none">{movimiento.reciboNumero}</div>
              </div>
            </div>
          </div>

          {/* Cuerpo */}
          <div className="px-8 py-6 space-y-6">
            {/* Datos del recibo */}
            <div className="grid grid-cols-2 gap-6 border-b border-border pb-6">
              <div>
                <div className="text-[0.65rem] text-muted-foreground uppercase tracking-wider mb-1">Fecha de emisión</div>
                <div className="text-[0.9rem] font-semibold text-on-bg">{formatFecha(movimiento.fecha)}</div>
              </div>
              {movimiento.periodo && (
                <div>
                  <div className="text-[0.65rem] text-muted-foreground uppercase tracking-wider mb-1">Período</div>
                  <div className="text-[0.9rem] font-semibold text-on-bg">{formatPeriodo(movimiento.periodo)}</div>
                </div>
              )}
              {contrato && (
                <div>
                  <div className="text-[0.65rem] text-muted-foreground uppercase tracking-wider mb-1">N° de contrato</div>
                  <div className="text-[0.9rem] font-semibold text-on-bg">{contrato.contractNumber}</div>
                </div>
              )}
            </div>

            {/* Datos del inquilino */}
            <div className="border-b border-border pb-6">
              <div className="text-[0.65rem] text-muted-foreground uppercase tracking-wider mb-3">Recibido de</div>
              <div className="text-[1.1rem] font-bold text-on-bg mb-1">{nombreInquilino}</div>
              {inquilino?.dni && (
                <div className="text-[0.8rem] text-text-secondary">DNI {inquilino.dni}</div>
              )}
              {propiedad && (
                <div className="text-[0.8rem] text-text-secondary mt-1">
                  {propiedad.address}{propiedad.floorUnit ? ` ${propiedad.floorUnit}` : ""}
                </div>
              )}
            </div>

            {/* Concepto y monto */}
            <div className="border-b border-border pb-6">
              <div className="text-[0.65rem] text-muted-foreground uppercase tracking-wider mb-3">Concepto</div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-[0.9rem] text-on-bg">{movimiento.descripcion}</div>
                  {movimiento.nota && (
                    <div className="text-[0.75rem] text-muted-foreground mt-1">{movimiento.nota}</div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[1.6rem] font-bold text-primary">{formatMonto(movimiento.monto)}</div>
                </div>
              </div>
              <div className="mt-3 text-[0.72rem] text-muted-foreground italic">
                Son: {montoEnLetras(montoNum)}
              </div>
            </div>

            {/* Firma */}
            <div className="pt-2">
              <div className="flex justify-end">
                <div className="text-center">
                  <div className="border-t border-border w-48 pt-2 mt-12">
                    <div className="text-[0.72rem] text-muted-foreground">Firma y sello</div>
                    <div className="text-[0.72rem] font-semibold text-on-bg mt-0.5">Arce Administración</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pie */}
          <div className="bg-surface-mid px-8 py-3 border-t border-border">
            <div className="text-[0.65rem] text-muted-foreground text-center">
              Este recibo es un comprobante válido de pago emitido por Arce Administración.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
