import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * Confine volutamente "any"-typed verso `@vladmandic/face-api` e
 * `@tensorflow/tfjs-node`: le loro definizioni di tipo upstream non sono
 * pensate per il nostro uso specifico (decodifica di un Buffer JPEG lato
 * Node, senza canvas). Isolare qui il confine "any" evita che un'imprecisione
 * di tipo upstream si propaghi nel resto del modulo, che resta tipizzato
 * normalmente (vedi `FaceCenter` più sotto). Il comportamento a runtime non
 * cambia: il worker esegue questo codice via `tsx` (type-stripping), solo lo
 * stage di build di Docker esegue `tsc` per davvero.
 */
type FaceApiModule = any;

let faceApiPromise: Promise<FaceApiModule> | null = null;

/**
 * Carica `@vladmandic/face-api` + il modello `tinyFaceDetector` (il più
 * piccolo/veloce tra quelli disponibili: qui serve individuare UN volto
 * principale, non serve precisione su volti piccoli/multipli) una sola
 * volta per processo worker, e riusa la stessa promise per ogni chiamata
 * successiva — evita di ricaricare i pesi del modello da disco per ogni
 * fotogramma campionato.
 */
function loadFaceApi(): Promise<FaceApiModule> {
  if (!faceApiPromise) {
    faceApiPromise = (async () => {
      // L'ordine di import è significativo: @tensorflow/tfjs-node deve
      // registrare il proprio backend nativo (CPU, via binding C++) prima
      // che face-api venga usato, altrimenti si rischia di ricadere sul
      // backend "puro JS" di tfjs-core, molto più lento su un'inferenza
      // ripetuta per decine di fotogrammi per clip.
      await import("@tensorflow/tfjs-node");
      const faceapi: FaceApiModule = await import("@vladmandic/face-api");

      const require = createRequire(import.meta.url);
      const modelPath = join(dirname(require.resolve("@vladmandic/face-api/package.json")), "model");
      await faceapi.nets.tinyFaceDetector.loadFromDisk(modelPath);

      return faceapi;
    })();
  }
  return faceApiPromise;
}

export interface FaceCenter {
  /** 0-1, frazione della larghezza del fotogramma campionato */
  cx: number;
  /** 0-1, frazione dell'altezza del fotogramma campionato */
  cy: number;
  /** confidenza del rilevatore, 0-1 */
  score: number;
}

/**
 * Rileva il volto più prominente in un singolo fotogramma e ne ritorna il
 * centro come frazione 0-1 (indipendente dalla risoluzione del fotogramma
 * campionato, quindi riusabile per convertire in pixel a qualunque
 * risoluzione di crop target — vedi `dynamicCropFilter.ts`).
 *
 * Ritorna `null` quando non viene rilevato nessun volto in questo
 * fotogramma (caso normale, non un errore: gestito da `trajectory.ts` con
 * un riempimento dei "buchi").
 */
export async function detectFaceCenter(imageBuffer: Buffer): Promise<FaceCenter | null> {
  const faceapi = await loadFaceApi();
  const tensor = faceapi.tf.node.decodeImage(imageBuffer, 3);

  try {
    const result = await faceapi.detectSingleFace(tensor, new faceapi.TinyFaceDetectorOptions());
    if (!result) return null;

    const imgHeight: number = tensor.shape[0];
    const imgWidth: number = tensor.shape[1];
    if (!imgWidth || !imgHeight) return null;

    const { x, y, width, height } = result.box;

    return {
      cx: clamp01((x + width / 2) / imgWidth),
      cy: clamp01((y + height / 2) / imgHeight),
      score: typeof result.score === "number" ? result.score : 0,
    };
  } finally {
    tensor.dispose();
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
