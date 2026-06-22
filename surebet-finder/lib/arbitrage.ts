/**
 * Lógica central de arbitraje deportivo (surebets).
 *
 * Una "surebet" existe cuando la suma de las probabilidades implícitas
 * (1 / cuota) de TODOS los resultados posibles de un evento, tomando
 * la MEJOR cuota disponible para cada resultado entre distintas casas,
 * es menor que 1. Eso significa que puedes apostar a todos los resultados
 * y ganar dinero sin importar cuál ocurra.
 */

export interface OutcomeOdd {
  outcomeName: string;     // 'home' | 'draw' | 'away' o nombre del equipo
  bookmakerKey: string;    // 'bet365', 'betfair', etc.
  price: number;           // cuota decimal, ej 2.35
}

export interface StakeAllocation {
  outcomeName: string;
  bookmakerKey: string;
  price: number;
  stake: number;           // cuánto apostar en esta selección
  potentialReturn: number; // cuánto se recibe si gana esta selección
}

export interface ArbitrageResult {
  isSurebet: boolean;
  totalImpliedProbability: number; // suma de 1/cuota de la mejor combinación
  profitPercent: number;           // beneficio garantizado en %
  bestCombination: OutcomeOdd[];   // mejor cuota por cada resultado
  stakeAllocations: StakeAllocation[];
  totalStake: number;
  guaranteedReturn: number;
  guaranteedProfit: number;
}

/**
 * Dado un set de cuotas (puede haber varias casas ofreciendo cuota
 * para el mismo resultado), agrupa por resultado y se queda con la
 * mejor cuota de cada uno.
 */
function pickBestOddPerOutcome(odds: OutcomeOdd[]): OutcomeOdd[] {
  const bestByOutcome = new Map<string, OutcomeOdd>();

  for (const odd of odds) {
    const current = bestByOutcome.get(odd.outcomeName);
    if (!current || odd.price > current.price) {
      bestByOutcome.set(odd.outcomeName, odd);
    }
  }

  return Array.from(bestByOutcome.values());
}

/**
 * Calcula si existe arbitraje para un evento dado un conjunto de cuotas
 * (de distintas casas, mismo evento) y reparte el stake total de forma
 * que el beneficio sea idéntico sin importar qué resultado gane.
 */
export function calculateArbitrage(
  odds: OutcomeOdd[],
  totalStake: number = 100,
  minProfitPercent: number = 0
): ArbitrageResult {
  const bestCombination = pickBestOddPerOutcome(odds);

  const totalImpliedProbability = bestCombination.reduce(
    (sum, o) => sum + 1 / o.price,
    0
  );

  const profitPercent = (1 / totalImpliedProbability - 1) * 100;
  const isSurebet =
    totalImpliedProbability < 1 && profitPercent >= minProfitPercent;

  // Reparto proporcional del stake: stake_i = totalStake * (1/price_i) / sumaImplicita
  const stakeAllocations: StakeAllocation[] = bestCombination.map((o) => {
    const impliedProb = 1 / o.price;
    const stake = totalStake * (impliedProb / totalImpliedProbability);
    const potentialReturn = stake * o.price;
    return {
      outcomeName: o.outcomeName,
      bookmakerKey: o.bookmakerKey,
      price: o.price,
      stake: roundMoney(stake),
      potentialReturn: roundMoney(potentialReturn),
    };
  });

  const guaranteedReturn = stakeAllocations.length
    ? stakeAllocations[0].potentialReturn
    : 0; // en una surebet real, el retorno es igual para todas las selecciones
  const guaranteedProfit = guaranteedReturn - totalStake;

  return {
    isSurebet,
    totalImpliedProbability: roundMoney(totalImpliedProbability, 4),
    profitPercent: roundMoney(profitPercent, 2),
    bestCombination,
    stakeAllocations,
    totalStake,
    guaranteedReturn: roundMoney(guaranteedReturn),
    guaranteedProfit: roundMoney(guaranteedProfit),
  };
}

function roundMoney(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Valida que el conjunto de cuotas cubra TODOS los resultados posibles
 * del mercado (ej. para 1x2 necesitas home, draw y away; para mercado
 * de 2 vías solo home/away). Sin esto, "isSurebet" daría falsos positivos.
 */
export function hasCompleteMarket(
  odds: OutcomeOdd[],
  requiredOutcomes: string[]
): boolean {
  const present = new Set(odds.map((o) => o.outcomeName));
  return requiredOutcomes.every((req) => present.has(req));
}
