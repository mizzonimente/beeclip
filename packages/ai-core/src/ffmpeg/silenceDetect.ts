import { runCommand } from "./runFfmpeg.js";

export interface SilenceInterval {
  start: number;
  end: number;
}

/**
 * Rilevamento reale dei silenzi via filtro `silencedetect` di ffmpeg
 * (nessuna libreria esterna, nessuna AI: pura analisi del segnale audio).
 * Usato per: (a) il taglio automatico delle pause troppo lunghe, (b) come
 * segnale di "cambio di ritmo" per la segmentazione in beat narrativi,
 * (c) come base per il provider di trascrizione euristico (mock) quando
 * non è configurato un provider AI reale.
 */
export async function detectSilences(
  filePath: string,
  noiseThresholdDb = -30,
  minSilenceDurationSeconds = 0.6
): Promise<SilenceInterval[]> {
  const { stderr } = await runCommand("ffmpeg", [
    "-i", filePath,
    "-af", `silencedetect=noise=${noiseThresholdDb}dB:d=${minSilenceDurationSeconds}`,
    "-f", "null",
    "-",
  ]);

  const intervals: SilenceInterval[] = [];
  let pendingStart: number | null = null;

  for (const line of stderr.split("\n")) {
    const startMatch = line.match(/silence_start:\s*(-?\d+(\.\d+)?)/);
    const endMatch = line.match(/silence_end:\s*(-?\d+(\.\d+)?)/);
    // Con `noUncheckedIndexedAccess` l'accesso a `match[1]` è tipizzato
    // `string | undefined` anche se il gruppo non è opzionale nella regex:
    // verifichiamo esplicitamente invece di un cast forzato, così se in
    // futuro la regex cambia non finiamo a chiamare `parseFloat(undefined)`
    // (che darebbe NaN silenzioso e corromperebbe i timestamp dei silenzi).
    const startValue = startMatch?.[1];
    const endValue = endMatch?.[1];
    if (startValue !== undefined) {
      pendingStart = parseFloat(startValue);
    } else if (endValue !== undefined && pendingStart !== null) {
      intervals.push({ start: pendingStart, end: parseFloat(endValue) });
      pendingStart = null;
    }
  }
  return intervals;
}

/** Dato un elenco di silenzi e la durata totale, restituisce i "beat" audio
 *  (intervalli di parlato) ottenuti come complemento dei silenzi. */
export function speechIntervalsFromSilences(
  silences: SilenceInterval[],
  totalDuration: number,
  minBeatSeconds = 1.5
): Array<{ start: number; end: number }> {
  const beats: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const s of silences) {
    if (s.start - cursor >= minBeatSeconds) {
      beats.push({ start: cursor, end: s.start });
    }
    cursor = Math.max(cursor, s.end);
  }
  if (totalDuration - cursor >= minBeatSeconds) {
    beats.push({ start: cursor, end: totalDuration });
  }
  return beats;
}
