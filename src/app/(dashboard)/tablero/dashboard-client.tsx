"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth/hooks";

// ── Tipos ──────────────────────────────────────────────────────────────────

type TrendDir = "up" | "down" | "neutral";
type AlertaTipo = "mora" | "vence" | "servicio" | "icl" | "ok";
type SemaforoColor = "red" | "yellow" | "green" | "gray";
type TareaOrigen = "auto" | "manual" | "onboarding";
type TareaPrioridad = "urgent" | "high" | "medium";

interface KPIData {
  salud: { valor: number; alertas: number; tendencia: string; dir: TrendDir };
  activas: {
    valor: number;
    vacantes: number;
    captacion: number;
    tendencia: string;
    dir: TrendDir;
  };
  mora: { contratos: number; monto: number; variacion: string; dir: TrendDir };
  vencen: {
    contratos: number;
    menos30: number;
    entre30y60: number;
    tendencia: string;
    dir: TrendDir;
  };
}

interface PropiedadRow {
  id: string;
  nombre: string;
  direccion: string;
  semaforo: SemaforoColor;
  inquilino: string;
  alertas: { tipo: AlertaTipo; detalle: string }[];
  vtoContrato: string;
  vtoProximo: boolean;
  ultimoCobro: string;
}

interface PortfolioData {
  total: number;
  propiedades: PropiedadRow[];
}

interface TareaItem {
  id: string;
  titulo: string;
  propiedad: string;
  fecha: string;
  prioridad: TareaPrioridad;
  origen: TareaOrigen;
}

interface TareasData {
  total: number;
  items: TareaItem[];
}

interface MoraItem {
  id: string;
  iniciales: string;
  nombre: string;
  propiedad: string;
  contrato: string;
  monto: number;
  dias: number;
}

interface MoraData {
  total: number;
  monto_total: number;
  items: MoraItem[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getGreeting(hour: number): string {
  if (hour >= 6 && hour <= 12) return "Buen día";
  if (hour >= 13 && hour <= 19) return "Buenas tardes";
  return "Buenas noches";
}

function formatARS(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function getISOWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
}

// ── Componente principal ───────────────────────────────────────────────────

export default function DashboardClient() {
  const { session } = useSession();

  const [greeting, setGreeting] = useState("Buen día");
  const [dateStr, setDateStr] = useState("");
  const [weekStr, setWeekStr] = useState("");

  useEffect(() => {
    const now = new Date();
    setGreeting(getGreeting(now.getHours()));

    const dayNames = [
      "Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado",
    ];
    const monthNames = [
      "enero","febrero","marzo","abril","mayo","junio",
      "julio","agosto","septiembre","octubre","noviembre","diciembre",
    ];
    setDateStr(
      `${dayNames[now.getDay()]} ${now.getDate()} de ${monthNames[now.getMonth()]}, ${now.getFullYear()}`
    );
    setWeekStr(`Semana ${getISOWeek(now)} del año`);
  }, []);

  const { data: kpis } = useQuery<KPIData>({
    queryKey: ["dashboard-summary"],
    queryFn: () => fetch("/api/dashboard/summary").then((r) => r.json()),
  });

  const { data: portfolio } = useQuery<PortfolioData>({
    queryKey: ["dashboard-portfolio"],
    queryFn: () => fetch("/api/dashboard/portfolio").then((r) => r.json()),
  });

  const { data: tareas } = useQuery<TareasData>({
    queryKey: ["tareas-urgentes"],
    queryFn: () =>
      fetch("/api/tasks?prioridad=urgent&limit=5").then((r) => r.json()),
  });

  const { data: mora } = useQuery<MoraData>({
    queryKey: ["arrears-active"],
    queryFn: () => fetch("/api/arrears/active").then((r) => r.json()),
  });

  const firstName = (session?.user?.name ?? "—").split(" ")[0];

  return (
    <div
      style={{
        padding: "28px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        flex: 1,
        overflowY: "auto",
      }}
    >
      {/* ── PAGE HEADER ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {greeting}, {firstName} 👋
          </h1>
          <p className="page-subtitle">
            Resumen general del portfolio — actualizado hoy a las 00:00hs
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-secondary btn-sm">
              + Nueva propiedad
            </button>
            <button className="btn btn-primary btn-sm">
              + Nueva reserva
            </button>
          </div>
          <div className="page-meta">
            <strong>{dateStr}</strong>
            <br />
            {weekStr}
          </div>
        </div>
      </div>

      {/* ── KPI GRID ── */}
      <div className="kpi-grid">
        {/* Salud del portfolio — mustard (único uso en esta vista) */}
        <div className="kpi-card mustard">
          <div className="kpi-label">Salud del portfolio</div>
          <div className="kpi-value">{kpis?.salud.valor ?? "—"}%</div>
          <div className="kpi-sub">
            {kpis?.salud.alertas ?? "—"} propiedades con alertas activas
          </div>
          <div className={`kpi-trend ${kpis?.salud.dir ?? "neutral"}`}>
            {kpis?.salud.tendencia}
          </div>
        </div>

        {/* Propiedades activas — neutral */}
        <div className="kpi-card neutral">
          <div className="kpi-label">Propiedades activas</div>
          <div className="kpi-value">{kpis?.activas.valor ?? "—"}</div>
          <div className="kpi-sub">
            {kpis?.activas.vacantes ?? "—"} vacantes ·{" "}
            {kpis?.activas.captacion ?? "—"} en captación
          </div>
          <div className={`kpi-trend ${kpis?.activas.dir ?? "neutral"}`}>
            {kpis?.activas.tendencia}
          </div>
        </div>

        {/* En mora activa — error */}
        <div className="kpi-card error">
          <div className="kpi-label">En mora activa</div>
          <div className="kpi-value">{kpis?.mora.contratos ?? "—"}</div>
          <div className="kpi-sub">
            {kpis ? formatARS(kpis.mora.monto) : "—"} adeudados en total
          </div>
          <div className={`kpi-trend ${kpis?.mora.dir ?? "neutral"}`}>
            {kpis?.mora.variacion}
          </div>
        </div>

        {/* Contratos por vencer — primary */}
        <div className="kpi-card primary">
          <div className="kpi-label">Contratos por vencer</div>
          <div className="kpi-value">{kpis?.vencen.contratos ?? "—"}</div>
          <div className="kpi-sub">
            {kpis?.vencen.menos30 ?? "—"} en &lt; 30 días ·{" "}
            {kpis?.vencen.entre30y60 ?? "—"} entre 30–60 días
          </div>
          <div className={`kpi-trend ${kpis?.vencen.dir ?? "neutral"}`}>
            {kpis?.vencen.tendencia}
          </div>
        </div>
      </div>

      {/* ── DOS COLUMNAS ── */}
      <div className="dashboard-cols">

        {/* ── IZQUIERDA: PORTFOLIO ── */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">Portfolio de propiedades</div>
              <div className="panel-subtitle">
                {portfolio?.total ?? "—"} activas · ordenadas por severidad de
                alertas
              </div>
            </div>
            <div className="panel-actions">
              <button className="btn btn-ghost btn-sm">Filtrar</button>
              <button className="btn btn-secondary btn-sm">Ver todas →</button>
            </div>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "260px" }}>Propiedad</th>
                <th>Inquilino</th>
                <th>Alertas activas</th>
                <th>Vto. contrato</th>
                <th>Último cobro</th>
              </tr>
            </thead>
            <tbody>
              {portfolio?.propiedades.map((prop) => (
                <tr key={prop.id} style={{ cursor: "pointer" }}>
                  <td>
                    <div className="prop-status">
                      <div className={`status-dot ${prop.semaforo}`} />
                      <div>
                        <div className="prop-name">{prop.nombre}</div>
                        <div className="prop-address">{prop.direccion}</div>
                      </div>
                    </div>
                  </td>
                  <td>{prop.inquilino}</td>
                  <td>
                    {prop.alertas.map((a, i) => (
                      <span key={i} className={`alert-tag ${a.tipo}`}>
                        {a.detalle}
                      </span>
                    ))}
                  </td>
                  <td className={prop.vtoProximo ? "cell-expiring" : undefined}>
                    {prop.vtoContrato}
                  </td>
                  <td>{prop.ultimoCobro}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="panel-footer">
            <a href="/propiedades">
              Ver las {portfolio?.total ?? "—"} propiedades →
            </a>
          </div>
        </div>

        {/* ── DERECHA: TAREAS + MORA ── */}
        <div className="right-col">

          {/* PANEL: TAREAS URGENTES */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Tareas urgentes</div>
                <div className="panel-subtitle">Top 5 · asignadas a vos</div>
              </div>
              <div className="panel-actions">
                <button className="btn btn-secondary btn-sm">
                  + Nueva tarea
                </button>
              </div>
            </div>

            <div className="tarea-list">
              {tareas?.items.map((t) => (
                <div key={t.id} className="tarea-item">
                  <div className={`tarea-origin-dot ${t.origen}`} />
                  <div className="tarea-body">
                    <div className="tarea-titulo">{t.titulo}</div>
                    <div className="tarea-meta">
                      <div className="tarea-propiedad">{t.propiedad}</div>
                      <div className="tarea-fecha">{t.fecha}</div>
                    </div>
                  </div>
                  <div className={`tarea-prioridad ${t.prioridad}`}>
                    {t.prioridad.charAt(0).toUpperCase() +
                      t.prioridad.slice(1)}
                  </div>
                </div>
              ))}
            </div>

            <div className="panel-footer">
              <a href="/tareas">
                Ver las {tareas?.total ?? "—"} tareas pendientes →
              </a>
            </div>
          </div>

          {/* PANEL: MORA ACTIVA */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Mora activa</div>
                <div className="panel-subtitle">
                  {mora?.total ?? "—"} contratos ·{" "}
                  {mora ? formatARS(mora.monto_total) : "—"} total
                </div>
              </div>
              <div className="panel-actions">
                <button className="btn btn-ghost btn-sm">Ver todas →</button>
              </div>
            </div>

            <div className="mora-list">
              {mora?.items.map((m) => (
                <div key={m.id} className="mora-item">
                  <div className="mora-avatar">{m.iniciales}</div>
                  <div className="mora-info">
                    <div className="mora-nombre">{m.nombre}</div>
                    <div className="mora-prop">
                      {m.propiedad} · {m.contrato}
                    </div>
                  </div>
                  <div className="mora-right">
                    <div className="mora-monto">{formatARS(m.monto)}</div>
                    <div className="mora-dias">{m.dias} días en mora</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
