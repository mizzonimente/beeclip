import type { CropRegion } from "@clipmanager/shared";
import { CLIP_FORMATS, type ClipFormatKey } from "@clipmanager/shared";

export type CropModeKey = "CENTER" | "SMART" | "MANUAL";

export interface SourceDimensions {
  width: number;
  height: number;
}

/**
 * Calcola la regione di crop per un formato target.
 *
 * - CENTER: crop centrato classico.
 * - SMART (v1): crop centrato ma pesato verso il terzo superiore
 *   dell'inquadratura (regola dei terzi) — euristica ragionevole per
 *   contenuti "talking head" dove il volto tende a stare nella metà alta.
 *   È un punto di estensione esplicito: in v2 questo modulo può ricevere
 *   le coordinate di un bounding box volto/soggetto (da un modello di
 *   face/object detection) e centrare il crop su quello invece che su una
 *   regola fissa — l'interfaccia di `computeCrop` non cambierebbe.
 * - MANUAL: usa la regione fornita dall'utente, validata contro i bounds
 *   dell'immagine sorgente.
 */
export function computeCrop(
  source: SourceDimensions,
  format: ClipFormatKey,
  mode: CropModeKey,
  manualCrop?: CropRegion,
  focusPoint?: { x: number; y: number } // 0-1, da un futuro modulo di face/subject detection
): CropRegion {
  if (mode === "MANUAL" && manualCrop) {
    return clampToSource(manualCrop, source);
  }

  const targetSpec = CLIP_FORMATS[format];
  const targetRatio = targetSpec.width && targetSpec.height ? targetSpec.width / targetSpec.height : source.width / source.height;
  const sourceRatio = source.width / source.height;

  let cropWidth: number;
  let cropHeight: number;

  if (targetRatio > sourceRatio) {
    // Il target è più "largo" del sorgente: limitiamo per altezza.
    cropHeight = source.height;
    cropWidth = Math.round(cropHeight * targetRatio);
  } else {
    cropWidth = source.width;
    cropHeight = Math.round(cropWidth / targetRatio);
  }
  cropWidth = Math.min(cropWidth, source.width);
  cropHeight = Math.min(cropHeight, source.height);

  let centerX = source.width / 2;
  let centerY = mode === "SMART" ? source.height * 0.4 : source.height / 2; // regola dei terzi

  if (focusPoint) {
    centerX = focusPoint.x * source.width;
    centerY = focusPoint.y * source.height;
  }

  const x = clamp(centerX - cropWidth / 2, 0, source.width - cropWidth);
  const y = clamp(centerY - cropHeight / 2, 0, source.height - cropHeight);

  return { x: Math.round(x), y: Math.round(y), width: cropWidth, height: cropHeight };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function clampToSource(region: CropRegion, source: SourceDimensions): CropRegion {
  const width = Math.min(region.width, source.width);
  const height = Math.min(region.height, source.height);
  const x = clamp(region.x, 0, source.width - width);
  const y = clamp(region.y, 0, source.height - height);
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}
