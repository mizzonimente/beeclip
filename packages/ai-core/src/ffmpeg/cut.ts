import type { CropRegion } from "@clipmanager/shared";
import type { ClipFormatKey } from "@clipmanager/shared";
import { buildCropScaleFilter } from "../crop/ffmpegFilters.js";
import { buildDynamicCropScaleFilter, type DynamicCrop } from "../facetrack/dynamicCropFilter.js";
import { runCommand } from "./runFfmpeg.js";

export interface KeepRange {
  start: number; // secondi, relativi all'inizio della clip (0 = inizio clip)
  end: number;
}

export interface ClipRenderSpec {
  sourcePath: string;
  outputPath: string;
  clipStartSeconds: number;
  clipEndSeconds: number;
  crop: CropRegion;
  /** Se presente, il rettangolo di crop segue il volto rilevato nel tempo
   *  invece di restare fisso a `crop` (vedi `facetrack/computeFaceTrackingTrajectory.ts`
   *  + `facetrack/dynamicCropFilter.ts`): il chiamante calcola la traiettoria
   *  PRIMA di invocare `renderClip` e la passa già pronta qui. Quando
   *  presente ha la precedenza su `crop` nella costruzione del filtro
   *  ffmpeg — `crop` resta comunque obbligatorio perché è il fallback
   *  scelto dal chiamante quando il rilevamento volto non trova nulla
   *  (vedi i processor in apps/worker che decidono se passare questo campo). */
  dynamicCrop?: DynamicCrop;
  format: ClipFormatKey;
  /** Path di un file .srt con timestamp già relativi all'inizio della clip. */
  srtPath?: string;
  /** Se presente, rimuove dalla clip tutto ciò che NON è in uno di questi
   *  range (usato per il taglio dei silenzi/pause morte). Range relativi
   *  all'inizio della clip. */
  keepRanges?: KeepRange[];
}

/**
 * Costruisce gli argomenti ffmpeg per renderizzare una clip finale:
 * taglio preciso, crop/scale per il formato target, rimozione opzionale
 * dei silenzi, sottotitoli opzionali bruciati nel video.
 *
 * Decisione progettuale: il taglio (`trim`/`atrim`) avviene come FILTRO
 * dopo la decodifica completa, non con `-ss` prima dell'input. È più lento
 * ma garantisce un taglio sample-accurate, fondamentale quando si applicano
 * altri filtri (crop, select) nello stesso grafo. L'ottimizzazione con
 * `-ss` "fast seek" è un punto di estensione per quando le performance
 * diventeranno un problema reale (video molto lunghi, alta concorrenza).
 */
export function buildClipRenderArgs(spec: ClipRenderSpec): string[] {
  const { clipStartSeconds: S, clipEndSeconds: E } = spec;
  const filters: string[] = [];

  filters.push(`[0:v]trim=start=${S}:end=${E},setpts=PTS-STARTPTS[v0]`);
  filters.push(`[0:a]atrim=start=${S}:end=${E},asetpts=PTS-STARTPTS[a0]`);

  let lastV = "v0";
  let lastA = "a0";

  const cropScale = spec.dynamicCrop
    ? buildDynamicCropScaleFilter(spec.dynamicCrop, spec.format)
    : buildCropScaleFilter(spec.crop, spec.format);
  filters.push(`[${lastV}]${cropScale}[v1]`);
  lastV = "v1";

  if (spec.keepRanges && spec.keepRanges.length > 0) {
    const expr = buildKeepExpression(spec.keepRanges);
    filters.push(`[${lastV}]select='${expr}',setpts=N/FRAME_RATE/TB[v2]`);
    filters.push(`[${lastA}]aselect='${expr}',asetpts=N/SR/TB[a2]`);
    lastV = "v2";
    lastA = "a2";
  }

  if (spec.srtPath) {
    const escaped = spec.srtPath.replace(/:/g, "\\:").replace(/'/g, "\\'");
    filters.push(
      `[${lastV}]subtitles='${escaped}':force_style='FontName=Arial,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2,Alignment=2,MarginV=60'[vout]`
    );
    lastV = "vout";
  }

  return [
    "-y",
    // Stesso motivo del "-threads 2" sull'encoder più sotto: anche il
    // filter_complex (trim/crop/scale/subtitles) auto-rileva i core fisici
    // e va limitato esplicitamente, altrimenti contribuisce allo stesso OOM.
    "-filter_threads", "2",
    "-filter_complex_threads", "2",
    "-i", spec.sourcePath,
    "-filter_complex", filters.join(";"),
    "-map", `[${lastV}]`,
    "-map", `[${lastA}]`,
    "-c:v", "libx264",
    // Senza questo limite, libx264 auto-rileva i core della macchina FISICA
    // (non quelli allocati al container) e su Railway arriva a spawnare
    // ~60 thread di encoding: il sovraccarico di memoria dei buffer di
    // lookahead per-thread fa scattare l'OOM killer del container (2 vCPU /
    // 1GB qui), che termina ffmpeg con un segnale -> "exited with code null"
    // e il rendering della clip fallisce sempre, anche su video corti.
    "-threads", "2",
    "-preset", "veryfast",
    "-crf", "21",
    "-c:a", "aac",
    "-b:a", "128k",
    spec.outputPath,
  ];
}

export async function renderClip(spec: ClipRenderSpec): Promise<void> {
  await runCommand("ffmpeg", buildClipRenderArgs(spec));
}

/** OR logico di intervalli "between(t,start,end)" — tecnica standard ffmpeg
 *  per tenere solo certi range di tempo in un filtro `select`/`aselect`. */
export function buildKeepExpression(ranges: KeepRange[]): string {
  return ranges.map((r) => `between(t,${r.start},${r.end})`).join("+");
}
