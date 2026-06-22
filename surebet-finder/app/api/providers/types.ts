export interface RawOddsEvent {
  sportKey: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string; // ISO date
  bookmakerKey: string;
  market: "h2h" | "h2h_3way";
  outcomes: { name: string; price: number }[];
}

export interface OddsProvider {
  key: string;
  name: string;
  fetchOdds(): Promise<RawOddsEvent[]>;
}
