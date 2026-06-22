import SurebetTable from "@/components/SurebetTable";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getSurebets() {
  const { data, error } = await supabaseAdmin
    .from("surebets")
    .select(
      `
      id,
      profit_percent,
      market,
      detected_at,
      details,
      events ( home_team, away_team, commence_time, sport_key )
    `
    )
    .eq("is_active", true)
    .order("detected_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

export default async function Home() {
  const surebets = await getSurebets();

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-1">🎯 Surebet Finder</h1>
        <p className="text-gray-400">
          Arbitraje deportivo entre Bet365, William Hill, Betway, Betfair y
          Winamax (según disponibilidad de datos)
        </p>
      </header>

      <SurebetTable surebets={surebets as any} />

      <footer className="mt-12 text-xs text-gray-500 border-t border-white/10 pt-4">
        <p>
          ⚠️ El arbitraje deportivo puede infringir los términos de uso de
          algunas casas de apuestas y suelen limitar cuentas que lo
          practican. Verifica la legalidad en tu jurisdicción antes de
          apostar dinero real. Esta herramienta es solo informativa.
        </p>
      </footer>
    </main>
  );
}
