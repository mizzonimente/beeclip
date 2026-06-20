import type { MetadataGenerator, MetadataContext } from "./types.js";
import type { ClipMetadataDraft } from "@clipmanager/shared";

const HASHTAGS_BY_CONTENT_TYPE: Record<string, string[]> = {
  EDUCATIONAL: ["imparacontiktok", "lofatto", "didascalico", "tips"],
  ENTERTAINMENT: ["divertente", "perte", "viral", "fyp"],
  PROMO: ["offerta", "novità", "scoprilo"],
  PODCAST: ["podcast", "podcastitaliano", "clip"],
  INTERVIEW: ["intervista", "talk", "opinioni"],
  VLOG: ["vlog", "dietrolequinte", "giornata"],
  BACKSTAGE: ["backstage", "dietrolequinte"],
  MUSIC: ["musica", "newmusic", "song"],
  CORPORATE: ["business", "azienda", "lavoro"],
  CREATOR: ["creator", "contentcreator", "socialmedia"],
};

/**
 * Generatore di metadata senza LLM: usa template + le parole della clip
 * stessa, niente è inventato dal nulla. Qualità più bassa di un provider
 * reale, ma onesto e utile per sviluppo/demo senza chiavi API.
 */
export class HeuristicMetadataProvider implements MetadataGenerator {
  readonly name = "heuristic-mock";

  async generate(ctx: MetadataContext): Promise<ClipMetadataDraft> {
    const { candidate, clipText, contentType, brand } = ctx;
    const words = clipText.trim().split(/\s+/).filter(Boolean);
    const firstSentence = clipText.split(/[.!?]/)[0]?.trim() || clipText.slice(0, 80);
    const titleWords = words.slice(0, 10).join(" ");

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    if (candidate.hookScore >= 75) strengths.push("Hook iniziale molto forte, trattiene l'attenzione nei primi secondi.");
    if (candidate.emotionScore >= 70) strengths.push("Carica emotiva alta, buon potenziale di condivisione.");
    if (candidate.clarityScore >= 75) strengths.push("Messaggio chiaro e facilmente comprensibile.");
    if (candidate.standaloneScore >= 75) strengths.push("La clip ha senso anche vista isolata dal video completo.");
    if (strengths.length === 0) strengths.push("Contenuto coerente con il resto del video.");

    if (candidate.hookScore < 50) weaknesses.push("Il hook iniziale è debole: rischio di scroll-away nei primi secondi.");
    if (candidate.standaloneScore < 50) weaknesses.push("Il segmento potrebbe risultare poco chiaro se visto fuori contesto.");
    if (candidate.pacingScore < 50) weaknesses.push("Il ritmo del parlato è fuori dal range ottimale per i social.");
    if (weaknesses.length === 0) weaknesses.push("Nessuna debolezza rilevante rilevata dall'euristica; verifica comunque a occhio prima di pubblicare.");

    const baseHashtags = HASHTAGS_BY_CONTENT_TYPE[contentType] ?? HASHTAGS_BY_CONTENT_TYPE.CREATOR!;
    const brandHashtags = brand?.hashtagsUsed ?? [];
    const hashtags = Array.from(new Set([...brandHashtags, ...baseHashtags])).slice(0, 8);

    return {
      viralScore: Math.round(candidate.aggregateScore),
      viralReasoning: candidate.rationale,
      strengths,
      weaknesses,
      suggestedTitle: capitalize(titleWords) + (titleWords.includes("?") ? "" : ""),
      suggestedDescription: capitalize(firstSentence),
      suggestedCaption: `${capitalize(firstSentence)} ${hashtags.slice(0, 3).map((h) => "#" + h).join(" ")}`,
      suggestedHook: capitalize(firstSentence),
      suggestedOverlayText: words.slice(0, 6).join(" "),
      suggestedCoverHint: `Usa come copertina un frame intorno al secondo ${Math.round(candidate.startSeconds + 1)}, dove inizia il hook.`,
      hashtags,
      provider: "heuristic-mock",
    };
  }
}

function capitalize(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}
