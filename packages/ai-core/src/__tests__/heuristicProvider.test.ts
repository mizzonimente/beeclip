import { describe, expect, it } from "vitest";
import {
  scoreHook,
  scoreEmotion,
  scorePacing,
  scoreClarity,
  scoreStandalone,
  buildCandidateWindows,
  sceneChangeHookBonus,
  sceneChangeDensityBonus,
} from "../analysis/heuristicProvider.js";
import type { TranscriptSegment } from "@clipmanager/shared";

// Test reali delle funzioni pure dell'euristica di fallback (nessuna chiamata
// AI, nessun I/O): verificano il comportamento della formula documentata in
// heuristicProvider.ts, non solo che "non lanci eccezioni".

describe("scoreHook", () => {
  it("assegna solo il punteggio base senza segnali di hook", () => {
    expect(scoreHook("Un testo neutro senza segnali particolari", 0.5)).toBe(40);
  });

  it("premia parola-chiave, domanda, numero e posizione iniziale", () => {
    // "scopri" (keyword hook) + "?" (domanda) + "3" (numero) + posizione < 0.1
    const score = scoreHook("Scopri questi 3 modi per migliorare?", 0.05);
    expect(score).toBe(40 + 12 + 12 + 8 + 10); // 82
  });

  it("non supera mai 100 (clamp)", () => {
    const text = "Incredibile segreto verità errore nessuno mai sempre perché come ecco attenzione scopri motivo davvero shock? 1";
    expect(scoreHook(text, 0.0)).toBeLessThanOrEqual(100);
  });
});

describe("scoreEmotion", () => {
  it("calcola base + parole-chiave + punti esclamativi", () => {
    // "gioia" e "incredibile" sono entrambe in EMOTION_KEYWORDS, un solo "!"
    expect(scoreEmotion("Che gioia incredibile!")).toBe(35 + 2 * 14 + 1 * 8); // 71
  });

  it("un testo neutro ottiene solo il punteggio base", () => {
    expect(scoreEmotion("Oggi il tempo è nuvoloso.")).toBe(35);
  });
});

describe("scorePacing", () => {
  it("premia con il massimo un ritmo nel range ideale (2.0-3.3 parole/sec)", () => {
    expect(scorePacing(50, 20)).toBe(95); // 2.5 parole/sec
  });

  it("penalizza un ritmo troppo lento in proporzione alla distanza dal range", () => {
    // 10 parole / 20s = 0.5 parole/sec, distanza dal minimo (2.0) = 1.5
    expect(scorePacing(10, 20)).toBe(58); // round(95 - 1.5*25) = round(57.5) = 58
  });

  it("restituisce 0 se la durata è zero o negativa", () => {
    expect(scorePacing(10, 0)).toBe(0);
    expect(scorePacing(10, -5)).toBe(0);
  });
});

describe("scoreClarity", () => {
  it("premia frasi di lunghezza ideale (8-16 parole) senza filler", () => {
    const text = "Uno due tre quattro cinque sei sette otto nove dieci.";
    expect(scoreClarity(text)).toBe(90);
  });

  it("penalizza la presenza di filler words rispetto allo stesso testo senza", () => {
    const clean = "Uno due tre quattro cinque sei sette otto nove dieci.";
    const withFillers = "Cioè uno due tre quattro cinque sei sette otto nove dieci, tipo.";
    expect(scoreClarity(withFillers)).toBeLessThan(scoreClarity(clean));
  });
});

describe("scoreStandalone", () => {
  it("premia una frase autonoma che si chiude con punteggiatura", () => {
    expect(scoreStandalone("Questo è un punto completo.")).toBe(90); // 70 + 20
  });

  it("penalizza una frase che inizia con una congiunzione e non si chiude", () => {
    expect(scoreStandalone("e quindi abbiamo capito")).toBe(40); // 70 - 20 - 10
  });
});

describe("buildCandidateWindows", () => {
  it("combina segmenti contigui rispettando durata minima e massima", () => {
    const segments: TranscriptSegment[] = [
      { start: 0, end: 5, text: "Uno", words: [] },
      { start: 5, end: 10, text: "Due", words: [] },
      { start: 10, end: 15, text: "Tre", words: [] },
    ];

    const windows = buildCandidateWindows(segments, 8, 12);

    expect(windows).toEqual([
      { startSeconds: 0, endSeconds: 10, text: "Uno Due", wordCount: 2 },
      { startSeconds: 5, endSeconds: 15, text: "Due Tre", wordCount: 2 },
    ]);
  });

  it("non produce finestre se nessuna combinazione raggiunge la durata minima", () => {
    const segments: TranscriptSegment[] = [
      { start: 0, end: 2, text: "Breve", words: [] },
      { start: 2, end: 4, text: "Anche questo", words: [] },
    ];
    expect(buildCandidateWindows(segments, 100, 200)).toEqual([]);
  });
});

describe("sceneChangeHookBonus", () => {
  it("non dà bonus se non ci sono dati sui cambi di inquadratura", () => {
    expect(sceneChangeHookBonus(undefined, 10)).toBe(0);
    expect(sceneChangeHookBonus([], 10)).toBe(0);
  });

  it("dà il bonus se un cambio di inquadratura cade entro la tolleranza dall'inizio della finestra", () => {
    expect(sceneChangeHookBonus([9.5, 40], 10)).toBe(8);
  });

  it("non dà bonus se il cambio più vicino è fuori dalla tolleranza", () => {
    expect(sceneChangeHookBonus([5, 40], 10)).toBe(0);
  });
});

describe("sceneChangeDensityBonus", () => {
  it("non dà bonus se non ci sono dati sui cambi di inquadratura", () => {
    expect(sceneChangeDensityBonus(undefined, 0, 20)).toBe(0);
  });

  it("cresce con la densità di tagli dentro la finestra", () => {
    // 1 taglio ogni 10s nella finestra (10s totali, 1 taglio) = bonus massimo.
    expect(sceneChangeDensityBonus([5], 0, 10)).toBe(10);
  });

  it("satura al massimo anche con densità molto più alta", () => {
    expect(sceneChangeDensityBonus([1, 2, 3, 4, 5, 6, 7, 8, 9], 0, 10)).toBe(10);
  });

  it("ignora i cambi di inquadratura fuori dalla finestra", () => {
    expect(sceneChangeDensityBonus([100], 0, 10)).toBe(0);
  });
});
