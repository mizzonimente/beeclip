import type { SocialProfileProvider, SocialProfileAnalysisInput } from "./types.js";
import type { SocialProfileInsights } from "@clipmanager/shared";

interface IgMedia {
  id: string;
  caption?: string;
  media_type: string;
  like_count?: number;
  comments_count?: number;
  timestamp: string;
}

/**
 * Provider REALE per l'analisi del PROPRIO account Instagram Business/Creator,
 * collegato via OAuth (Instagram Graph API — Facebook Login for Business).
 * Questa è l'unica via legittima per leggere dati di un profilo: l'utente
 * autorizza esplicitamente l'accesso, niente scraping.
 *
 * Per profili di terzi (reference) questa via NON è disponibile: Meta non
 * concede insights su account che non sono i propri — vedi
 * `licensedReferenceProvider.ts`.
 *
 * Setup richiesto (a cura dell'utente, fuori dal codice):
 * 1. App Facebook for Developers con prodotto "Instagram Graph API".
 * 2. Flusso OAuth che produce un `accessToken` con permessi
 *    `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`.
 * 3. L'`accessToken` va salvato (cifrato) collegato al `SocialProfile` con
 *    `connectedVia = OAUTH` — non implementato in v1 (vedi roadmap), qui
 *    diamo per scontato che il token sia già disponibile.
 */
export class InstagramGraphOwnAccountProvider implements SocialProfileProvider {
  readonly name = "instagram-graph-api";

  constructor(private readonly graphApiVersion: string = "v19.0") {}

  supports(input: SocialProfileAnalysisInput): boolean {
    return input.platform === "INSTAGRAM" && input.connectedVia === "OAUTH" && !!input.accessToken;
  }

  async analyzeProfile(input: SocialProfileAnalysisInput): Promise<SocialProfileInsights> {
    if (!input.accessToken) throw new Error("InstagramGraphOwnAccountProvider richiede un accessToken OAuth");

    const igUserId = input.handle; // qui ci si aspetta l'IG Business Account ID, non lo username
    const base = `https://graph.facebook.com/${this.graphApiVersion}`;

    const mediaRes = await fetch(
      `${base}/${igUserId}/media?fields=id,caption,media_type,like_count,comments_count,timestamp&limit=25&access_token=${input.accessToken}`
    );
    if (!mediaRes.ok) {
      throw new Error(`Instagram Graph API error ${mediaRes.status}: ${await mediaRes.text()}`);
    }
    const mediaData = (await mediaRes.json()) as { data: IgMedia[] };
    const media = mediaData.data ?? [];

    return computeInsightsFromMedia(media);
  }
}

/** Logica di calcolo reale (non un placeholder): derivata interamente dai
 *  media restituiti dall'API, nessun numero inventato. */
export function computeInsightsFromMedia(media: IgMedia[]): SocialProfileInsights {
  const hashtagRegex = /#[\p{L}0-9_]+/gu;
  const allHashtags = media.flatMap((m) => [...(m.caption?.match(hashtagRegex) ?? [])].map((h) => h.slice(1)));
  const hashtagsUsed = Array.from(new Set(allHashtags)).slice(0, 20);

  const typeCounts: Record<string, number> = {};
  for (const m of media) typeCounts[m.media_type] = (typeCounts[m.media_type] ?? 0) + 1;
  const recurringFormats = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);

  const engagements = media.map((m) => (m.like_count ?? 0) + (m.comments_count ?? 0));
  const avgEngagementRate = media.length ? engagements.reduce((a, b) => a + b, 0) / media.length : 0;

  const sortedByEngagement = [...media].sort(
    (a, b) => (b.like_count ?? 0) + (b.comments_count ?? 0) - ((a.like_count ?? 0) + (a.comments_count ?? 0))
  );
  const bestPerformingContent = sortedByEngagement.slice(0, 3).map((m) => ({
    title: (m.caption ?? "(senza caption)").slice(0, 60),
    reasonItWorked: `${(m.like_count ?? 0) + (m.comments_count ?? 0)} interazioni totali, formato ${m.media_type}.`,
  }));

  const timestamps = media.map((m) => new Date(m.timestamp).getTime()).sort((a, b) => b - a);
  let postingFrequency = "dati insufficienti";
  if (timestamps.length >= 2) {
    const gaps = timestamps.slice(0, -1).map((t, i) => (t - timestamps[i + 1]!) / (1000 * 60 * 60 * 24));
    const avgGapDays = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    postingFrequency = avgGapDays < 1.5 ? "quasi quotidiana" : `circa ogni ${avgGapDays.toFixed(1)} giorni`;
  }

  return {
    toneOfVoice: "derivabile dalle caption (richiede analisi testuale aggiuntiva via LLM, vedi metadata.generate)",
    recurringFormats,
    hashtagsUsed,
    visualStyle: "non determinabile da soli metadati testuali: richiede analisi visiva delle immagini (estensione futura)",
    postingFrequency,
    avgEngagementRate,
    bestPerformingContent,
  };
}
