import { runCommand } from "./runFfmpeg.js";

/** Estrae un frame singolo come thumbnail JPEG al secondo indicato
 *  (relativo all'inizio del file sorgente). */
export async function extractThumbnail(sourcePath: string, atSeconds: number, outputPath: string): Promise<void> {
  await runCommand("ffmpeg", [
    "-y",
    "-ss", atSeconds.toFixed(2),
    "-i", sourcePath,
    "-frames:v", "1",
    "-q:v", "2",
    outputPath,
  ]);
}
