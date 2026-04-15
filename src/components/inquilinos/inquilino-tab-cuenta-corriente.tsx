"use client";

import { useState } from "react";

interface Movimiento {
  id: string;
  fecha: string;
  descripcion: string;
  tipo: string;
  monto: string;
  categoria: string | null;
  comprobante: string | null;
  nota: string | null;
  contratoId: string | null;
}

interface ContratoData {
  monthlyAmount: string;
  paymentDay: number;
  endDate: string;
  adjustmentIndex: string;
  adjustmentFrequency: number;
  paymentModality: string;
  contractNumber: string;
}

interface Props {
  inquilinoId: string;
  inquilinoNombre: string;
  estado: string;
  diasMora: number;
  contrato: ContratoData | null;
  movimientos: Movimiento[];
}

function formatMonto(val: string | number) {
  return "$" + Number(val).toLocaleString("es-AR", { minimumFractionDigits: 0 });
}

function formatFecha(iso: string) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

type FiltroEstado = "todos" | "ingreso" | "egreso";

export function InquilinoTabCuentaCorriente({
  estado,
  diasMora,
  contrato,
  movimientos,
  inquilinoNombre,
}: Props) {
  const [filtro, setFiltro] = useState<FiltroEstado>("todos");

  const ingresos = movimientos.filter((m) => m.tipo === "ingreso");
  const totalCobrado = ingresos.reduce((acc, m) => acc + Number(m.monto), 0);

  const filtrados =
    filtro === "todos"
      ? movimientos
      : movimientos.filter((m) => m.tipo === filtro);

  const enMora = estado === "en_mora";

  // Próximo vencimiento (día del mes actual o siguiente)
  let proximoVto: string | null = null;
  if (contrato) {
    const today = new Date();
    const dueThisMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      contrato.paymentDay
    );
    const due =
      dueThisMonth >= today
        ? dueThisMonth
        : new Date(today.getFullYear(), today.getMonth() + 1, contrato.paymentDay);
    proximoVto = formatFecha(due.toISOString().slice(0, 10));
  }

  return (
    <div className="p-7 flex flex-col gap-5">
      {/* Alerta de mora */}
      {enMora && (
        <div className="bg-error-dim border border-error/25 border-l-[3px] border-l-error rounded-[10px] px-5 py-4 flex items-center gap-4">
          <span className="text-xl flex-shrink-0">⚠️</span>
          <div className="flex-1">
            <div className="text-[0.82rem] font-semibold text-error mb-0.5">
              Inquilino en mora — {diasMora} días
            </div>
            <div className="text-[0.75rem] text-error/70">
              El vencimiento del período actual ya pasó sin registro de pago.
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {/* Deuda / situación actual */}
        <div
          className={`rounded-[10px] border p-5 ${
            enMora
              ? "border-error/30 bg-error/5"
              : "border-border bg-surface"
          }`}
        >
          <div
            className={`text-[0.68rem] font-semibold uppercase tracking-[0.08em] mb-2 ${
              enMora ? "text-error/70" : "text-text-muted"
            }`}
          >
            {enMora ? "Deuda en mora" : "Estado de cuenta"}
          </div>
          <div
            className={`font-headline text-[1.6rem] leading-none mb-1 ${
              enMora ? "text-error" : "text-success"
            }`}
          >
            {enMora && contrato ? formatMonto(contrato.monthlyAmount) : "Al día"}
          </div>
          {enMora && (
            <div className="text-[0.7rem] text-text-muted">
              {diasMora} días sin pago registrado
            </div>
          )}
        </div>

        {/* Próximo vencimiento */}
        <div className="rounded-[10px] border border-border bg-surface p-5">
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-2">
            Próximo vencimiento
          </div>
          <div className="font-headline text-[1.6rem] leading-none mb-1 text-on-bg">
            {contrato ? formatMonto(contrato.monthlyAmount) : "—"}
          </div>
          <div className="text-[0.7rem] text-text-muted">
            {proximoVto ? `Vence el ${proximoVto}` : "Sin contrato activo"}
          </div>
        </div>

        {/* Total cobrado */}
        <div className="rounded-[10px] border border-success/25 bg-success/5 p-5">
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-2">
            Total cobrado (registrado)
          </div>
          <div className="font-headline text-[1.6rem] leading-none mb-1 text-success">
            {formatMonto(totalCobrado)}
          </div>
          <div className="text-[0.7rem] text-text-muted">
            {ingresos.length} ingreso{ingresos.length !== 1 ? "s" : ""} registrado{ingresos.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Próxima actualización por índice */}
      {contrato && contrato.adjustmentIndex !== "sin_ajuste" && (
        <div className="bg-surface border border-blue/20 border-l-[3px] border-l-blue rounded-[10px] px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[0.82rem] font-semibold text-blue flex items-center gap-2">
              📈 Actualización por índice
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-[0.65rem] text-text-muted uppercase tracking-[0.07em] mb-1">Índice</div>
              <div className="text-[0.85rem] font-semibold text-blue">{contrato.adjustmentIndex} (BCRA)</div>
            </div>
            <div>
              <div className="text-[0.65rem] text-text-muted uppercase tracking-[0.07em] mb-1">Frecuencia</div>
              <div className="text-[0.85rem] font-semibold text-on-bg">
                Cada {contrato.adjustmentFrequency} meses
              </div>
            </div>
            <div>
              <div className="text-[0.65rem] text-text-muted uppercase tracking-[0.07em] mb-1">Alquiler actual</div>
              <div className="text-[0.85rem] font-semibold text-on-bg">
                {formatMonto(contrato.monthlyAmount)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historial de movimientos */}
      <div className="rounded-[10px] border border-border bg-surface overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <div className="text-[0.82rem] font-semibold text-on-bg flex items-center gap-2">
            📅 Historial de movimientos
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as FiltroEstado)}
              className="bg-surface-mid border border-border rounded-[8px] text-[0.75rem] text-on-surface px-2.5 py-1.5 outline-none"
            >
              <option value="todos">Todos</option>
              <option value="ingreso">Ingresos</option>
              <option value="egreso">Egresos</option>
            </select>
          </div>
        </div>

        {filtrados.length === 0 ? (
          <div className="px-5 py-10 text-center text-[0.8rem] text-text-muted">
            No hay movimientos registrados aún.
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-mid">
                <th className="px-4 py-2.5 text-left text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-muted border-b border-border">
                  Fecha
                </th>
                <th className="px-4 py-2.5 text-left text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-muted border-b border-border">
                  Descripción
                </th>
                <th className="px-4 py-2.5 text-left text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-muted border-b border-border">
                  Categoría
                </th>
                <th className="px-4 py-2.5 text-right text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-muted border-b border-border">
                  Monto
                </th>
                <th className="px-4 py-2.5 text-center text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-muted border-b border-border">
                  Tipo
                </th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((mov) => (
                <tr
                  key={mov.id}
                  className="border-b border-border/50 last:border-b-0 hover:bg-surface-mid/40 transition-colors"
                >
                  <td className="px-4 py-3 text-[0.8rem] text-text-secondary whitespace-nowrap">
                    {formatFecha(mov.fecha)}
                  </td>
                  <td className="px-4 py-3 text-[0.82rem] text-on-bg font-medium">
                    {mov.descripcion}
                    {mov.nota && (
                      <div className="text-[0.7rem] text-text-muted font-normal mt-0.5">{mov.nota}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[0.75rem] text-text-muted">
                    {mov.categoria ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`text-[0.82rem] font-semibold ${
                        mov.tipo === "ingreso" ? "text-success" : "text-error"
                      }`}
                    >
                      {mov.tipo === "ingreso" ? "+" : "-"}{formatMonto(mov.monto)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[0.7rem] font-semibold ${
                        mov.tipo === "ingreso"
                          ? "bg-success/10 text-success"
                          : "bg-error/10 text-error"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                      {mov.tipo === "ingreso" ? "Ingreso" : "Egreso"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
