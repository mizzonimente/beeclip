import type { SilenceInterval } from "./silenceDetect.js";
import type { KeepRange } from "./cut.js";

/**
 * Dati i silenzi rilevati sull'intero video sorgente e il range di una
 * clip, calcola i KeepRange (relativi all'inizio della clip) da passare a
 * `buildClipRenderArgs` per tagliare solo le pause "morte" più lunghe di
 * `maxPauseSeconds`, lasciando le pause brevi (respiro naturale).
 */
export function computeKeepRangesForClip(
  silences: SilenceInterval[],
  clipStart: number,
  clipEnd: number,
  maxPauseSeconds = 1.0
): KeepRange[] {
  const relevant = silences
    .filter((s) => s.end > clipStart && s.start < clipEnd && s.end - s.start > maxPauseSeconds)
    .map((s) => ({ start: Math.max(s.start, clipStart) - clipStart, end: Math.min(s.end, clipEnd) - clipStart }))
    .sort((a, b) => a.start - b.start);

  const clipDuration = clipEnd - clipStart;
  const keep: KeepRange[] = [];
  let cursor = 0;
  for (const s of relevant) {
    if (s.start > cursor) keep.push({ start: cursor, end: s.start });
    cursor = Math.max(cursor, s.end);
  }
  if (cursor < clipDuration) keep.push({ start: cursor, end: clipDuration });
  return keep;
}
