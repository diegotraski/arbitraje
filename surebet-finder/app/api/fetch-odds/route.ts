import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { theOddsApiProvider } from "@/app/api/providers/theoddsapi";
import { betfairProvider } from "@/app/api/providers/betfair";
import { RawOddsEvent } from "@/app/api/providers/types";
import { buildEventKey, isLikelySameEvent } from "@/lib/normalize";
import { calculateArbitrage, hasCompleteMarket, OutcomeOdd } from "@/lib/arbitrage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron llama con la cabecera "Authorization: Bearer <CRON_SECRET>"
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // si no configuras secreto, no bloqueamos (solo recomendado en dev)
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const totalStake = Number(process.env.TOTAL_STAKE || 100);
  const minProfitPercent = Number(process.env.MIN_PROFIT_PERCENT || 1);

  try {
    // 1. Obtener cuotas de todos los proveedores configurados
    const allRawEvents: RawOddsEvent[] = [];
    const providers = [theOddsApiProvider, betfairProvider];

    for (const provider of providers) {
      try {
        const events = await provider.fetchOdds();
        allRawEvents.push(...events);
      } catch (err) {
        console.error(`Error en proveedor ${provider.key}:`, err);
      }
    }

    if (allRawEvents.length === 0) {
      return NextResponse.json({
        message: "No se obtuvieron cuotas de ningún proveedor",
        surebetsFound: 0,
      });
    }

    // 2. Agrupar eventos equivalentes entre proveedores distintos
    const groups = groupEquivalentEvents(allRawEvents);

    let surebetsFound = 0;
    const surebetsSummary: any[] = [];

    for (const group of groups) {
      const [first] = group;

      // Guardar/actualizar el evento normalizado en Supabase
      const eventKey = buildEventKey(first.homeTeam, first.awayTeam);
      const { data: eventRow, error: eventError } = await supabaseAdmin
        .from("events")
        .upsert(
          {
            sport_key: first.sportKey,
            normalized_name: eventKey,
            home_team: first.homeTeam,
            away_team: first.awayTeam,
            commence_time: first.commenceTime,
          },
          { onConflict: "sport_key,normalized_name,commence_time" }
        )
        .select()
        .single();

      if (eventError || !eventRow) {
        console.error("Error guardando evento:", eventError);
        continue;
      }

      // Aplanar todas las cuotas de todas las casas para este evento
      const flatOdds: OutcomeOdd[] = [];
      const oddsRowsToInsert: any[] = [];

      for (const rawEvent of group) {
        for (const outcome of rawEvent.outcomes) {
          flatOdds.push({
            outcomeName: outcome.name,
            bookmakerKey: rawEvent.bookmakerKey,
            price: outcome.price,
          });
          oddsRowsToInsert.push({
            event_id: eventRow.id,
            bookmaker_key: normalizeBookmakerKey(rawEvent.bookmakerKey),
            market: rawEvent.market,
            outcome_name: outcome.name,
            price: outcome.price,
          });
        }
      }

      if (oddsRowsToInsert.length > 0) {
        await supabaseAdmin.from("odds").insert(oddsRowsToInsert);
      }

      // 3. Calcular arbitraje. Soportamos 2 vías (home/away) y 3 vías (home/draw/away)
      const is3Way = first.market === "h2h_3way";
      const requiredOutcomes = is3Way
        ? ["home", "draw", "away"]
        : ["home", "away"];

      if (!hasCompleteMarket(flatOdds, requiredOutcomes)) continue;

      const result = calculateArbitrage(flatOdds, totalStake, minProfitPercent);

      if (result.isSurebet) {
        surebetsFound++;
        await supabaseAdmin.from("surebets").insert({
          event_id: eventRow.id,
          market: first.market,
          profit_percent: result.profitPercent,
          details: result,
          is_active: true,
        });

        surebetsSummary.push({
          match: `${first.homeTeam} vs ${first.awayTeam}`,
          profitPercent: result.profitPercent,
          stakes: result.stakeAllocations,
        });
      }
    }

    return NextResponse.json({
      message: "Análisis completado",
      eventsAnalyzed: groups.length,
      surebetsFound,
      surebets: surebetsSummary,
    });
  } catch (err: any) {
    console.error("Error en /api/fetch-odds:", err);
    return NextResponse.json(
      { error: err.message || "Error desconocido" },
      { status: 500 }
    );
  }
}

/**
 * Agrupa eventos de distintos proveedores que representan el mismo
 * partido real (mismo home/away, aunque el texto varíe un poco).
 */
function groupEquivalentEvents(events: RawOddsEvent[]): RawOddsEvent[][] {
  const groups: RawOddsEvent[][] = [];

  for (const event of events) {
    const existingGroup = groups.find((group) =>
      isLikelySameEvent(
        group[0].homeTeam,
        group[0].awayTeam,
        event.homeTeam,
        event.awayTeam
      )
    );

    if (existingGroup) {
      existingGroup.push(event);
    } else {
      groups.push([event]);
    }
  }

  return groups;
}

function normalizeBookmakerKey(rawKey: string): string {
  const map: Record<string, string> = {
    bet365: "bet365",
    william_hill: "william_hill",
    betway: "betway",
    betfair_ex_uk: "betfair",
    betfair: "betfair",
    winamax_fr: "winamax",
  };
  return map[rawKey] || rawKey;
}
