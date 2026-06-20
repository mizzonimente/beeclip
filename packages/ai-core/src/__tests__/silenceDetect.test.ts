import { describe, expect, it } from "vitest";
import { speechIntervalsFromSilences } from "../ffmpeg/silenceDetect.js";

// `detectSilences` chiama realmente ffmpeg (richiede un binario esterno e un
// file video), quindi non è testabile come funzione pura in un test unitario:
// va verificata con un test di integrazione a parte. `speechIntervalsFromSilences`
// invece è pura (puro calcolo del complemento dei silenzi) ed è quella che
// testiamo qui.

describe("speechIntervalsFromSilences", () => {
  it("ricava i beat di parlato come complemento dei silenzi", () => {
    const beats = speechIntervalsFromSilences([{ start: 5, end: 7 }], 20, 1.5);
    expect(beats).toEqual([
      { start: 0, end: 5 },
      { start: 7, end: 20 },
    ]);
  });

  it("scarta i beat più corti della durata minima richiesta", () => {
    // Silenzio da 0.5s a 1s: il beat iniziale (0-0.5s) è troppo corto e va scartato.
    const beats = speechIntervalsFromSilences([{ start: 0.5, end: 1 }], 10, 1.5);
    expect(beats).toEqual([{ start: 1, end: 10 }]);
  });

  it("restituisce un unico beat se non ci sono silenzi", () => {
    expect(speechIntervalsFromSilences([], 30, 1.5)).toEqual([{ start: 0, end: 30 }]);
  });

  it("gestisce silenzi consecutivi senza generare beat negativi o duplicati", () => {
    const beats = speechIntervalsFromSilences(
      [
        { start: 2, end: 4 },
        { start: 4, end: 6 },
      ],
      10,
      1.5
    );
    // Nessun parlato tra 2 e 6 (silenzi contigui): un solo beat iniziale scartato
    // (0-2 < 1.5? no, 2>=1.5 quindi è valido) e uno finale.
    expect(beats).toEqual([
      { start: 0, end: 2 },
      { start: 6, end: 10 },
    ]);
  });
});
