import type { TrendProvider, TrendFetchInput } from "./types.js";
import type { DailyTrendSnapshot } from "@clipmanager/shared";

/**
 * STUB DI INTEGRAZIONE per trend giornalieri da provider con licenza
 * (es. servizi B2B di social listening/trend intelligence per TikTok/Reels/
 * Shorts). Le API ufficiali delle piattaforme non espongono un endpoint
 * pubblico "trend di oggi" stabile e documentato per sviluppatori terzi:
 * la via legittima e sostenibile è un provider dati specializzato con
 * accordo commerciale.
 *
 * Per attivarlo:
 * 1. Sottoscrivere un provider trend (TIKTOK/Instagram trend intelligence).
 * 2. Impostare TREND_DATA_PROVIDER=licensed_provider e
 *    TREND_DATA_PROVIDER_API_KEY nel `.env`.
 * 3. Implementare `fetchTrends` con la chiamata HTTP reale, mappando la
 *    risposta sul tipo condiviso `DailyTrendSnapshot` — nessun altro modulo
 *    deve cambiare.
 */
export class LicensedTrendProvider implements TrendProvider {
  readonly name = "licensed-provider-stub";

  constructor(private readonly apiKey?: string, private readonly baseUrl?: string) {}

  supports(_input: TrendFetchInput): boolean {
    return !!this.apiKey && !!this.baseUrl;
  }

  async fetchTrends(_input: TrendFetchInput): Promise<DailyTrendSnapshot> {
    throw new Error(
      "Integrazione provider trend con licenza non ancora implementata: vedi commento della classe LicensedTrendProvider."
    );
  }
}
