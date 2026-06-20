/**
 * Trasformazione della serie grezza di rilevamenti volto (un campione per
 * fotogramma, con eventuali "buchi" quando nessun volto viene trovato) in un
 * set ridotto di keyframe utilizzabile da un'espressione ffmpeg
 * piecewise-linear (vedi `dynamicCropFilter.ts`). Tutte le funzioni qui sono
 * pure e testate in isolamento (vedi `__tests__/facetrack.test.ts`) — solo
 * l'orchestratore in `computeFaceTrackingTrajectory.ts` chiama ffmpeg e il
 * modello di rilevamento.
 */

export interface RawSample {
  /** secondi, relativi all'inizio della clip (0 = inizio clip) */
  t: number;
  /** null = nessun volto rilevato in questo fotogramma campionato */
  cx: number | null;
  cy: number | null;
}

export interface Sample {
  t: number;
  cx: number;
  cy: number;
}

export interface Keyframe {
  t: number;
  cx: number;
  cy: number;
}

/**
 * Riempie i "buchi" (fotogrammi senza volto rilevato) tenendo l'ultimo
 * valore noto. Il gap iniziale, prima del primo rilevamento, viene riempito
 * all'indietro con il PRIMO valore noto (meglio iniziare la clip già
 * centrata sul volto che con un salto a metà).
 *
 * Ritorna `null` (non un array vuoto) quando il volto non viene mai
 * rilevato in nessun fotogramma: segnale esplicito per il chiamante di
 * ricadere sul crop statico esistente.
 */
export function fillGaps(raw: RawSample[]): Sample[] | null {
  const firstKnown = raw.find((s) => s.cx !== null && s.cy !== null);
  if (!firstKnown) return null;

  let lastCx = firstKnown.cx as number;
  let lastCy = firstKnown.cy as number;

  return raw.map((s) => {
    if (s.cx !== null && s.cy !== null) {
      lastCx = s.cx;
      lastCy = s.cy;
    }
    return { t: s.t, cx: lastCx, cy: lastCy };
  });
}

/**
 * Media mobile centrata per smussare il jitter frame-a-frame del
 * rilevatore (piccole oscillazioni del bounding box anche su un volto
 * praticamente fermo). `windowSize` dispari consigliato, ma funziona anche
 * con un valore pari (finestra leggermente asimmetrica).
 */
export function smoothSeries(samples: Sample[], windowSize = 5): Sample[] {
  if (samples.length === 0) return [];
  const half = Math.floor(windowSize / 2);

  return samples.map((current, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(samples.length - 1, i + half);
    let sumCx = 0;
    let sumCy = 0;
    let count = 0;
    for (let j = start; j <= end; j++) {
      sumCx += samples[j]!.cx;
      sumCy += samples[j]!.cy;
      count++;
    }
    return { t: current.t, cx: sumCx / count, cy: sumCy / count };
  });
}

function reduceOnce(samples: Sample[], threshold: number, maxGapSeconds: number): Keyframe[] {
  if (samples.length === 0) return [];

  const keyframes: Keyframe[] = [{ t: samples[0]!.t, cx: samples[0]!.cx, cy: samples[0]!.cy }];
  let last = keyframes[0]!;

  for (let i = 1; i < samples.length - 1; i++) {
    const s = samples[i]!;
    const movement = Math.hypot(s.cx - last.cx, s.cy - last.cy);
    const elapsed = s.t - last.t;
    if (movement >= threshold || elapsed >= maxGapSeconds) {
      keyframes.push({ t: s.t, cx: s.cx, cy: s.cy });
      last = keyframes[keyframes.length - 1]!;
    }
  }

  const lastSample = samples[samples.length - 1]!;
  if (last.t !== lastSample.t) {
    keyframes.push({ t: lastSample.t, cx: lastSample.cx, cy: lastSample.cy });
  }
  return keyframes;
}

/**
 * Riduce la serie smussata a un set limitato di keyframe: un'espressione
 * ffmpeg con centinaia di rami `if(lt(t,...))` rischierebbe di superare i
 * limiti pratici di lunghezza degli argomenti del processo, o comunque di
 * essere irragionevole da costruire/eseguire. Emette un nuovo keyframe
 * quando lo spostamento dall'ultimo keyframe supera `threshold` (frazione
 * 0-1, spazio normalizzato) oppure quando è passato troppo tempo senza un
 * nuovo keyframe (`maxGapSeconds`, per non avere segmenti lineari assurdamente
 * lunghi anche col volto fermo). Se anche raddoppiando la soglia più volte
 * non si rientra nel limite, fallback estremo: solo primo e ultimo campione
 * (equivalente a un crop statico sul volto iniziale/finale).
 */
export function reduceKeyframes(
  samples: Sample[],
  threshold = 0.03,
  maxGapSeconds = 5,
  maxKeyframes = 40
): Keyframe[] {
  if (samples.length === 0) return [];

  let currentThreshold = threshold;
  let result = reduceOnce(samples, currentThreshold, maxGapSeconds);

  for (let attempt = 0; attempt < 10 && result.length > maxKeyframes; attempt++) {
    currentThreshold *= 2;
    result = reduceOnce(samples, currentThreshold, maxGapSeconds);
  }

  if (result.length > maxKeyframes) {
    const first = samples[0]!;
    const last = samples[samples.length - 1]!;
    result = [
      { t: first.t, cx: first.cx, cy: first.cy },
      { t: last.t, cx: last.cx, cy: last.cy },
    ];
  }

  return result;
}
