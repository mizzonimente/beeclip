import type { TrendProvider, TrendFetchInput } from "./types.js";
import type { DailyTrendSnapshot } from "@clipmanager/shared";

/** Fallback universale, usato quando ne' un provider con licenza ne' un
 *  feed curato sono configurati/disponibili. Dati chiaramente etichettati
 *  come esempio: la UI deve mostrare "dati di esempio" quando source=MOCK. */
export class MockTrendProvider implements TrendProvider {
  readonly name = "mock";

  supports(): boolean {
    return true;
  }

  async fetchTrends(input: TrendFetchInput): Promise<DailyTrendSnapshot> {
    return {
      platform: input.platform,
      trendingSounds: [{ name: "Suono generico in crescita (dato di esempio)", usageGrowthPct: 10 }],
      emergingHashtags: ["esempio", "contentcreator", "fyp"],
      viralFormats: [
        { name: "Hook + payoff rapido (esempio)", description: "Formato generico di esempio finche' non e' collegata una fonte trend reale." },
      ],
      growingNiches: ["nicchia di esempio"],
      source: "MOCK",
    };
  }
}
