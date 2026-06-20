import { describe, expect, it } from "vitest";
import { fillGaps, smoothSeries, reduceKeyframes, type RawSample, type Sample } from "../facetrack/trajectory.js";
import { toPixelKeyframes, buildPiecewiseExpr, type PixelKeyframe } from "../facetrack/dynamicCropFilter.js";
import type { Keyframe } from "../facetrack/trajectory.js";

// `sampleFrames`, `detectFaceCenter` e `computeFaceTrackingTrajectory`
// chiamano realmente ffmpeg/il modello di rilevamento volto (richiedono
// binari/pesi esterni), quindi non sono testabili come funzioni pure in un
// test unitario — stesso approccio già usato per `detectSceneChanges` in
// sceneDetect.test.ts. Qui testiamo solo le funzioni pure di trasformazione
// della traiettoria e di costruzione dell'espressione ffmpeg.

describe("fillGaps", () => {
  it("ritorna null se nessun fotogramma ha un volto rilevato", () => {
    const raw: RawSample[] = [
      { t: 0, cx: null, cy: null },
      { t: 0.5, cx: null, cy: null },
    ];
    expect(fillGaps(raw)).toBeNull();
  });

  it("riempie all'indietro il gap iniziale con il primo valore noto", () => {
    const raw: RawSample[] = [
      { t: 0, cx: null, cy: null },
      { t: 0.5, cx: null, cy: null },
      { t: 1, cx: 0.4, cy: 0.3 },
    ];
    expect(fillGaps(raw)).toEqual([
      { t: 0, cx: 0.4, cy: 0.3 },
      { t: 0.5, cx: 0.4, cy: 0.3 },
      { t: 1, cx: 0.4, cy: 0.3 },
    ]);
  });

  it("mantiene l'ultimo valore noto nei gap successivi", () => {
    const raw: RawSample[] = [
      { t: 0, cx: 0.2, cy: 0.2 },
      { t: 0.5, cx: null, cy: null },
      { t: 1, cx: 0.6, cy: 0.6 },
    ];
    expect(fillGaps(raw)).toEqual([
      { t: 0, cx: 0.2, cy: 0.2 },
      { t: 0.5, cx: 0.2, cy: 0.2 },
      { t: 1, cx: 0.6, cy: 0.6 },
    ]);
  });
});

describe("smoothSeries", () => {
  it("ritorna un array vuoto per input vuoto", () => {
    expect(smoothSeries([])).toEqual([]);
  });

  it("applica una media mobile centrata", () => {
    const samples: Sample[] = [
      { t: 0, cx: 0, cy: 0 },
      { t: 1, cx: 1, cy: 1 },
      { t: 2, cx: 0, cy: 0 },
    ];
    // windowSize=3 -> half=1: ogni punto è la media di sé e dei vicini
    // disponibili (ai bordi, solo i vicini esistenti).
    const result = smoothSeries(samples, 3);
    expect(result[0]!.cx).toBeCloseTo(0.5); // media di (0,1)
    expect(result[1]!.cx).toBeCloseTo(1 / 3); // media di (0,1,0)
    expect(result[2]!.cx).toBeCloseTo(0.5); // media di (1,0)
  });

  it("non altera una serie costante", () => {
    const samples: Sample[] = [
      { t: 0, cx: 0.5, cy: 0.5 },
      { t: 1, cx: 0.5, cy: 0.5 },
      { t: 2, cx: 0.5, cy: 0.5 },
    ];
    expect(smoothSeries(samples, 5)).toEqual(samples);
  });
});

describe("reduceKeyframes", () => {
  it("ritorna un array vuoto per input vuoto", () => {
    expect(reduceKeyframes([])).toEqual([]);
  });

  it("include sempre primo e ultimo campione", () => {
    const samples: Sample[] = [
      { t: 0, cx: 0.5, cy: 0.5 },
      { t: 1, cx: 0.5, cy: 0.5 },
      { t: 2, cx: 0.5, cy: 0.5 },
    ];
    const result = reduceKeyframes(samples, 0.03, 5, 40);
    expect(result[0]).toEqual({ t: 0, cx: 0.5, cy: 0.5 });
    expect(result[result.length - 1]).toEqual({ t: 2, cx: 0.5, cy: 0.5 });
  });

  it("non emette keyframe intermedi se il movimento resta sotto soglia", () => {
    const samples: Sample[] = [
      { t: 0, cx: 0.5, cy: 0.5 },
      { t: 1, cx: 0.51, cy: 0.5 },
      { t: 2, cx: 0.5, cy: 0.5 },
    ];
    expect(reduceKeyframes(samples, 0.05, 5, 40)).toEqual([
      { t: 0, cx: 0.5, cy: 0.5 },
      { t: 2, cx: 0.5, cy: 0.5 },
    ]);
  });

  it("emette un keyframe quando il movimento supera la soglia", () => {
    const samples: Sample[] = [
      { t: 0, cx: 0.1, cy: 0.1 },
      { t: 1, cx: 0.9, cy: 0.1 },
      { t: 2, cx: 0.9, cy: 0.1 },
    ];
    const result = reduceKeyframes(samples, 0.03, 5, 40);
    expect(result).toEqual([
      { t: 0, cx: 0.1, cy: 0.1 },
      { t: 1, cx: 0.9, cy: 0.1 },
      { t: 2, cx: 0.9, cy: 0.1 },
    ]);
  });

  it("forza un keyframe dopo maxGapSeconds anche senza movimento", () => {
    const samples: Sample[] = [
      { t: 0, cx: 0.5, cy: 0.5 },
      { t: 3, cx: 0.5, cy: 0.5 },
      { t: 6, cx: 0.5, cy: 0.5 },
      { t: 9, cx: 0.5, cy: 0.5 },
    ];
    const result = reduceKeyframes(samples, 0.03, 5, 40);
    // a t=6 sono passati 6s dall'ultimo keyframe (t=0) >= maxGapSeconds=5
    expect(result.some((k) => k.t === 6)).toBe(true);
  });

  it("raddoppia la soglia finché rientra nel limite di keyframe", () => {
    // 100 campioni con piccoli zig-zag continui: con la soglia base
    // emetterebbe troppi keyframe, deve convergere raddoppiando la soglia.
    const samples: Sample[] = Array.from({ length: 100 }, (_, i) => ({
      t: i * 0.1,
      cx: i % 2 === 0 ? 0.4 : 0.42,
      cy: 0.5,
    }));
    const result = reduceKeyframes(samples, 0.01, 5, 10);
    expect(result.length).toBeLessThanOrEqual(10);
  });
});

describe("toPixelKeyframes", () => {
  it("converte centri normalizzati in coordinate pixel clampate ai bordi", () => {
    const keyframes: Keyframe[] = [
      { t: 0, cx: 0, cy: 0 }, // angolo in alto a sinistra: deve clampare a (0,0)
      { t: 1, cx: 1, cy: 1 }, // angolo in basso a destra: deve clampare al massimo
      { t: 2, cx: 0.5, cy: 0.5 }, // centro esatto
    ];
    const result = toPixelKeyframes(keyframes, 1000, 1000, 200, 200);
    expect(result[0]).toEqual({ t: 0, x: 0, y: 0 });
    expect(result[1]).toEqual({ t: 1, x: 800, y: 800 });
    expect(result[2]).toEqual({ t: 2, x: 400, y: 400 });
  });
});

describe("buildPiecewiseExpr", () => {
  it("ritorna una costante per un singolo keyframe", () => {
    const keyframes: PixelKeyframe[] = [{ t: 0, x: 42, y: 0 }];
    expect(buildPiecewiseExpr(keyframes, (k) => k.x)).toBe("42");
  });

  it("genera un'espressione if/lt annidata per più keyframe", () => {
    const keyframes: PixelKeyframe[] = [
      { t: 0, x: 0, y: 0 },
      { t: 2, x: 100, y: 0 },
    ];
    const expr = buildPiecewiseExpr(keyframes, (k) => k.x);
    expect(expr).toContain("if(lt(t,0)");
    expect(expr).toContain("if(lt(t,2)");
    expect(expr).toContain("100-0");
  });

  it("non genera divisioni per zero con keyframe allo stesso istante", () => {
    const keyframes: PixelKeyframe[] = [
      { t: 1, x: 0, y: 0 },
      { t: 1, x: 50, y: 0 },
      { t: 2, x: 100, y: 0 },
    ];
    const expr = buildPiecewiseExpr(keyframes, (k) => k.x);
    expect(expr).not.toContain("/0)");
  });
});
