import type { TranscriptSegment } from "@clipmanager/shared";

/** Genera un file SRT a partire dai segmenti di trascrizione che cadono
 *  (anche parzialmente) nel range [clipStart, clipEnd), con i timestamp
 *  rimappati relativi all'inizio della clip. */
export function buildSrt(segments: TranscriptSegment[], clipStart: number, clipEnd: number): string {
  const relevant = segments.filter((s) => s.end > clipStart && s.start < clipEnd);
  let srt = "";
  relevant.forEach((seg, i) => {
    const start = Math.max(seg.start, clipStart) - clipStart;
    const end = Math.min(seg.end, clipEnd) - clipStart;
    srt += `${i + 1}\n${toSrtTime(start)} --> ${toSrtTime(end)}\n${seg.text.trim()}\n\n`;
  });
  return srt;
}

function toSrtTime(seconds: number): string {
  const ms = Math.round((seconds % 1) * 1000);
  const totalSeconds = Math.floor(seconds);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

/** Filtro ffmpeg per "bruciare" i sottotitoli nel video con uno stile
 *  leggibile su mobile (font grande, contorno nero, posizione bassa). Le
 *  "parole chiave" (`highlightWords`) vengono evidenziate in giallo: per
 *  farlo davvero servirebbe un sottotitolo per-parola (ASS con karaoke);
 *  qui usiamo SRT semplice + nota nel codice su come passare ad ASS per
 *  l'evidenziazione parola-per-parola (estensione naturale, non implementata
 *  in v1 per restare nei tempi del MVP).
 */
export function buildSubtitlesFilter(srtPath: string): string {
  const escaped = srtPath.replace(/:/g, "\\:");
  return `subtitles='${escaped}':force_style='FontName=Arial,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2,Alignment=2,MarginV=60'`;
}
