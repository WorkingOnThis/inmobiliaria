export function formatMonto(val: string | number): string {
  return "$ " + Number(val).toLocaleString("es-AR", { minimumFractionDigits: 2 });
}

export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatPeriodo(p: string | null | undefined): string | null {
  if (!p) return null;
  const [year, month] = p.split("-");
  const nombres = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${nombres[parseInt(month) - 1]} ${year}`;
}

export function montoEnLetras(monto: number): string {
  if (!isFinite(monto)) return "—";
  const enLetras = (n: number): string => {
    const uni = ["","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve","diez","once","doce","trece","catorce","quince","dieciséis","diecisiete","dieciocho","diecinueve","veinte"];
    const dec = ["","","veinti","treinta","cuarenta","cincuenta","sesenta","setenta","ochenta","noventa"];
    const cen = ["","ciento","doscientos","trescientos","cuatrocientos","quinientos","seiscientos","setecientos","ochocientos","novecientos"];
    if (n === 0) return "cero";
    if (n === 100) return "cien";
    if (n <= 20) return uni[n];
    if (n < 100) { const d2 = Math.floor(n/10); const u = n%10; return d2===2&&u>0?`veinti${uni[u]}`:u===0?dec[d2]:`${dec[d2]} y ${uni[u]}`; }
    if (n < 1000) { const c = Math.floor(n/100); const r = n%100; return r===0?cen[c]:`${cen[c]} ${enLetras(r)}`; }
    if (n < 1000000) { const mil = Math.floor(n/1000); const r = n%1000; const ms = mil===1?"mil":`${enLetras(mil)} mil`; return r===0?ms:`${ms} ${enLetras(r)}`; }
    return n.toString();
  };
  const entero = Math.floor(monto);
  const cts = Math.round((monto - entero) * 100);
  return enLetras(entero).toUpperCase() + (cts > 0 ? ` CON ${String(cts).padStart(2,"0")}/100 PESOS` : " PESOS");
}

export function agencyDisplayName(agency: { legalName?: string | null; tradeName?: string | null; name?: string | null } | null | undefined, fallback = "Arce Administración"): string {
  return agency?.legalName || agency?.tradeName || agency?.name || fallback;
}

export function parseTrustedEmails(raw: string | null | undefined): { email: string; label?: string; sendDefault: boolean }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
