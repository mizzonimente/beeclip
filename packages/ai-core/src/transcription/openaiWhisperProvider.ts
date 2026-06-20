import { readFile } from "node:fs/promises";
import type { TranscriptionProvider } from "./types.js";
import type { TranscriptionResult, TranscriptSegment, TranscriptWord } from "@clipmanager/shared";

/**
 * Provider di trascrizione reale basato su OpenAI Whisper API.
 *
 * Implementato con `fetch` nativo (Node 18+) invece dell'SDK ufficiale
 * `openai` per due motivi: (1) evita di legare il progetto a una versione
 * precisa dell'SDK quando l'unica cosa che serve è un singolo endpoint
 * REST multipart, (2) rende la dipendenza dal provider esplicita e
 * facilmente sostituibile (vedi `TranscriptionProvider`).
 *
 * Nota onesta: l'endpoint Whisper restituisce timestamp affidabili a
 * livello di segmento. I timestamp parola-per-parola richiedono
 * `timestamp_granularities: ["word"]` (supportato solo da alcuni modelli);
 * se l'API non li restituisce, li approssimiamo distribuendo la durata del
 * segmento in proporzione alla lunghezza di ciascuna parola — è
 * un'approssimazione dichiarata, non un dato inventato silenziosamente.
 */
export class OpenAIWhisperProvider implements TranscriptionProvider {
  readonly name = "openai-whisper" as const;

  constructor(private readonly apiKey: string, private readonly model: string = "whisper-1") {
    if (!apiKey) throw new Error("OPENAI_API_KEY mancante per OpenAIWhisperProvider");
  }

  async transcribe(audioFilePath: string, language = "it"): Promise<TranscriptionResult> {
    const fileBuffer = await readFile(audioFilePath);
    const form = new FormData();
    form.append("file", new Blob([fileBuffer]), "audio.wav");
    form.append("model", this.model);
    form.append("language", language);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");
    form.append("timestamp_granularities[]", "word");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`OpenAI Whisper API error ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as {
      text: string;
      language?: string;
      segments?: Array<{ start: number; end: number; text: string }>;
      words?: Array<{ start: number; end: number; word: string }>;
    };

    const rawSegments = data.segments ?? [{ start: 0, end: 0, text: data.text }];
    const allWords = data.words ?? [];

    const segments: TranscriptSegment[] = rawSegments.map((seg) => {
      const wordsInSegment = allWords.filter((w) => w.start >= seg.start && w.start < seg.end);
      const words: TranscriptWord[] =
        wordsInSegment.length > 0
          ? wordsInSegment.map((w) => ({ start: w.start, end: w.end, text: w.word }))
          : approximateWordTimestamps(seg.text, seg.start, seg.end);

      return { start: seg.start, end: seg.end, text: seg.text.trim(), words };
    });

    return {
      language: data.language ?? language,
      fullText: data.text,
      segments,
      provider: "openai-whisper",
    };
  }
}

/** Distribuisce i timestamp delle parole proporzionalmente alla loro lunghezza
 *  quando l'API non fornisce timestamp parola-per-parola nativi. */
function approximateWordTimestamps(text: string, start: number, end: number): TranscriptWord[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const totalChars = words.reduce((sum, w) => sum + w.length, 0) || 1;
  const duration = Math.max(end - start, 0.01);

  let cursor = start;
  return words.map((w) => {
    const share = (w.length / totalChars) * duration;
    const wordStart = cursor;
    const wordEnd = cursor + share;
    cursor = wordEnd;
    return { start: wordStart, end: wordEnd, text: w };
  });
}
