"use client";

interface StakeAllocation {
  outcomeName: string;
  bookmakerKey: string;
  price: number;
  stake: number;
  potentialReturn: number;
}

interface Surebet {
  id: string;
  profit_percent: number;
  market: string;
  detected_at: string;
  details: { stakeAllocations: StakeAllocation[]; totalStake: number };
  events: {
    home_team: string;
    away_team: string;
    commence_time: string;
    sport_key: string;
  } | null;
}

const BOOKMAKER_LABELS: Record<string, string> = {
  bet365: "Bet365",
  william_hill: "William Hill",
  betway: "Betway",
  betfair: "Betfair",
  winamax: "Winamax",
};

export default function SurebetTable({ surebets }: { surebets: Surebet[] }) {
  if (surebets.length === 0) {
    return (
      <div className="text-center text-gray-400 py-16">
        No hay surebets activas en este momento. El sistema revisa
        automáticamente cada 30 minutos.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {surebets.map((sb) => (
        <div
          key={sb.id}
          className="bg-white/5 border border-white/10 rounded-xl p-5"
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-lg font-semibold">
                {sb.events?.home_team} vs {sb.events?.away_team}
              </h3>
              <p className="text-sm text-gray-400">
                {sb.events?.commence_time
                  ? new Date(sb.events.commence_time).toLocaleString("es-ES")
                  : ""}
              </p>
            </div>
            <span className="bg-surebet-green/20 text-surebet-green font-bold px-3 py-1 rounded-full text-sm">
              +{sb.profit_percent}% beneficio
            </span>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left">
                <th className="py-1">Resultado</th>
                <th className="py-1">Casa</th>
                <th className="py-1">Cuota</th>
                <th className="py-1">Apostar</th>
                <th className="py-1">Retorno si gana</th>
              </tr>
            </thead>
            <tbody>
              {sb.details.stakeAllocations.map((s, i) => (
                <tr key={i} className="border-t border-white/10">
                  <td className="py-2 capitalize">{s.outcomeName}</td>
                  <td className="py-2">
                    {BOOKMAKER_LABELS[s.bookmakerKey] || s.bookmakerKey}
                  </td>
                  <td className="py-2">{s.price}</td>
                  <td className="py-2">{s.stake.toFixed(2)} €</td>
                  <td className="py-2">{s.potentialReturn.toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
