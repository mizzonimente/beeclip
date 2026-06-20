import { runCommand } from "./runFfmpeg.js";

/**
 * Rilevamento reale dei cambi di inquadratura (shot/scene change) via filtro
 * `select` di ffmpeg con metrica `scene` + `showinfo` (nessuna libreria
 * esterna, nessuna AI: confronto della differenza tra frame consecutivi —
 * la stessa tecnica di signal processing visivo che un editor chiamerebbe
 * "cut detection"). ffmpeg stampa una riga di log per ogni frame selezionato
 * contenente `pts_time:X.XXXXXX`: quello è il timestamp del cambio.
 *
 * Popola `AnalysisContext.sceneChanges` (vedi analysis/types.ts), un campo
 * che esisteva già nel tipo ma che prima di questo modulo non veniva mai
 * calcolato da nessuna parte della pipeline — i provider basati su LLM
 * (prompts.ts) sono già pronti a usarlo, l'euristica di fallback viene
 * estesa in analysis/heuristicProvider.ts per farne uso anche lei.
 *
 * `threshold` è la soglia di "scene score" di ffmpeg (0-1): valore più alto =
 * meno tagli rilevati (default 0.4, un compromesso ragionevole per i tagli
 * netti tipici del montaggio short-form, senza scattare su semplici
 * variazioni di luce all'interno della stessa inquadratura).
 */
export async function detectSceneChanges(
  filePath: string,
  threshold = 0.4,
  minSeparationSeconds = 0.5
): Promise<number[]> {
  const { stderr } = await runCommand("ffmpeg", [
    "-i", filePath,
    "-filter:v", `select='gt(scene,${threshold})',showinfo`,
    "-an",
    "-f", "null",
    "-",
  ]);

  return dedupeSceneChanges(parseSceneChangeTimestamps(stderr), minSeparationSeconds);
}

/**
 * Estrae i timestamp `pts_time` dalle righe di log `showinfo` di ffmpeg.
 * Isolata come funzione pura (a differenza del parsing in silenceDetect.ts,
 * qui non c'è uno stato "start/end" da accoppiare) per poterla testare con
 * stringhe di log finte, senza dover invocare ffmpeg in un test unitario.
 */
export function parseSceneChangeTimestamps(ffmpegStderr: string): number[] {
  const timestamps: number[] = [];
  for (const line of ffmpegStderr.split("\n")) {
    if (!line.includes("Parsed_showinfo")) continue;
    const match = line.match(/pts_time:\s*(-?\d+(\.\d+)?)/);
    const value = match?.[1];
    if (value !== undefined) {
      timestamps.push(parseFloat(value));
    }
  }
  return timestamps;
}

/**
 * Unisce rilevazioni troppo vicine tra loro (es. un breve flash o un
 * doppio trigger sullo stesso taglio) tenendo solo la prima di ogni gruppo.
 * Richiede l'input ordinato in modo crescente: i timestamp di showinfo
 * arrivano già in ordine perché ffmpeg processa i frame in sequenza, ma
 * ordiniamo comunque per non dipendere da quella garanzia implicita.
 */
export function dedupeSceneChanges(timestamps: number[], minSeparationSeconds = 0.5): number[] {
  const sorted = [...timestamps].sort((a, b) => a - b);
  const result: number[] = [];
  for (const t of sorted) {
    const last = result[result.length - 1];
    if (last === undefined || t - last >= minSeparationSeconds) {
      result.push(t);
    }
  }
  return result;
}
