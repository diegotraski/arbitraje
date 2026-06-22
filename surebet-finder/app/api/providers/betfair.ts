import { OddsProvider, RawOddsEvent } from "./types";

/**
 * Betfair tiene una API oficial y gratuita para uso personal/bajo volumen:
 * https://developer.betfair.com/
 *
 * Pasos para activarla (resumen, hazlo una vez fuera de este código):
 * 1. Crea una cuenta de aplicación en developer.betfair.com -> obtienes
 *    un "Application Key" (APP_KEY).
 * 2. El login interactivo de Betfair requiere "certificate login" (mTLS)
 *    para apps que no son del marketplace oficial. Para producción real
 *    necesitarás generar un certificado .pem/.key y subir el .crt a tu
 *    cuenta de Betfair. Aquí se deja el flujo de "interactive login"
 *    (sesiones cortas, válido sobre todo para pruebas/desarrollo).
 *
 * Este archivo implementa el flujo completo: login -> listEvents ->
 * listMarketCatalogue -> listMarketBook (cuotas back/lay del mercado 1x2).
 */

const IDENTITY_URL = "https://identitysso.betfair.com/api/login";
const BETTING_URL = "https://api.betfair.com/exchange/betting/rest/v1.0";

let cachedSessionToken: { token: string; expiresAt: number } | null = null;

async function login(): Promise<string> {
  if (cachedSessionToken && cachedSessionToken.expiresAt > Date.now()) {
    return cachedSessionToken.token;
  }

  const appKey = process.env.BETFAIR_APP_KEY;
  const username = process.env.BETFAIR_USERNAME;
  const password = process.env.BETFAIR_PASSWORD;

  if (!appKey || !username || !password) {
    throw new Error(
      "Faltan BETFAIR_APP_KEY, BETFAIR_USERNAME o BETFAIR_PASSWORD"
    );
  }

  const res = await fetch(IDENTITY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "X-Application": appKey,
    },
    body: new URLSearchParams({ username, password }).toString(),
  });

  const data = await res.json();

  if (data.status !== "SUCCESS") {
    throw new Error(
      `Login Betfair falló: ${data.status} - ${data.error || "sin detalle"}`
    );
  }

  // Las sesiones interactivas de Betfair duran unas horas; cacheamos 20 min
  cachedSessionToken = {
    token: data.token,
    expiresAt: Date.now() + 20 * 60 * 1000,
  };

  return data.token;
}

async function bettingRequest(method: string, params: Record<string, any>) {
  const appKey = process.env.BETFAIR_APP_KEY as string;
  const sessionToken = await login();

  const res = await fetch(`${BETTING_URL}/${method}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Application": appKey,
      "X-Authentication": sessionToken,
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Betfair ${method} respondió ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.json();
}

export const betfairProvider: OddsProvider = {
  key: "betfair",
  name: "Betfair Exchange",

  async fetchOdds(): Promise<RawOddsEvent[]> {
    if (!process.env.BETFAIR_APP_KEY) {
      console.warn("[betfairProvider] Falta BETFAIR_APP_KEY, se omite Betfair");
      return [];
    }

    try {
      // 1. Buscamos mercados de fútbol (Match Odds) que empiecen en las próximas 24h
      const catalogue = await bettingRequest("listMarketCatalogue", {
        filter: {
          eventTypeIds: ["1"], // 1 = Football en Betfair
          marketTypeCodes: ["MATCH_ODDS"],
          marketStartTime: {
            from: new Date().toISOString(),
            to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
        },
        maxResults: "50",
        marketProjection: ["EVENT", "RUNNER_DESCRIPTION"],
      });

      const marketIds = catalogue.map((m: any) => m.marketId);
      if (marketIds.length === 0) return [];

      // 2. Pedimos las mejores cuotas (back prices) de esos mercados
      const books = await bettingRequest("listMarketBook", {
        marketIds,
        priceProjection: { priceData: ["EX_BEST_OFFERS"] },
      });

      const events: RawOddsEvent[] = [];

      for (const market of catalogue) {
        const book = books.find((b: any) => b.marketId === market.marketId);
        if (!book) continue;

        const [homeTeam, awayTeam] = parseEventName(market.event.name);

        const outcomes = market.runners.map((runner: any) => {
          const runnerBook = book.runners.find(
            (r: any) => r.selectionId === runner.selectionId
          );
          const bestBack =
            runnerBook?.ex?.availableToBack?.[0]?.price || null;

          let outcomeName = runner.runnerName;
          if (runner.runnerName === homeTeam) outcomeName = "home";
          else if (runner.runnerName === awayTeam) outcomeName = "away";
          else if (runner.runnerName.toLowerCase() === "the draw")
            outcomeName = "draw";

          return { name: outcomeName, price: bestBack };
        }).filter((o: any) => o.price);

        if (outcomes.length > 0) {
          events.push({
            sportKey: "soccer",
            homeTeam,
            awayTeam,
            commenceTime: market.event.openDate,
            bookmakerKey: "betfair",
            market: outcomes.length === 3 ? "h2h_3way" : "h2h",
            outcomes,
          });
        }
      }

      return events;
    } catch (err) {
      console.error("[betfairProvider] Error obteniendo cuotas:", err);
      return [];
    }
  },
};

function parseEventName(eventName: string): [string, string] {
  const parts = eventName.split(" v ");
  if (parts.length === 2) return [parts[0].trim(), parts[1].trim()];
  return [eventName, ""];
}
