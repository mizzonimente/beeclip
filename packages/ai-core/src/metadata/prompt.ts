import type { MetadataContext } from "./types.js";

export function buildMetadataPrompt(ctx: MetadataContext): string {
  return `Sei un social media manager esperto. Hai già selezionato questa clip da un video più lungo:

TESTO DELLA CLIP
"""
${ctx.clipText}
"""

PUNTEGGI DI ANALISI GIÀ CALCOLATI (0-100)
- Hook: ${ctx.candidate.hookScore}
- Emozione: ${ctx.candidate.emotionScore}
- Retention: ${ctx.candidate.retentionScore}
- Ritmo: ${ctx.candidate.pacingScore}
- Chiarezza: ${ctx.candidate.clarityScore}
- Autonomia narrativa: ${ctx.candidate.standaloneScore}
- Tag emotivi rilevati: ${ctx.candidate.emotionTags.join(", ") || "nessuno"}

CONTESTO BRAND
- Tipo di contenuto: ${ctx.contentType}
- Obiettivo: ${ctx.project.contentGoal ?? "n/d"}
- Target audience: ${ctx.project.targetAudience ?? "n/d"}
- Tone of voice noto: ${ctx.brand?.toneOfVoice ?? "non disponibile, usa un tono neutro professionale"}
- Hashtag tipicamente usati dal brand: ${ctx.brand?.hashtagsUsed?.join(", ") ?? "nessuno noto"}

COMPITO
Genera, in italiano: un viral score 0-100 con motivazione, 2-4 punti di forza, 1-3 possibili debolezze/rischi onesti (non solo elogi), titolo, descrizione breve, caption pronta alla pubblicazione, hook testuale ad effetto, testo per sovrimpressione (max 6 parole), un suggerimento concreto per la copertina/thumbnail, e 5-8 hashtag pertinenti (mescola hashtag di nicchia e più generici, coerenti col tone of voice del brand se disponibile).

Restituisci la risposta SOLO tramite la function/tool fornita.`;
}
