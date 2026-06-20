import type { TranscriptionProvider } from "./types.js";
import type { TranscriptionResult, TranscriptSegment } from "@clipmanager/shared";
import { detectSilences, speechIntervalsFromSilences } from "../ffmpeg/silenceDetect.js";
import { probeVideo } from "../ffmpeg/runFfmpeg.js";

/**
 * Provider di fallback SENZA chiave API. Importante essere onesti su cosa
 * fa davvero: esegue una VERA analisi del segnale audio (rilevamento
 * silenzi via ffmpeg) per ricavare confini di "beat" di parlato realistici,
 * ma non ha alcuna capacità di riconoscimento vocale — quindi il testo di
 * ogni segmento è marcato esplicitamente come placeholder, non inventato.
 *
 * Questo permette di far girare l'intera pipeline (job queue, segmentazione,
 * taglio ffmpeg, export) end-to-end senza chiavi API, per sviluppo e test.
 * Per analisi linguistica reale serve un provider reale (vedi
 * `OpenAIWhisperProvider`).
 */
export class HeuristicMockTranscriptionProvider implements TranscriptionProvider {
  readonly name = "heuristic-mock" as const;

  async transcribe(audioFilePath: string, language = "it"): Promise<TranscriptionResult> {
    const probe = await probeVideo(audioFilePath);
    const silences = await detectSilences(audioFilePath);
    const speechBeats = speechIntervalsFromSilences(silences, probe.durationSeconds);

    const segments: TranscriptSegment[] = speechBeats.map((beat, i) => {
      const placeholder = `[segmento ${i + 1}: parlato rilevato, testo non trascritto in modalità mock]`;
      return {
        start: beat.start,
        end: beat.end,
        text: placeholder,
        words: [{ start: beat.start, end: beat.end, text: placeholder }],
      };
    });

    return {
      language,
      fullText: segments.map((s) => s.text).join(" "),
      segments,
      provider: "heuristic-mock",
    };
  }
}
