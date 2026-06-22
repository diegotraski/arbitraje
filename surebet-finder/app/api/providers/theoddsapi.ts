import { OddsProvider, RawOddsEvent } from "./types";

/**
 * The Odds API (https://the-odds-api.com) es un agregador LEGAL de cuotas
 * que licencia los datos directamente de las casas de apuestas (no hace
 * scraping). Tiene plan gratuito (500 requests/mes) y entre sus bookmakers
 * soportados en regiones UK/EU están: bet365, William Hill, Betway, Betfair,
 * Unibet, etc. La disponibilidad exacta de cada casa depende del deporte
 * y la región — consulta siempre:
 * https://the-odds-api.com/sports-odds-data/bookmaker-apis.html
 *
 * Winamax (Francia) tiene cobertura limitada en este agregador; si no
 * aparece, considera contratar un proveedor de datos específico para
 * el mercado francés (ej. OddsJam, Sportmonks) o usar su propia web
 * pública de forma manual/puntual respetando sus términos de uso.
 */

const BOOKMAKER_MAP: Record<string, string> = {
  bet365: "bet365",
  williamhill: "william_hill",
  betway: "betway",
  betfair: "betfair_ex_uk",
  winamax: "winamax_fr",
};

export const theOddsApiProvider: OddsProvider = {
  key: "the_odds_api",
  name: "The Odds API",

  async fetchOdds(): Promise<RawOddsEvent[]> {
    const apiKey = process.env.ODDS_API_KEY;
    const regions = process.env.ODDS_API_REGIONS || "uk,eu";
    const sport = process.env.ODDS_API_SPORT || "soccer_epl";

    if (!apiKey) {
      console.warn("[theOddsApiProvider] Falta ODDS_API_KEY en variables de entorno");
      return [];
    }

    const wantedBookmakers = Object.values(BOOKMAKER_MAP).join(",");

    const url = new URL(
      `https://api.the-odds-api.com/v4/sports/${sport}/odds`
    );
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("regions", regions);
    url.searchParams.set("markets", "h2h");
    url.searchParams.set("oddsFormat", "decimal");
    url.searchParams.set("bookmakers", wantedBookmakers);

    const res = await fetch(url.toString());

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `The Odds API respondió ${res.status}: ${text.slice(0, 300)}`
      );
    }

    const data = await res.json();
    const events: RawOddsEvent[] = [];

    for (const match of data) {
      for (const bookmaker of match.bookmakers || []) {
        const h2hMarket = bookmaker.markets?.find(
          (m: any) => m.key === "h2h"
        );
        if (!h2hMarket) continue;

        events.push({
          sportKey: sport,
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          commenceTime: match.commence_time,
          bookmakerKey: bookmaker.key,
          market: h2hMarket.outcomes.length === 3 ? "h2h_3way" : "h2h",
          outcomes: h2hMarket.outcomes.map((o: any) => ({
            name: mapOutcomeName(o.name, match.home_team, match.away_team),
            price: o.price,
          })),
        });
      }
    }

    return events;
  },
};

function mapOutcomeName(
  rawName: string,
  homeTeam: string,
  awayTeam: string
): string {
  if (rawName === "Draw") return "draw";
  if (rawName === homeTeam) return "home";
  if (rawName === awayTeam) return "away";
  return rawName;
}
