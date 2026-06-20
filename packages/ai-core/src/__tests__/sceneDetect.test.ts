import { describe, expect, it } from "vitest";
import { parseSceneChangeTimestamps, dedupeSceneChanges } from "../ffmpeg/sceneDetect.js";

// `detectSceneChanges` chiama realmente ffmpeg (richiede un binario esterno e
// un file video), quindi non è testabile come funzione pura in un test
// unitario: va verificata con un test di integrazione a parte (stesso
// approccio già usato per `detectSilences` in silenceDetect.test.ts).
// `parseSceneChangeTimestamps` e `dedupeSceneChanges` invece sono pure e
// sono quelle che testiamo qui.

describe("parseSceneChangeTimestamps", () => {
  it("estrae i timestamp dalle righe showinfo di ffmpeg", () => {
    const stderr = [
      "[Parsed_showinfo_1 @ 0x55f] n:   0 pts:      0 pts_time:0      ",
      "[Parsed_showinfo_1 @ 0x55f] n:   1 pts:  12000 pts_time:5.5    ",
      "[Parsed_showinfo_1 @ 0x55f] n:   2 pts:  30000 pts_time:12.345 ",
    ].join("\n");
    expect(parseSceneChangeTimestamps(stderr)).toEqual([0, 5.5, 12.345]);
  });

  it("ignora righe di log che non sono di showinfo", () => {
    const stderr = [
      "frame=  120 fps= 30 q=-1.0 size=     256kB time=00:00:04.00 bitrate= 524.3kbits/s",
      "[Parsed_showinfo_1 @ 0x55f] n:   0 pts_time:3.2",
    ].join("\n");
    expect(parseSceneChangeTimestamps(stderr)).toEqual([3.2]);
  });

  it("restituisce un array vuoto se non ci sono cambi rilevati", () => {
    expect(parseSceneChangeTimestamps("nessun frame selezionato")).toEqual([]);
  });
});

describe("dedupeSceneChanges", () => {
  it("unisce rilevazioni troppo vicine tenendo solo la prima del gruppo", () => {
    expect(dedupeSceneChanges([1.0, 1.2, 1.4, 10.0], 0.5)).toEqual([1.0, 10.0]);
  });

  it("non modifica timestamp già ben separati", () => {
    expect(dedupeSceneChanges([0, 5, 10, 15], 0.5)).toEqual([0, 5, 10, 15]);
  });

  it("ordina l'input anche se arriva fuori ordine", () => {
    expect(dedupeSceneChanges([10, 0, 5], 0.5)).toEqual([0, 5, 10]);
  });

  it("gestisce un array vuoto", () => {
    expect(dedupeSceneChanges([], 0.5)).toEqual([]);
  });
});
