import type { DailyTrendSnapshot } from "@clipmanager/shared";

export interface ProjectIdeaContext {
  title?: string;
  industry?: string;
  contentType?: string;
}

export interface ContentIdeaDraft {
  title: string;
  description: string;
}

/**
 * Genera idee di contenuto combinando i segnali reali dello snapshot trend
 * (formati virali, hashtag emergenti, nicchie in crescita) con il contesto
 * del progetto del cliente, se disponibile. Logica deterministica a
 * template: nessun testo inventato senza base nello snapshot, cosi' il
 * risultato resta tracciabile a un segnale trend specifico.
 */
export function buildContentIdeas(
  snapshot: DailyTrendSnapshot,
  project?: ProjectIdeaContext
): ContentIdeaDraft[] {
  const ideas: ContentIdeaDraft[] = [];
  const audienceHint = project?.industry ? ` per il settore ${project.industry}` : "";
  const relevantHashtags = snapshot.emergingHashtags.filter((h) => h !== "__STALE_DATA__").slice(0, 3);

  for (const format of snapshot.viralFormats) {
    const hashtagSuggestion = relevantHashtags.length ? ` Hashtag suggeriti: ${relevantHashtags.map((h) => `#${h}`).join(" ")}.` : "";
    ideas.push({
      title: `Usa il formato "${format.name}"${audienceHint}`,
      description: `${format.description}${hashtagSuggestion}`,
    });
  }

  for (const niche of snapshot.growingNiches.slice(0, 2)) {
    ideas.push({
      title: `Contenuto sulla nicchia in crescita: ${niche}`,
      description: project?.title
        ? `La nicchia "${niche}" e' in crescita su ${snapshot.platform}: valuta un episodio/clip a tema partendo dal progetto "${project.title}".`
        : `La nicchia "${niche}" e' in crescita su ${snapshot.platform}: puo' essere un buon punto di partenza per un nuovo contenuto.`,
    });
  }

  if (snapshot.trendingSounds.length) {
    const top = snapshot.trendingSounds[0]!;
    ideas.push({
      title: `Suono in crescita da provare: "${top.name}"`,
      description: `Crescita d'uso del +${top.usageGrowthPct}% su ${snapshot.platform}: valuta una clip che lo usi come sottofondo o spunto comico/narrativo.`,
    });
  }

  return ideas;
}
