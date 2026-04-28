const ORDINALES: string[] = [
  "",
  "primera", "segunda", "tercera", "cuarta", "quinta",
  "sexta", "séptima", "octava", "novena", "décima",
  "undécima", "duodécima", "decimotercera", "decimocuarta", "decimoquinta",
  "decimosexta", "decimoséptima", "decimoctava", "decimonovena", "vigésima",
  "vigésima primera", "vigésima segunda", "vigésima tercera", "vigésima cuarta",
  "vigésima quinta", "vigésima sexta", "vigésima séptima", "vigésima octava",
  "vigésima novena", "trigésima",
];

export function ordinalClause(n: number): string {
  if (n >= 1 && n < ORDINALES.length) return ORDINALES[n];
  return `${n}°`;
}

export function clauseHeading(position: number, title: string): string {
  return `CLÁUSULA ${ordinalClause(position).toUpperCase()} — ${title.toUpperCase()}`;
}
