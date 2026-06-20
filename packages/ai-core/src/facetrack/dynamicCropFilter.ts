import { CLIP_FORMATS, type ClipFormatKey } from "@clipmanager/shared";
import type { Keyframe } from "./trajectory.js";

export interface PixelKeyframe {
  /** secondi, relativi all'inizio della clip (0 = inizio clip) */
  t: number;
  /** top-left del crop, in pixel del frame sorgente */
  x: number;
  y: number;
}

export interface DynamicCrop {
  keyframes: PixelKeyframe[];
  /** dimensioni FISSE del rettangolo di crop (solo x/y si muovono nel tempo,
   *  esattamente come `computeCrop` calcola width/height una volta sola e
   *  poi clampa solo il centro — qui lo stesso, ma il centro varia nel tempo) */
  width: number;
  height: number;
}

/**
 * Converte i keyframe normalizzati (0-1, indipendenti dalla risoluzione) in
 * coordinate pixel del frame sorgente, con lo stesso clamp di
 * `crop/smartCrop.ts` (`computeCrop`): il rettangolo di crop, centrato sul
 * volto, non deve mai uscire dai bordi del frame sorgente.
 */
export function toPixelKeyframes(
  keyframes: Keyframe[],
  sourceWidth: number,
  sourceHeight: number,
  cropWidth: number,
  cropHeight: number
): PixelKeyframe[] {
  return keyframes.map((k) => {
    const centerX = k.cx * sourceWidth;
    const centerY = k.cy * sourceHeight;
    const x = clamp(centerX - cropWidth / 2, 0, sourceWidth - cropWidth);
    const y = clamp(centerY - cropHeight / 2, 0, sourceHeight - cropHeight);
    return { t: k.t, x: Math.round(x), y: Math.round(y) };
  });
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(3);
}

/**
 * Costruisce un'espressione ffmpeg piecewise-linear `if(lt(t,T),LERP,...)`
 * che interpola la coordinata estratta da `pick` tra keyframe consecutivi:
 * prima del primo keyframe resta costante al primo valore, dopo l'ultimo
 * resta costante all'ultimo valore, in mezzo interpola linearmente in base
 * al tempo `t` (la stessa variabile che ffmpeg valuta nativamente per ogni
 * fotogramma nel filtro `crop` — vedi `buildDynamicCropScaleFilter`).
 */
export function buildPiecewiseExpr(keyframes: PixelKeyframe[], pick: (k: PixelKeyframe) => number): string {
  if (keyframes.length === 0) return "0";

  const sorted = [...keyframes].sort((a, b) => a.t - b.t);
  if (sorted.length === 1) return formatNumber(pick(sorted[0]!));

  let expr = formatNumber(pick(sorted[sorted.length - 1]!));

  for (let i = sorted.length - 2; i >= 0; i--) {
    const k0 = sorted[i]!;
    const k1 = sorted[i + 1]!;
    const v0 = pick(k0);
    const v1 = pick(k1);
    const segDuration = k1.t - k0.t;

    // segDuration <= 0 (keyframe duplicati nel tempo): salta l'interpolazione
    // per evitare una divisione per zero nell'espressione ffmpeg, e usa
    // direttamente il valore del keyframe successivo.
    const lerpExpr =
      segDuration > 0
        ? `(${formatNumber(v0)}+(${formatNumber(v1)}-${formatNumber(v0)})*(t-${formatNumber(k0.t)})/${formatNumber(segDuration)})`
        : formatNumber(v1);

    expr = `if(lt(t,${formatNumber(k1.t)}),${lerpExpr},${expr})`;
  }

  expr = `if(lt(t,${formatNumber(sorted[0]!.t)}),${formatNumber(pick(sorted[0]!))},${expr})`;

  return expr;
}

/**
 * Equivalente dinamico di `crop/ffmpegFilters.ts` (`buildCropScaleFilter`):
 * stesso suffisso scale+pad per formato, ma x/y del crop sono espressioni
 * che variano nel tempo invece di interi fissi.
 *
 * NB: a differenza di `overlay`/`drawtext`/`geq`, il filtro `crop` NON ha
 * un'opzione `eval=`: le espressioni x/y sono già valutate per ogni
 * fotogramma in modo nativo (documentazione ffmpeg del filtro `crop`).
 * Aggiungere `:eval=frame` qui farebbe fallire ffmpeg con un errore
 * "option not found" — da non reintrodurre.
 */
export function buildDynamicCropScaleFilter(crop: DynamicCrop, format: ClipFormatKey): string {
  const target = CLIP_FORMATS[format];
  const xExpr = buildPiecewiseExpr(crop.keyframes, (k) => k.x);
  const yExpr = buildPiecewiseExpr(crop.keyframes, (k) => k.y);
  const cropFilter = `crop=${crop.width}:${crop.height}:x='${xExpr}':y='${yExpr}'`;
  if (!target.width || !target.height) return cropFilter; // CUSTOM: nessun resize forzato
  return `${cropFilter},scale=${target.width}:${target.height}:force_original_aspect_ratio=decrease,pad=${target.width}:${target.height}:(ow-iw)/2:(oh-ih)/2:color=black`;
}
