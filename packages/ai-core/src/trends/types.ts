import type { DailyTrendSnapshot, TrendPlatformKey } from "@clipmanager/shared";

// Ri-esportato (non ridefinito) da @clipmanager/shared: TREND_PLATFORMS è la
// fonte unica dell'elenco piattaforme, condivisa anche da
// apps/api/src/routes/trends.ts e apps/worker/src/processors/trendRefresh.ts.
export type { TrendPlatformKey };

export interface TrendFetchInput {
  platform: TrendPlatformKey;
  /** Data per cui si richiede lo snapshot (di norma "oggi"), usata dai provider per cache/idempotenza. */
  date: Date;
}

export interface TrendProvider {
  readonly name: string;
  supports(input: TrendFetchInput): boolean;
  fetchTrends(input: TrendFetchInput): Promise<DailyTrendSnapshot>;
}
