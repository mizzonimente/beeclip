import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { TrendProvider, TrendFetchInput } from "./types.js";
import { LicensedTrendProvider } from "./licensedTrendProvider.js";
import { CuratedFeedTrendProvider } from "./curatedFeedProvider.js";
import { MockTrendProvider } from "./mockProvider.js";

export * from "./types.js";
export { LicensedTrendProvider } from "./licensedTrendProvider.js";
export { CuratedFeedTrendProvider } from "./curatedFeedProvider.js";
export { MockTrendProvider } from "./mockProvider.js";
export { buildContentIdeas } from "./contentIdeas.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CURATED_PATH = resolve(__dirname, "curated-feed.example.json");

export function createTrendResolver(env: {
  TREND_DATA_PROVIDER?: string;
  TREND_DATA_PROVIDER_API_KEY?: string;
  TREND_CURATED_FEED_PATH?: string;
  TREND_CURATED_MAX_AGE_DAYS?: string;
}) {
  const providers: TrendProvider[] = [
    ...(env.TREND_DATA_PROVIDER === "licensed_provider"
      ? [new LicensedTrendProvider(env.TREND_DATA_PROVIDER_API_KEY, undefined)]
      : []),
    ...(env.TREND_DATA_PROVIDER === "curated" || !env.TREND_DATA_PROVIDER
      ? [
          new CuratedFeedTrendProvider(
            env.TREND_CURATED_FEED_PATH ?? DEFAULT_CURATED_PATH,
            env.TREND_CURATED_MAX_AGE_DAYS ? Number(env.TREND_CURATED_MAX_AGE_DAYS) : 14
          ),
        ]
      : []),
    new MockTrendProvider(),
  ];

  return {
    async fetch(input: TrendFetchInput) {
      for (const provider of providers) {
        if (!provider.supports(input)) continue;
        try {
          const snapshot = await provider.fetchTrends(input);
          return { snapshot, sourceProvider: provider.name };
        } catch {
          continue; // prova il provider successivo nella catena
        }
      }
      throw new Error("Nessun trend provider disponibile (nemmeno il mock, controlla la configurazione).");
    },
  };
}
