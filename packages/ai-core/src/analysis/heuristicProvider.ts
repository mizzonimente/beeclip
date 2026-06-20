import type { LanguageModelProvider, AnalysisContext } from "./types.js";
import type { ClipCandidateDraft, TranscriptSegment } from "@clipmanager/shared";
import { SCORING_WEIGHTS_BY_CONTENT_TYPE } from "@clipmanager/shared";

/**
 * Provider di fallback senza chiavi API: NON è un generatore di numeri
 * casuali. È un'euristica linguistica reale, basata su liste di parole e
 * pattern, pensata per essere deterministica e testabile (vedi
 * `src/__tests__/heuristicProvider.test.ts`). Qualità inferiore a un LLM,
 * ma un punto di partenza onesto: ogni punteggio è giustificabile.
 *
 * Da quando esiste `ffmpeg/sceneDetect.ts`, l'euristica usa anche un segnale
 * visivo reale (cambi di inquadratura) come bonus su hook/retention, quando
 * disponibile in `ctx.sceneChanges` — vedi `sceneChangeHookBonus` e
 * `sceneChangeDensityBonus` più sotto.
 *
 * Tutte le funzioni pure sono esportate singolarmente per poter essere
 * testate in isolamento.
 */

// Liste di parole italiane usate come segnali (non esaustive, estendibili).
const HOOK_KEYWORDS = [
  "incredibile", "segreto", "verità", "errore", "nessuno", "mai", "sempre",
  "perché", "come", "ecco", "attenzione", "scopri", "motivo", "davvero", "shock",
];
const EMOTION_KEYWORDS = [
  "amore", "paura", "rabbia", "gioia", "tristezza", "sorpresa", "incredibile",
  "assurdo", "pazzesco", "emozionante", "commovente", "divertente", "ridere",
];
const FILLER_WORDS = ["cioè", "tipo", "boh", "diciamo", "insomma", "ehm", "praticamente"];
const LEADING_CONJUNCTIONS = ["e", "ma", "quindi", "perché", "infatti", "allora", "comunque"];

export function scoreHook(text: string, positionRatio: number): number {
  const lower = text.toLowerCase();
  const keywordHits = HOOK_KEYWORDS.filter((k) => lower.includes(k)).length;
  const hasQuestion = /\?/.test(text);
  const hasNumber = /\b\d+\b/.test(text);

  let score = 40; // base
  score += Math.min(keywordHits * 12, 36);
  if (hasQuestion) score += 12;
  if (hasNumber) score += 8;
  // I primi istanti del video valgono di più come hook (coerente con il
  // concetto di "hook iniziale" richiesto).
  if (positionRatio < 0.1) score += 10;
  return clamp(score);
}

export function scoreEmotion(text: string): number {
  const lower = text.toLowerCase();
  const keywordHits = EMOTION_KEYWORDS.filter((k) => lower.includes(k)).length;
  const exclamations = (text.match(/!/g) ?? []).length;
  let score = 35 + keywordHits * 14 + exclamations * 8;
  return clamp(score);
}

export function scorePacing(wordCount: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  const wps = wordCount / durationSeconds;
  // Range ritenuto "ben ritmato" per il parlato in italiano: 2.0-3.3 parole/sec.
  const idealMin = 2.0;
  const idealMax = 3.3;
  if (wps >= idealMin && wps <= idealMax) return 95;
  const distance = wps < idealMin ? idealMin - wps : wps - idealMax;
  return clamp(95 - distance * 25);
}

export function scoreClarity(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgLen = sentences.length
    ? sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length
    : text.split(/\s+/).length;
  const lower = text.toLowerCase();
  const fillerHits = FILLER_WORDS.filter((f) => lower.includes(f)).length;

  // Frasi brevi (8-16 parole) = più chiare. Penalità per filler words.
  let score = avgLen >= 8 && avgLen <= 16 ? 90 : 90 - Math.abs(avgLen - 12) * 2;
  score -= fillerHits * 10;
  return clamp(score);
}

export function scoreStandalone(text: string): number {
  const trimmed = text.trim();
  const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase().replace(/[^a-zà-ù]/g, "") ?? "";
  const startsWithConjunction = LEADING_CONJUNCTIONS.includes(firstWord);
  const endsClosed = /[.!?]$/.test(trimmed);

  let score = 70;
  if (startsWithConjunction) score -= 20;
  if (endsClosed) score += 20;
  else score -= 10;
  return clamp(score);
}

/**
 * Bonus di hook se la finestra inizia a ridosso di un cambio di inquadratura
 * reale (rilevato via ffmpeg, vedi ffmpeg/sceneDetect.ts): iniziare una clip
 * "a taglio" è una tecnica di hook visivo distinta dal segnale puramente
 * testuale già coperto da `scoreHook`. Nessun dato disponibile = nessun
 * bonus (mai un malus): un video a inquadratura fissa resta un candidato
 * valido, semplicemente senza questo segnale aggiuntivo.
 */
export function sceneChangeHookBonus(
  sceneChanges: number[] | undefined,
  windowStartSeconds: number,
  toleranceSeconds = 1.0
): number {
  if (!sceneChanges || sceneChanges.length === 0) return 0;
  const hasNearbyChange = sceneChanges.some((t) => Math.abs(t - windowStartSeconds) <= toleranceSeconds);
  return hasNearbyChange ? 8 : 0;
}

/**
 * Bonus di retention in base alla densità di cambi di inquadratura dentro la
 * finestra: più tagli in un dato intervallo indicano un montaggio più
 * dinamico, un segnale di retention noto nel video short-form (in forma più
 * sofisticata è uno dei fattori usati anche da Opus Clip). Curva a
 * saturazione: ~1 taglio ogni 10s è già "dinamico" e oltre non aggiunge
 * altro, per non premiare all'infinito un falso positivo del rilevatore.
 */
export function sceneChangeDensityBonus(
  sceneChanges: number[] | undefined,
  windowStartSeconds: number,
  windowEndSeconds: number
): number {
  if (!sceneChanges || sceneChanges.length === 0) return 0;
  const duration = windowEndSeconds - windowStartSeconds;
  if (duration <= 0) return 0;
  const count = sceneChanges.filter((t) => t >= windowStartSeconds && t <= windowEndSeconds).length;
  const cutsPerTenSeconds = (count / duration) * 10;
  return Math.min(10, cutsPerTenSeconds * 10);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Bonus (0-25) per quanto la durata di una finestra candidata è vicina alla
 * durata media desiderata dall'utente (`avgClipDurationSeconds`, impostabile
 * in upload). Falloff lineare: bonus massimo quando duration === target,
 * zero quando la distanza è pari (o superiore) all'intero range min-max
 * disponibile. Senza un target impostato non c'è bonus (né penalità): le
 * finestre vengono valutate solo sugli altri criteri, come prima.
 */
export function durationFitBonus(
  duration: number,
  target: number | undefined,
  minDuration: number,
  maxDuration: number
): number {
  if (!target) return 0;
  const span = Math.max(1, maxDuration - minDuration);
  const distance = Math.abs(duration - target);
  return Math.max(0, 25 * (1 - distance / span));
}

interface Window {
  startSeconds: number;
  endSeconds: number;
  text: string;
  wordCount: number;
}

/** Combina segmenti contigui della trascrizione in finestre candidate che
 *  rispettano la durata min/max richiesta. */
export function buildCandidateWindows(
  segments: TranscriptSegment[],
  minDuration: number,
  maxDuration: number
): Window[] {
  const windows: Window[] = [];

  for (let i = 0; i < segments.length; i++) {
    let text = "";
    let wordCount = 0;
    const start = segments[i]!.start;

    for (let j = i; j < segments.length; j++) {
      const seg = segments[j]!;
      const duration = seg.end - start;
      if (duration > maxDuration) break;

      text += (text ? " " : "") + seg.text;
      wordCount += seg.words.length || seg.text.split(/\s+/).length;

      if (duration >= minDuration) {
        windows.push({ startSeconds: start, endSeconds: seg.end, text, wordCount });
      }
    }
  }
  return windows;
}

export class HeuristicAnalysisProvider implements LanguageModelProvider {
  readonly name = "heuristic-mock" as const;

  async selectClipCandidates(ctx: AnalysisContext): Promise<ClipCandidateDraft[]> {
    const { transcript, config, videoDurationSeconds, contentType, sceneChanges } = ctx;
    const weights = SCORING_WEIGHTS_BY_CONTENT_TYPE[contentType];

    const windows = buildCandidateWindows(
      transcript.segments,
      config.minClipDurationSeconds,
      config.maxClipDurationSeconds
    );

    const scored: ClipCandidateDraft[] = windows.map((w) => {
      const positionRatio = videoDurationSeconds > 0 ? w.startSeconds / videoDurationSeconds : 0;
      const duration = w.endSeconds - w.startSeconds;

      // Bonus dal segnale visivo reale (ffmpeg scene detection), se
      // disponibile: applicati SOPRA i punteggi testuali, non al loro posto.
      const hookBonus = sceneChangeHookBonus(sceneChanges, w.startSeconds);
      const densityBonus = sceneChangeDensityBonus(sceneChanges, w.startSeconds, w.endSeconds);

      const hookScore = clamp(scoreHook(w.text, positionRatio) + hookBonus);
      const emotionScore = scoreEmotion(w.text);
      const retentionScore = clamp((hookScore + emotionScore) / 2 + densityBonus); // proxy: hook+emozione+dinamismo visivo tengono l'attenzione
      const pacingScore = scorePacing(w.wordCount, duration);
      const clarityScore = scoreClarity(w.text);
      const standaloneScore = scoreStandalone(w.text);

      const fitBonus = durationFitBonus(
        duration,
        config.avgClipDurationSeconds,
        config.minClipDurationSeconds,
        config.maxClipDurationSeconds
      );

      const aggregateScore = clamp(
        hookScore * weights.hook +
          emotionScore * weights.emotion +
          retentionScore * weights.retention +
          pacingScore * weights.pacing +
          clarityScore * weights.clarity +
          standaloneScore * weights.standalone +
          fitBonus
      );

      const emotionTags = EMOTION_KEYWORDS.filter((k) => w.text.toLowerCase().includes(k));
      const visualNote =
        hookBonus > 0
          ? ", inizio su un taglio reale rilevato"
          : densityBonus > 0
            ? ", montaggio dinamico rilevato"
            : "";
      const durationNote = config.avgClipDurationSeconds
        ? `, durata ${Math.round(duration)}s vs target ${config.avgClipDurationSeconds}s`
        : "";

      return {
        startSeconds: w.startSeconds,
        endSeconds: w.endSeconds,
        hookScore,
        emotionScore,
        retentionScore,
        pacingScore,
        clarityScore,
        standaloneScore,
        aggregateScore,
        emotionTags,
        rationale: `Hook ${hookScore}/100, emozione ${emotionScore}/100, ritmo ${pacingScore}/100, chiarezza ${clarityScore}/100, autonomia ${standaloneScore}/100 (pesi per tipo ${contentType}${visualNote}${durationNote}).`,
        provider: "heuristic-mock" as const,
      };
    });

    return selectNonOverlapping(scored, config.desiredClipCount);
  }
}

/** Selezione greedy per punteggio decrescente, scartando finestre che si
 *  sovrappongono a una già scelta — evita di proporre clip duplicate. */
function selectNonOverlapping(candidates: ClipCandidateDraft[], desiredCount?: number): ClipCandidateDraft[] {
  const sorted = [...candidates].sort((a, b) => b.aggregateScore - a.aggregateScore);
  const chosen: ClipCandidateDraft[] = [];
  const maxCount = desiredCount ?? Math.min(8, Math.max(3, Math.round(sorted.length / 4)));

  for (const c of sorted) {
    if (chosen.length >= maxCount) break;
    const overlaps = chosen.some((s) => c.startSeconds < s.endSeconds && c.endSeconds > s.startSeconds);
    if (!overlaps) chosen.push(c);
  }
  return chosen.sort((a, b) => a.startSeconds - b.startSeconds);
}
