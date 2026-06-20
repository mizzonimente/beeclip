import type { SocialProfileProvider, SocialProfileAnalysisInput } from "./types.js";
import type { SocialProfileInsights } from "@clipmanager/shared";

/** Dati di esempio chiaramente etichettati come tali, usati quando nessun
 *  provider reale è configurato (sviluppo/demo). La UI deve mostrare
 *  esplicitamente "dati di esempio" quando questo provider è attivo. */
export class MockSocialProfileProvider implements SocialProfileProvider {
  readonly name = "mock";

  supports(): boolean {
    return true; // fallback universale
  }

  async analyzeProfile(input: SocialProfileAnalysisInput): Promise<SocialProfileInsights> {
    return {
      toneOfVoice: "Informale, diretto, con domande retoriche frequenti (dati di esempio)",
      recurringFormats: ["talking head", "carosello educativo", "behind the scenes"],
      hashtagsUsed: [`${input.handle.replace(/\W/g, "")}`, "contentcreator", "fyp", "perte"],
      visualStyle: "Colori caldi, sottotitoli grandi centrati, b-roll frequente (dati di esempio)",
      postingFrequency: "circa ogni 2 giorni (dati di esempio)",
      avgEngagementRate: 4.2,
      bestPerformingContent: [
        { title: "Esempio: \"3 errori che tutti fanno con...\"", reasonItWorked: "Hook a lista + tono diretto (dato di esempio)" },
      ],
    };
  }
}
