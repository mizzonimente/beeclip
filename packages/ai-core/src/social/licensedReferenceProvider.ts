import type { SocialProfileProvider, SocialProfileAnalysisInput } from "./types.js";
import type { SocialProfileInsights } from "@clipmanager/shared";

/**
 * STUB DI INTEGRAZIONE per l'analisi di profili REFERENCE (di terzi).
 *
 * Le API ufficiali (Instagram Graph API, TikTok for Developers) NON
 * concedono accesso a dati di profili che non sono i propri. Per i profili
 * reference la via legittima è un provider di dati con licenza (es. servizi
 * di social listening / creator analytics B2B). Questo stub definisce il
 * contratto esatto e dove andrebbe la chiamata reale, senza inventare una
 * finta integrazione: lancia un errore esplicito finché non è configurato.
 *
 * Per attivarlo:
 * 1. Sottoscrivere un provider con licenza che esponga endpoint REST per
 *    "profile lookup" su TikTok/Instagram (diverse aziende lo offrono).
 * 2. Impostare SOCIAL_DATA_PROVIDER=licensed_provider e
 *    SOCIAL_DATA_PROVIDER_API_KEY nel `.env`.
 * 3. Implementare `analyzeProfile` qui sotto con la chiamata HTTP reale al
 *    provider scelto, mappando la risposta sullo stesso tipo
 *    `SocialProfileInsights` già usato dal resto del sistema — nessun altro
 *    modulo deve cambiare.
 */
export class LicensedReferenceProvider implements SocialProfileProvider {
  readonly name = "licensed-provider-stub";

  constructor(private readonly apiKey?: string, private readonly baseUrl?: string) {}

  supports(input: SocialProfileAnalysisInput): boolean {
    return input.connectedVia === "LICENSED_PROVIDER";
  }

  async analyzeProfile(_input: SocialProfileAnalysisInput): Promise<SocialProfileInsights> {
    if (!this.apiKey || !this.baseUrl) {
      throw new Error(
        "Nessun provider dati con licenza configurato. Imposta SOCIAL_DATA_PROVIDER_API_KEY e il base URL del provider scelto, poi implementa la chiamata reale in LicensedReferenceProvider.analyzeProfile()."
      );
    }
    throw new Error("Integrazione provider con licenza non ancora implementata: vedi commento della classe.");
  }
}
