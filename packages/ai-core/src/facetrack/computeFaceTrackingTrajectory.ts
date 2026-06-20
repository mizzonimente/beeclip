import { readFile, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { sampleFrames } from "./sampleFrames.js";
import { detectFaceCenter } from "./detectFace.js";
import { fillGaps, smoothSeries, reduceKeyframes, type Keyframe, type RawSample } from "./trajectory.js";

export interface FaceTrackingInput {
  sourcePath: string;
  /** Secondi ASSOLUTI nel video sorgente (`sourcePath`), cioè dove la clip
   *  inizia/finisce all'interno del video caricato originale — stesso
   *  significato di `ffmpeg/cut.ts` (`ClipRenderSpec.clipStartSeconds`/
   *  `clipEndSeconds`, usati lì in `trim=start=S:end=E` su `[0:v]`, il
   *  source intero) e di `ClipCandidate.startSeconds`/`endSeconds` a schema.
   *  NON relativi all'inizio della clip (quello è invece il sistema usato
   *  dai `Keyframe.t` restituiti da questa funzione: 0 = inizio del
   *  segmento campionato, perché `sampleFrames` azzera i PTS con lo stesso
   *  meccanismo di `cut.ts`). */
  clipStartSeconds: number;
  clipEndSeconds: number;
  /** directory di lavoro del job (creata e pulita a fine job dal chiamante,
   *  vedi `apps/worker/src/lib/tempDir.ts`): qui viene creata solo una
   *  sottocartella temporanea per i fotogrammi campione, pulita da questa
   *  funzione stessa al termine. */
  workDir: string;
}

/**
 * Calcola la traiettoria del volto (keyframe normalizzati 0-1) per un
 * segmento del video sorgente, da riusare per TUTTI i formati di export
 * richiesti per la stessa clip candidata (vedi `apps/worker/src/processors/
 * videoProcessing.ts`: chiamata una sola volta per candidato, non una volta
 * per formato, perché il rilevamento volto è il costo computazionale
 * dominante e non dipende dal formato di output — solo la conversione in
 * pixel finale, via `toPixelKeyframes`, dipende dal formato).
 *
 * Ritorna `null` (non un errore) quando non viene mai rilevato un volto nel
 * segmento: è un caso legittimo (es. inquadratura senza persone), il
 * chiamante deve ricadere sul crop statico esistente (`computeCrop`).
 * Eventuali errori reali (ffmpeg che fallisce, modello che non carica)
 * vengono invece propagati e non mascherati: altrimenti un problema di
 * infrastruttura sembrerebbe "nessun volto trovato".
 */
export async function computeFaceTrackingTrajectory(input: FaceTrackingInput): Promise<Keyframe[] | null> {
  const { sourcePath, clipStartSeconds, clipEndSeconds, workDir } = input;
  const framesDir = join(workDir, `facetrack-${randomUUID()}`);

  try {
    const { framePaths, samplingFps } = await sampleFrames(sourcePath, clipStartSeconds, clipEndSeconds, framesDir);
    if (framePaths.length === 0) return null;

    const raw: RawSample[] = [];
    for (let i = 0; i < framePaths.length; i++) {
      const buffer = await readFile(framePaths[i]!);
      const face = await detectFaceCenter(buffer);
      raw.push({
        t: i / samplingFps,
        cx: face ? face.cx : null,
        cy: face ? face.cy : null,
      });
    }

    const filled = fillGaps(raw);
    if (!filled) return null; // nessun volto rilevato in nessun fotogramma campionato

    const smoothed = smoothSeries(filled);
    return reduceKeyframes(smoothed);
  } finally {
    await rm(framesDir, { recursive: true, force: true }).catch(() => {
      /* best effort: non far fallire il job per un cleanup non riuscito */
    });
  }
}
