import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { runCommand } from "../ffmpeg/runFfmpeg.js";

export interface SampledFrames {
  framePaths: string[];
  samplingFps: number;
}

/**
 * Estrae fotogrammi campione da un segmento del video sorgente, a bassa
 * frequenza (`samplingFps`) e risoluzione ridotta (`scaleWidth`), da usare
 * come input per il rilevamento del volto (vedi `detectFace.ts`).
 *
 * Decisione progettuale (stesso motivo documentato in `ffmpeg/cut.ts`): il
 * taglio del segmento avviene con il filtro `trim` DOPO la decodifica
 * completa, non con `-ss` prima dell'input. Qui non serve precisione
 * frame-by-frame fine in sé, ma serve GARANTIRE che i timestamp assegnati ai
 * fotogrammi campionati (indice/samplingFps, vedi
 * `computeFaceTrackingTrajectory.ts`) restino sincronizzati con lo stesso
 * sistema di tempo "relativo all'inizio della clip" (PTS azzerato a 0) usato
 * dal filtro crop dinamico nel rendering finale: un fast-seek con `-ss`
 * prima dell'input atterra sul keyframe più vicino, introducendo un offset
 * che vanificherebbe l'inseguimento volto.
 */
export async function sampleFrames(
  sourcePath: string,
  startSeconds: number,
  endSeconds: number,
  outDir: string,
  samplingFps = 2,
  scaleWidth = 480
): Promise<SampledFrames> {
  await mkdir(outDir, { recursive: true });

  const duration = endSeconds - startSeconds;
  if (duration <= 0) return { framePaths: [], samplingFps };

  await runCommand("ffmpeg", [
    "-y",
    "-filter_threads", "1",
    "-i", sourcePath,
    "-filter:v",
    `trim=start=${startSeconds}:end=${endSeconds},setpts=PTS-STARTPTS,fps=${samplingFps},scale=${scaleWidth}:-2`,
    "-an",
    "-q:v", "4",
    join(outDir, "frame_%04d.jpg"),
  ]);

  // Non si presume il numero di fotogrammi prodotti (dipende da quanti ne
  // riesce a campionare ffmpeg nell'intervallo): si legge la directory per i
  // file realmente scritti, ordinati per nome (lo schema "%04d" garantisce
  // un ordinamento alfabetico coerente con quello temporale fino a 9999
  // fotogrammi, ben più di quanti una singola clip ne produca mai).
  const files = (await readdir(outDir)).filter((f) => f.startsWith("frame_") && f.endsWith(".jpg")).sort();

  return {
    framePaths: files.map((f) => join(outDir, f)),
    samplingFps,
  };
}
