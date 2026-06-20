import type { AnalysisContext } from "./types.js";

/**
 * Prompt che istruisce il modello a comportarsi come un social media
 * manager esperto, replicando esplicitamente tutti i criteri richiesti:
 * ritmo, inquadrature, cambi scena, emozione, battute, storytelling, hook,
 * chiarezza, retention, senso narrativo da standalone.
 */
export function buildClipSelectionPrompt(ctx: AnalysisContext): string {
  const transcriptBlock = ctx.transcript.segments
    .map((s) => `[${formatTime(s.start)} - ${formatTime(s.end)}] ${s.text}`)
    .join("\n");

  const sceneChangesBlock = ctx.sceneChanges?.length
    ? `Cambi di inquadratura rilevati ai secondi: ${ctx.sceneChanges.map((t) => t.toFixed(1)).join(", ")}.`
    : "Nessun dato sui cambi di inquadratura disponibile: basati solo su parlato e ritmo.";

  return `Sei un social media manager senior, specializzato nel trasformare video lunghi in clip brevi ad alto potenziale virale per TikTok, Instagram Reels, YouTube Shorts, LinkedIn e Facebook.

CONTESTO DEL PROGETTO
- Titolo: ${ctx.project.title}
- Descrizione: ${ctx.project.description ?? "n/d"}
- Settore: ${ctx.project.industry ?? "n/d"}
- Obiettivo del contenuto: ${ctx.project.contentGoal ?? "n/d"}
- Target audience: ${ctx.project.targetAudience ?? "n/d"}
- Tipo di contenuto: ${ctx.contentType}
- Durata totale video: ${ctx.videoDurationSeconds.toFixed(1)}s

VINCOLI DI TAGLIO
- Numero di clip desiderate: ${ctx.config.desiredClipCount ?? "decidi tu il numero migliore (modalità automatica)"}
- Durata clip: tra ${ctx.config.minClipDurationSeconds}s e ${ctx.config.maxClipDurationSeconds}s${
    ctx.config.avgClipDurationSeconds ? `, target medio ${ctx.config.avgClipDurationSeconds}s` : ""
  }.

${sceneChangesBlock}

TRASCRIZIONE CON TIMESTAMP
${transcriptBlock}

COSA DEVI VALUTARE PER OGNI POTENZIALE CLIP (non solo il parlato):
1. Forza del hook nei primi 1-3 secondi del segmento.
2. Ritmo e variazione di intensità (non solo contenuto, anche "energia" percepita).
3. Cambi di inquadratura/scena dentro il range scelto, se rilevanti.
4. Carica emotiva (sorpresa, umorismo, tensione, commozione, rabbia, gioia).
5. Presenza di battute, colpi di scena, momenti memorabili.
6. Potenziale di storytelling: la clip racconta qualcosa con un inizio e una chiusura, non solo un frammento.
7. Chiarezza del messaggio: è comprensibile senza contesto aggiuntivo?
8. Autonomia narrativa: ha senso se vista isolata dal resto del video?
9. Potenziale di retention: il ritmo e la struttura tengono l'attenzione fino alla fine?
10. Coerenza con l'obiettivo del contenuto (educare, intrattenere, vendere, fare brand awareness).

Restituisci la tua selezione SOLO tramite la function/tool fornita, con punteggi 0-100 per ciascun criterio e una motivazione testuale (rationale) che spieghi esplicitamente perché hai assegnato quei punteggi, citando elementi concreti del testo (non genericità).`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
