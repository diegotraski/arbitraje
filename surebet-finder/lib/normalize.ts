import stringSimilarity from "string-similarity";

/**
 * Distintas casas de apuestas escriben los nombres de equipos de forma
 * distinta (acentos, abreviaturas, "FC", etc.). Esto normaliza texto
 * para poder comparar y agrupar el mismo partido entre fuentes distintas.
 */
export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/\b(fc|cf|club|ud|cd|sad)\b/g, "") // quita sufijos/prefijos comunes
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildEventKey(home: string, away: string): string {
  return `${normalizeTeamName(home)}__vs__${normalizeTeamName(away)}`;
}

/**
 * Cuando dos eventos de fuentes distintas no tienen exactamente el mismo
 * texto, usamos similitud de strings para decidir si son el mismo partido.
 * Útil porque "Real Madrid CF" vs "Real Madrid" deben matchear.
 */
export function isLikelySameEvent(
  homeA: string,
  awayA: string,
  homeB: string,
  awayB: string,
  threshold: number = 0.75
): boolean {
  const homeSim = stringSimilarity.compareTwoStrings(
    normalizeTeamName(homeA),
    normalizeTeamName(homeB)
  );
  const awaySim = stringSimilarity.compareTwoStrings(
    normalizeTeamName(awayA),
    normalizeTeamName(awayB)
  );
  return homeSim >= threshold && awaySim >= threshold;
}
