"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Filtro = "todos" | "ingresos" | "egresos";

interface Movimiento {
  id: string;
  fecha: string;
  descripcion: string;
  tipo: "ingreso" | "egreso";
  categoria: string | null;
  monto: string;
  origen: string;
  comprobante: string | null;
  nota: string | null;
  contratoId: string | null;
  contratoNumero: string | null;
  propiedadId: string | null;
  propiedadDireccion: string | null;
  propietarioId: string | null;
  propietarioNombre: string | null;
  inquilinoId: string | null;
  inquilinoNombre: string | null;
  creadoEn: string;
}

interface RespuestaMovimientos {
  movimientos: Movimiento[];
  totales: { ingresos: number; egresos: number; saldo: number };
  periodo: { anio: number; mes: number };
}

interface Opcion {
  value: string;
  label: string;
  searchText?: string; // texto extra para filtrar (no se muestra como label principal)
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const C_INGRESO    = "#6ee7a0";
const C_INGRESO_BG = "rgba(110,231,160,0.12)";
const C_EGRESO     = "var(--color-arce-error)";
const C_EGRESO_BG  = "var(--color-arce-error-container)";
const C_NEUTRO     = "#8899ee";
const C_NEUTRO_BG  = "rgba(100,130,220,0.12)";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const CHIPS_CATEGORIA = [
  "Proveedor", "Operativo", "Honorarios", "Depósito",
  "Ajuste contable", "Reembolso", "Otro",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMonto(monto: string | number): string {
  const num = typeof monto === "string" ? parseFloat(monto) : monto;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

// ─── Estilos compartidos (tokens Arce) ───────────────────────────────────────

const S = {
  bg:             { background: "var(--color-arce-background)" },
  surface:        { background: "var(--color-arce-surface)" },
  surfaceLow:     { background: "var(--color-arce-surface-container)" },
  surfaceHigh:    { background: "var(--color-arce-surface-high)" },
  surfaceHighest: { background: "var(--color-arce-surface-highest)" },
  border:         "1px solid rgba(255,255,255,0.07)",
  textOnSurface:  { color: "var(--color-arce-on-surface)" },
  textSecondary:  { color: "var(--color-arce-secondary-text)" },
  textMuted:      { color: "rgba(200,200,204,0.4)" },
  textPrimary:    { color: "var(--color-arce-primary)" },
  textError:      { color: "var(--color-arce-error)" },
  headlineFont:   { fontFamily: "var(--font-arce-headline)" },
} as const;

// ─── Componente principal ─────────────────────────────────────────────────────

export function CajaGeneralClient() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth());
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [showModalCrear, setShowModalCrear] = useState(false);
  const [movimientoEditando, setMovimientoEditando] = useState<Movimiento | null>(null);

  const queryClient = useQueryClient();
  const periodo = `${anio}-${String(mes + 1).padStart(2, "0")}`;
  const modalAbierto = showModalCrear || movimientoEditando !== null;

  // ── Fetch movimientos del período ──
  const { data, isLoading, isError } = useQuery<RespuestaMovimientos>({
    queryKey: ["caja-movimientos", periodo],
    queryFn: async () => {
      const res = await fetch(`/api/caja/movimientos?periodo=${periodo}`);
      if (!res.ok) throw new Error("Error al cargar movimientos");
      return res.json();
    },
  });

  // ── Fetch entidades para los selectores del modal ──
  type ClienteSelector = { id: string; firstName: string; lastName: string | null; updatedAt: string };

  const { data: dataPropietarios } = useQuery<{ clients: ClienteSelector[] }>({
    queryKey: ["selector-propietarios"],
    queryFn: async () => {
      const res = await fetch("/api/clients?limit=200&type=propietario");
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: modalAbierto,
    staleTime: 60_000,
  });

  const { data: dataInquilinos } = useQuery<{ clients: ClienteSelector[] }>({
    queryKey: ["selector-inquilinos"],
    queryFn: async () => {
      const res = await fetch("/api/clients?limit=200&type=inquilino");
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: modalAbierto,
    staleTime: 60_000,
  });

  const { data: dataPropiedades } = useQuery<{
    properties: Array<{ id: string; address: string }>;
  }>({
    queryKey: ["selector-propiedades"],
    queryFn: async () => {
      const res = await fetch("/api/properties?limit=100");
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: modalAbierto,
    staleTime: 60_000,
  });

  const { data: dataContratos } = useQuery<{
    contracts: Array<{
      id: string;
      contractNumber: string;
      propertyAddress: string | null;
      ownerName: string;
      tenantNames: string[];
    }>;
  }>({
    queryKey: ["selector-contratos"],
    queryFn: async () => {
      const res = await fetch("/api/contracts?limit=100");
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: modalAbierto,
    staleTime: 60_000,
  });

  function clientesAOpciones(lista: ClienteSelector[] | undefined): Opcion[] {
    return [...(lista ?? [])]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((c) => ({
        value: c.id,
        label: `${c.firstName}${c.lastName ? " " + c.lastName : ""}`,
      }));
  }
  const opcionesPropietarios = clientesAOpciones(dataPropietarios?.clients);
  const opcionesInquilinos   = clientesAOpciones(dataInquilinos?.clients);
  const opcionesPropiedades: Opcion[] = (dataPropiedades?.properties ?? []).map((p) => ({
    value: p.id,
    label: p.address,
  }));
  const opcionesContratos: Opcion[] = (dataContratos?.contracts ?? []).map((c) => {
    const propPart = c.propertyAddress ? ` · ${c.propertyAddress}` : "";
    const personas = [c.ownerName, ...(c.tenantNames ?? [])].filter(Boolean);
    return {
      value: c.id,
      label: `${c.contractNumber}${propPart}`,
      searchText: personas.join(" · "),
    };
  });

  // ── Mutaciones ──
  const invalidarPeriodo = () =>
    queryClient.invalidateQueries({ queryKey: ["caja-movimientos", periodo] });

  const crear = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      const res = await fetch("/api/caja/movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Error al guardar"); }
      return res.json();
    },
    onSuccess: () => { invalidarPeriodo(); setShowModalCrear(false); },
  });

  const editar = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, string> }) => {
      const res = await fetch(`/api/caja/movimientos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Error al guardar"); }
      return res.json();
    },
    onSuccess: () => { invalidarPeriodo(); setMovimientoEditando(null); },
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/caja/movimientos/${id}`, { method: "DELETE" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Error al eliminar"); }
      return res.json();
    },
    onSuccess: () => { invalidarPeriodo(); setMovimientoEditando(null); },
  });

  function avanzarMes(dir: 1 | -1) {
    let nuevoMes = mes + dir;
    let nuevoAnio = anio;
    if (nuevoMes > 11) { nuevoMes = 0; nuevoAnio++; }
    if (nuevoMes < 0) { nuevoMes = 11; nuevoAnio--; }
    setMes(nuevoMes);
    setAnio(nuevoAnio);
  }

  const movimientos = data?.movimientos ?? [];
  const totales = data?.totales ?? { ingresos: 0, egresos: 0, saldo: 0 };
  const movFiltrados = movimientos.filter((m) => {
    if (filtro === "ingresos") return m.tipo === "ingreso";
    if (filtro === "egresos") return m.tipo === "egreso";
    return true;
  });

  return (
    <div className="flex flex-col gap-6 p-7 min-h-screen" style={S.bg}>

      {/* ── HEADER ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ ...S.textOnSurface, ...S.headlineFont }}>
            Caja General
          </h1>
          <p className="text-[13px] mt-0.5" style={S.textSecondary}>
            Ingresos y egresos del período · {MESES[mes]} {anio}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex items-center gap-1.5">
            <button
              className="w-7 h-7 flex items-center justify-center rounded-md text-[14px]"
              style={{ ...S.surfaceHigh, border: S.border, ...S.textSecondary }}
              onClick={() => avanzarMes(-1)}
            >‹</button>
            <div
              className="text-[14px] font-semibold px-3.5 py-1 rounded-xl min-w-[130px] text-center"
              style={{ ...S.surfaceHigh, border: S.border, ...S.headlineFont, ...S.textOnSurface }}
            >
              {MESES[mes]} {anio}
            </div>
            <button
              className="w-7 h-7 flex items-center justify-center rounded-md text-[14px]"
              style={{ ...S.surfaceHigh, border: S.border, ...S.textSecondary }}
              onClick={() => avanzarMes(1)}
            >›</button>
          </div>
          <button
            className="px-3.5 py-1.5 text-[11px] font-bold rounded-xl"
            style={{ background: "var(--color-arce-primary)", color: "var(--color-arce-on-primary)" }}
            onClick={() => setShowModalCrear(true)}
          >
            + Movimiento
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard
          label="Ingresos del período"
          valor={formatMonto(totales.ingresos)}
          sub={`${movimientos.filter(m => m.tipo === "ingreso").length} movimientos`}
          variante="success"
          isLoading={isLoading}
        />
        <KpiCard
          label="Egresos del período"
          valor={formatMonto(totales.egresos)}
          sub={`${movimientos.filter(m => m.tipo === "egreso").length} movimientos`}
          variante="error"
          isLoading={isLoading}
        />
        <KpiCard
          label="Saldo neto"
          valor={formatMonto(totales.saldo)}
          sub={totales.saldo > 0 ? "Resultado positivo" : totales.saldo < 0 ? "Resultado negativo" : "Sin movimientos"}
          variante={totales.saldo > 0 ? "success" : totales.saldo < 0 ? "error" : "neutral"}
          isLoading={isLoading}
        />
      </div>

      {/* ── TABLA ── */}
      <div className="rounded-xl overflow-hidden" style={{ ...S.surface, border: S.border }}>

        {/* Toolbar */}
        <div className="px-5 py-3.5 flex items-center gap-2 flex-wrap" style={{ borderBottom: S.border }}>
          <span className="text-[13px] font-semibold mr-2" style={S.textOnSurface}>Movimientos</span>
          <div className="flex gap-1">
            {(["todos", "ingresos", "egresos"] as Filtro[]).map((f) => (
              <button
                key={f}
                className="px-2.5 py-1 text-[10px] font-semibold rounded-full capitalize transition-colors"
                style={filtro === f
                  ? { background: "var(--color-arce-primary-fixed)", color: "var(--color-arce-primary)", border: "1px solid rgba(255,180,162,0.2)" }
                  : { background: "none", border: S.border, color: "var(--color-arce-secondary-text)" }
                }
                onClick={() => setFiltro(f)}
              >
                {f === "todos" ? "Todos" : f === "ingresos" ? "Ingresos" : "Egresos"}
              </button>
            ))}
          </div>
          <button
            className="ml-auto px-2.5 py-1 text-[10px] font-bold rounded-lg"
            style={{ background: "var(--color-arce-primary)", color: "var(--color-arce-on-primary)" }}
            onClick={() => setShowModalCrear(true)}
          >
            + Nuevo
          </button>
        </div>

        {isLoading && (
          <div className="px-5 py-10 text-center text-[13px]" style={S.textSecondary}>
            Cargando movimientos...
          </div>
        )}
        {isError && (
          <div className="px-5 py-6 text-center text-[13px]" style={S.textError}>
            No se pudieron cargar los movimientos. Intentá de nuevo.
          </div>
        )}
        {!isLoading && !isError && movFiltrados.length === 0 && (
          <div className="px-5 py-12 text-center">
            <p className="text-[14px] font-medium mb-1" style={S.textOnSurface}>
              Sin movimientos en {MESES[mes]} {anio}
            </p>
            <p className="text-[12px]" style={S.textSecondary}>
              Registrá el primer ingreso o egreso del período.
            </p>
          </div>
        )}

        {!isLoading && !isError && movFiltrados.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "var(--color-arce-surface-container)" }}>
                    {["Fecha", "Descripción", "Categoría", "Vinculado a", "Tipo", "Monto"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-[9px] font-bold uppercase tracking-[0.12em]"
                        style={{ color: "rgba(200,200,204,0.45)", ...(h === "Monto" ? { textAlign: "right" } : {}) }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movFiltrados.map((m, i) => (
                    <FilaMovimiento
                      key={m.id}
                      m={m}
                      index={i}
                      onClick={() => setMovimientoEditando(m)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex" style={{ ...S.surfaceLow, borderTop: S.border }}>
              {[
                { label: "Total ingresos", valor: formatMonto(totales.ingresos), color: C_INGRESO },
                { label: "Total egresos",  valor: formatMonto(totales.egresos),  color: C_EGRESO  },
                { label: "Saldo neto",     valor: formatMonto(totales.saldo),
                  color: totales.saldo > 0 ? C_INGRESO : totales.saldo < 0 ? C_EGRESO : C_NEUTRO },
              ].map((t, i, arr) => (
                <div
                  key={t.label}
                  className="flex-1 px-5 py-3.5"
                  style={i < arr.length - 1 ? { borderRight: S.border } : {}}
                >
                  <div className="text-[9px] font-bold uppercase tracking-[0.12em] mb-1" style={S.textMuted}>
                    {t.label}
                  </div>
                  <div className="text-[17px] font-bold tabular-nums" style={{ ...S.headlineFont, color: t.color }}>
                    {t.valor}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── MODAL CREAR ── */}
      {showModalCrear && (
        <ModalMovimiento
          modo="crear"
          opcionesPropietarios={opcionesPropietarios}
          opcionesInquilinos={opcionesInquilinos}
          opcionesPropiedades={opcionesPropiedades}
          opcionesContratos={opcionesContratos}
          onClose={() => { setShowModalCrear(false); crear.reset(); }}
          onGuardar={(datos) => crear.mutate(datos)}
          guardando={crear.isPending}
          error={crear.error?.message ?? null}
        />
      )}

      {/* ── MODAL EDITAR ── */}
      {movimientoEditando && (
        <ModalMovimiento
          modo="editar"
          movimiento={movimientoEditando}
          opcionesPropietarios={opcionesPropietarios}
          opcionesInquilinos={opcionesInquilinos}
          opcionesPropiedades={opcionesPropiedades}
          opcionesContratos={opcionesContratos}
          onClose={() => { setMovimientoEditando(null); editar.reset(); eliminar.reset(); }}
          onGuardar={(datos) => editar.mutate({ id: movimientoEditando.id, body: datos })}
          onEliminar={() => eliminar.mutate(movimientoEditando.id)}
          guardando={editar.isPending}
          eliminando={eliminar.isPending}
          error={editar.error?.message ?? eliminar.error?.message ?? null}
        />
      )}

      <style>{`
        .campo-arce {
          font-family: var(--font-arce-body);
          font-size: 0.875rem;
          color: var(--color-arce-on-surface);
          background: var(--color-arce-surface-high);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 0.75rem;
          padding: 8px 12px;
          outline: none;
          transition: border-color 0.18s;
          width: 100%;
        }
        .campo-arce:focus {
          border-color: var(--color-arce-primary);
          background: var(--color-arce-surface-highest);
        }
        .campo-arce::placeholder { color: rgba(200,200,204,0.35); }
        .campo-arce option {
          background: var(--color-arce-surface-high);
          color: var(--color-arce-on-surface);
        }
      `}</style>
    </div>
  );
}

// ─── FilaMovimiento ───────────────────────────────────────────────────────────

function FilaMovimiento({ m, index, onClick }: {
  m: Movimiento;
  index: number;
  onClick: () => void;
}) {
  const bgBase = index % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)";

  const tieneVinculos = m.contratoId || m.propiedadId || m.propietarioId || m.inquilinoId;

  return (
    <tr
      className="transition-colors cursor-pointer"
      style={{ background: bgBase }}
      onClick={onClick}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,180,162,0.05)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = bgBase; }}
    >
      <td className="px-4 py-3 text-[12px] whitespace-nowrap" style={{ color: "rgba(200,200,204,0.4)" }}>
        {m.fecha}
      </td>
      <td className="px-4 py-3">
        <div className="font-medium" style={{ color: "var(--color-arce-on-surface)" }}>{m.descripcion}</div>
        {m.comprobante && (
          <div className="text-[11px] mt-0.5" style={{ color: "rgba(200,200,204,0.4)" }}>{m.comprobante}</div>
        )}
      </td>
      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--color-arce-secondary-text)" }}>
        {m.categoria ?? <span style={{ color: "rgba(200,200,204,0.4)" }}>—</span>}
      </td>
      <td className="px-4 py-3">
        {tieneVinculos ? (
          <div className="flex flex-wrap gap-1">
            {m.contratoId && m.contratoNumero && (
              <Link
                href="/contratos"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold transition-opacity hover:opacity-70"
                style={{ background: "rgba(100,130,220,0.12)", color: "#8899ee", border: "1px solid rgba(100,130,220,0.2)" }}
              >
                {m.contratoNumero}
              </Link>
            )}
            {m.propiedadId && m.propiedadDireccion && (
              <Link
                href="/propiedades"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold transition-opacity hover:opacity-70"
                style={{ background: "rgba(80,180,130,0.12)", color: "#66c8a0", border: "1px solid rgba(80,180,130,0.2)" }}
              >
                {m.propiedadDireccion}
              </Link>
            )}
            {m.propietarioId && m.propietarioNombre && (
              <Link
                href="/clientes"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold transition-opacity hover:opacity-70"
                style={{ background: "rgba(210,170,80,0.12)", color: "#d4aa55", border: "1px solid rgba(210,170,80,0.2)" }}
              >
                {m.propietarioNombre}
              </Link>
            )}
            {m.inquilinoId && m.inquilinoNombre && (
              <Link
                href="/clientes"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold transition-opacity hover:opacity-70"
                style={{ background: "rgba(210,170,80,0.12)", color: "#d4aa55", border: "1px solid rgba(210,170,80,0.2)" }}
              >
                {m.inquilinoNombre}
              </Link>
            )}
          </div>
        ) : (
          <span style={{ color: "rgba(200,200,204,0.4)" }}>—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={m.tipo === "ingreso"
            ? { background: C_INGRESO_BG, color: C_INGRESO }
            : { background: C_EGRESO_BG,  color: C_EGRESO  }
          }
        >
          {m.tipo === "ingreso" ? "↑ Ingreso" : "↓ Egreso"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <span
          className="text-[14px] font-semibold tabular-nums"
          style={{
            fontFamily: "var(--font-arce-headline)",
            color: m.tipo === "ingreso" ? C_INGRESO : C_EGRESO,
          }}
        >
          {m.tipo === "ingreso" ? "+" : "−"}{formatMonto(m.monto)}
        </span>
      </td>
    </tr>
  );
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({ label, valor, sub, variante, isLoading }: {
  label: string;
  valor: string;
  sub: string;
  variante: "success" | "error" | "neutral";
  isLoading: boolean;
}) {
  const color = variante === "success" ? C_INGRESO : variante === "error" ? C_EGRESO : C_NEUTRO;
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--color-arce-surface)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2.5" style={{ color: "rgba(200,200,204,0.4)" }}>
        {label}
      </p>
      {isLoading ? (
        <div className="h-8 w-32 rounded-md animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
      ) : (
        <p className="text-[28px] font-bold leading-none mb-1 tabular-nums" style={{ fontFamily: "var(--font-arce-headline)", color }}>
          {valor}
        </p>
      )}
      <p className="text-[11px] mt-1" style={{ color: "var(--color-arce-secondary-text)" }}>{sub}</p>
    </div>
  );
}

// ─── BuscadorSelector ────────────────────────────────────────────────────────

function BuscadorSelector({
  opciones, valor, onCambio, placeholder, vacioLabel = "Sin vínculo", disabled,
}: {
  opciones: Opcion[];
  valor: string;
  onCambio: (val: string) => void;
  placeholder?: string;
  vacioLabel?: string;
  disabled?: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const seleccionada = opciones.find((o) => o.value === valor);

  const filtradas = busqueda.trim()
    ? opciones.filter((o) => {
        const texto = `${o.label} ${o.searchText ?? ""}`.toLowerCase();
        return texto.includes(busqueda.toLowerCase());
      })
    : opciones;

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          className="campo-arce"
          style={{ paddingRight: valor ? "2rem" : undefined }}
          value={abierto ? busqueda : (seleccionada?.label ?? "")}
          placeholder={abierto ? "Escribir para filtrar..." : placeholder ?? "Seleccionar..."}
          onFocus={() => { setAbierto(true); setBusqueda(""); }}
          onBlur={() => setAbierto(false)}
          onChange={(e) => setBusqueda(e.target.value)}
          disabled={disabled}
          autoComplete="off"
        />
        {valor && !disabled && (
          <button
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] leading-none"
            style={{ color: "rgba(200,200,204,0.4)" }}
            onMouseDown={(e) => { e.preventDefault(); onCambio(""); setBusqueda(""); }}
            tabIndex={-1}
          >
            ✕
          </button>
        )}
      </div>

      {abierto && (
        <div
          className="absolute z-50 w-full mt-1 rounded-xl overflow-y-auto max-h-52"
          style={{
            background: "var(--color-arce-surface-high)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {/* Opción vacía / deseleccionar */}
          <div
            className="px-3.5 py-2.5 text-[12px] cursor-pointer"
            style={{ color: "rgba(200,200,204,0.4)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            onClick={() => { onCambio(""); setBusqueda(""); setAbierto(false); }}
          >
            {vacioLabel}
          </div>

          {filtradas.length === 0 ? (
            <div className="px-3.5 py-3 text-[12px] text-center" style={{ color: "rgba(200,200,204,0.35)" }}>
              Sin resultados para &ldquo;{busqueda}&rdquo;
            </div>
          ) : (
            filtradas.map((o) => (
              <div
                key={o.value}
                className="px-3.5 py-2.5 text-[12px] cursor-pointer"
                style={{
                  color: o.value === valor ? "var(--color-arce-primary)" : "var(--color-arce-on-surface)",
                  background: o.value === valor ? "rgba(255,180,162,0.07)" : "transparent",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
                onMouseEnter={(e) => {
                  if (o.value !== valor)
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    o.value === valor ? "rgba(255,180,162,0.07)" : "transparent";
                }}
                onClick={() => { onCambio(o.value); setBusqueda(""); setAbierto(false); }}
              >
                <div className="truncate">{o.label}</div>
                {o.searchText && (
                  <div className="text-[10px] mt-0.5 truncate" style={{ color: "rgba(200,200,204,0.38)" }}>
                    {o.searchText}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── ModalMovimiento ─────────────────────────────────────────────────────────

function ModalMovimiento({
  modo, movimiento,
  opcionesPropietarios, opcionesInquilinos, opcionesPropiedades, opcionesContratos,
  onClose, onGuardar, onEliminar,
  guardando, eliminando, error,
}: {
  modo: "crear" | "editar";
  movimiento?: Movimiento;
  opcionesPropietarios: Opcion[];
  opcionesInquilinos: Opcion[];
  opcionesPropiedades: Opcion[];
  opcionesContratos: Opcion[];
  onClose: () => void;
  onGuardar: (datos: Record<string, string>) => void;
  onEliminar?: () => void;
  guardando: boolean;
  eliminando?: boolean;
  error: string | null;
}) {
  const [tipo, setTipo] = useState<"ingreso" | "egreso">(movimiento?.tipo ?? "ingreso");
  const [categoriaInput, setCategoriaInput] = useState(movimiento?.categoria ?? "");
  const [chipActivo, setChipActivo] = useState<string | null>(movimiento?.categoria ?? null);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [form, setForm] = useState({
    fecha:         movimiento?.fecha         ?? new Date().toISOString().split("T")[0],
    descripcion:   movimiento?.descripcion   ?? "",
    monto:         movimiento?.monto         ?? "",
    contratoId:    movimiento?.contratoId    ?? "",
    propietarioId: movimiento?.propietarioId ?? "",
    inquilinoId:   movimiento?.inquilinoId   ?? "",
    propiedadId:   movimiento?.propiedadId   ?? "",
    comprobante:   movimiento?.comprobante   ?? "",
    nota:          movimiento?.nota          ?? "",
  });

  function campo(k: keyof typeof form) {
    return {
      value: form[k],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm((prev) => ({ ...prev, [k]: e.target.value })),
    };
  }

  function handleGuardar() {
    onGuardar({
      fecha:         form.fecha,
      descripcion:   form.descripcion,
      tipo,
      monto:         form.monto,
      categoria:     categoriaInput,
      contratoId:    form.contratoId,
      propietarioId: form.propietarioId,
      inquilinoId:   form.inquilinoId,
      propiedadId:   form.propiedadId,
      comprobante:   form.comprobante,
      nota:          form.nota,
    });
  }

  const ocupado = guardando || (eliminando ?? false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(10,12,13,0.75)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-[540px] max-h-[90vh] overflow-y-auto rounded-2xl flex flex-col"
        style={{
          background: "var(--color-arce-surface)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderTop: "3px solid var(--color-arce-primary)",
        }}
      >
        {/* Cabecera */}
        <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <h2 className="text-[16px] font-bold" style={{ fontFamily: "var(--font-arce-headline)", color: "var(--color-arce-on-surface)" }}>
            {modo === "crear" ? "Nuevo movimiento" : "Editar movimiento"}
          </h2>
          <button className="text-lg p-1 rounded-md" style={{ color: "rgba(200,200,204,0.4)" }} onClick={onClose}>✕</button>
        </div>

        {/* Cuerpo */}
        <div className="p-6 flex flex-col gap-4">

          {/* Toggle tipo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "rgba(200,200,204,0.4)" }}>
              Tipo
            </label>
            <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              {(["ingreso", "egreso"] as const).map((t) => (
                <button
                  key={t}
                  className="flex-1 py-2 text-[12px] font-semibold capitalize transition-colors"
                  style={tipo === t
                    ? t === "ingreso"
                      ? { background: "var(--color-arce-primary-fixed)", color: "var(--color-arce-primary)" }
                      : { background: "var(--color-arce-error-container)", color: "var(--color-arce-error)" }
                    : { background: "var(--color-arce-surface-high)", color: "var(--color-arce-secondary-text)" }
                  }
                  onClick={() => setTipo(t)}
                  disabled={ocupado}
                >
                  {t === "ingreso" ? "↑ Ingreso" : "↓ Egreso"}
                </button>
              ))}
            </div>
          </div>

          {/* Descripción + Monto */}
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Descripción">
              <input className="campo-arce" placeholder="Ej: Reparación cañería" {...campo("descripcion")} disabled={ocupado} />
            </Campo>
            <Campo label="Monto $">
              <input className="campo-arce" type="number" min="0" step="0.01" placeholder="0,00" {...campo("monto")} disabled={ocupado} />
            </Campo>
          </div>

          {/* Fecha */}
          <Campo label="Fecha">
            <input className="campo-arce" type="date" {...campo("fecha")} disabled={ocupado} />
          </Campo>

          {/* Categoría + chips */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "rgba(200,200,204,0.4)" }}>
              Categoría <span className="font-normal normal-case tracking-normal">(opcional)</span>
            </label>
            <input
              className="campo-arce"
              placeholder="Ej: Plomería, Honorarios..."
              value={categoriaInput}
              onChange={(e) => { setCategoriaInput(e.target.value); setChipActivo(null); }}
              disabled={ocupado}
            />
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {CHIPS_CATEGORIA.map((chip) => (
                <button
                  key={chip}
                  className="px-2.5 py-1 text-[10px] font-semibold rounded-full transition-colors"
                  style={chipActivo === chip
                    ? { background: "var(--color-arce-primary-fixed)", color: "var(--color-arce-primary)", border: "1px solid rgba(255,180,162,0.2)" }
                    : { background: "var(--color-arce-surface-highest)", color: "var(--color-arce-secondary-text)", border: "1px solid rgba(255,255,255,0.07)" }
                  }
                  onClick={() => { setChipActivo(chip); setCategoriaInput(chip); }}
                  disabled={ocupado}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Sección vínculos */}
          <div className="flex flex-col gap-3 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] pt-2" style={{ color: "rgba(200,200,204,0.4)" }}>
              Vínculos <span className="font-normal normal-case tracking-normal">(todos opcionales)</span>
            </p>

            <Campo label="Contrato">
              <BuscadorSelector
                opciones={opcionesContratos}
                valor={form.contratoId}
                onCambio={(val) => setForm((p) => ({ ...p, contratoId: val }))}
                placeholder="Buscar por propiedad, propietario o inquilino..."
                vacioLabel="Sin contrato vinculado"
                disabled={ocupado}
              />
            </Campo>

            <Campo label="Propiedad">
              <BuscadorSelector
                opciones={opcionesPropiedades}
                valor={form.propiedadId}
                onCambio={(val) => setForm((p) => ({ ...p, propiedadId: val }))}
                placeholder="Buscar por dirección..."
                vacioLabel="Sin propiedad vinculada"
                disabled={ocupado}
              />
            </Campo>

            <div className="grid grid-cols-2 gap-3">
              <Campo label="Cliente — propietario">
                <BuscadorSelector
                  opciones={opcionesPropietarios}
                  valor={form.propietarioId}
                  onCambio={(val) => setForm((p) => ({ ...p, propietarioId: val }))}
                  placeholder="Buscar propietario..."
                  vacioLabel="Sin propietario vinculado"
                  disabled={ocupado}
                />
              </Campo>
              <Campo label="Cliente — inquilino">
                <BuscadorSelector
                  opciones={opcionesInquilinos}
                  valor={form.inquilinoId}
                  onCambio={(val) => setForm((p) => ({ ...p, inquilinoId: val }))}
                  placeholder="Buscar inquilino..."
                  vacioLabel="Sin inquilino vinculado"
                  disabled={ocupado}
                />
              </Campo>
            </div>
          </div>

          {/* Comprobante + Nota */}
          <Campo label="Comprobante" hint="(opcional)">
            <input className="campo-arce" placeholder="Factura B N°..., recibo, etc." {...campo("comprobante")} disabled={ocupado} />
          </Campo>
          <Campo label="Nota interna" hint="(no aparece en informes al cliente)">
            <input className="campo-arce" placeholder="Ej: autorizado por gerencia" {...campo("nota")} disabled={ocupado} />
          </Campo>

          {/* Error */}
          {error && (
            <div className="px-4 py-3 text-[12px] rounded-lg" style={{ background: "var(--color-arce-error-container)", color: "var(--color-arce-error)" }}>
              {error}
            </div>
          )}

          {/* Confirmación de eliminación (inline) */}
          {confirmandoEliminar && (
            <div
              className="px-4 py-4 rounded-xl flex flex-col gap-3"
              style={{ background: "var(--color-arce-error-container)", border: "1px solid rgba(220,50,50,0.2)" }}
            >
              <p className="text-[12px] font-semibold" style={{ color: "var(--color-arce-error)" }}>
                ¿Confirmar eliminación? Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-2">
                <button
                  className="flex-1 py-2 text-[12px] font-bold rounded-xl disabled:opacity-50"
                  style={{ background: "var(--color-arce-error)", color: "#fff" }}
                  onClick={() => onEliminar?.()}
                  disabled={eliminando}
                >
                  {eliminando ? "Eliminando..." : "Sí, eliminar"}
                </button>
                <button
                  className="flex-1 py-2 text-[12px] font-bold rounded-xl"
                  style={{ background: "var(--color-arce-surface-highest)", border: "1px solid rgba(255,255,255,0.07)", color: "var(--color-arce-secondary-text)" }}
                  onClick={() => setConfirmandoEliminar(false)}
                  disabled={eliminando}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-3.5 flex items-center justify-between rounded-b-2xl"
          style={{ background: "var(--color-arce-surface-container)", borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          {/* Botón eliminar — solo en modo editar y antes de confirmar */}
          <div>
            {modo === "editar" && !confirmandoEliminar && (
              <button
                className="px-3.5 py-1.5 text-[11px] font-bold rounded-xl"
                style={{ background: "transparent", border: "1px solid rgba(220,50,50,0.3)", color: "var(--color-arce-error)" }}
                onClick={() => setConfirmandoEliminar(true)}
                disabled={ocupado}
              >
                Eliminar
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              className="px-3.5 py-1.5 text-[11px] font-bold rounded-xl"
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.07)", color: "var(--color-arce-secondary-text)" }}
              onClick={onClose}
              disabled={ocupado}
            >
              Cancelar
            </button>
            <button
              className="px-3.5 py-1.5 text-[11px] font-bold rounded-xl disabled:opacity-50"
              style={{ background: "var(--color-arce-primary)", color: "var(--color-arce-on-primary)" }}
              onClick={handleGuardar}
              disabled={ocupado}
            >
              {guardando ? "Guardando..." : modo === "crear" ? "Guardar movimiento" : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Campo ────────────────────────────────────────────────────────────────────

function Campo({ label, hint, children }: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "rgba(200,200,204,0.4)" }}>
        {label}
        {hint && <span className="font-normal normal-case tracking-normal ml-1 text-[10px]">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
