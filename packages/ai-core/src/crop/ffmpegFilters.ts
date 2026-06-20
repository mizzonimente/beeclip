import type { CropRegion } from "@clipmanager/shared";
import { CLIP_FORMATS, type ClipFormatKey } from "@clipmanager/shared";

/** Costruisce il filtro ffmpeg crop+scale+pad per ottenere esattamente le
 *  dimensioni del formato target a partire da una regione di crop calcolata
 *  da `computeCrop`. */
export function buildCropScaleFilter(crop: CropRegion, format: ClipFormatKey): string {
  const target = CLIP_FORMATS[format];
  const cropFilter = `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`;
  if (!target.width || !target.height) return cropFilter; // CUSTOM: nessun resize forzato
  return `${cropFilter},scale=${target.width}:${target.height}:force_original_aspect_ratio=decrease,pad=${target.width}:${target.height}:(ow-iw)/2:(oh-ih)/2:color=black`;
}
