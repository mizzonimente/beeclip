import { readFile } from "node:fs/promises";
import type { TrendProvider, TrendFetchInput } from "./types.js";
import type { DailyTrendSnapshot } from "@clipmanager/shared";

interface CuratedFeedFile {
  lastUpdated: string; // YYYY-MM-DD
  note: string;
  platforms: Record<
    string,
    {
      trendingSounds: Array<{ name: string; usageGrowthPct: number }>;
      emergingHashtags: string[];
      viralFormats: Array<{ name: string; description: string }>;
      growingNiches: string[];
    }
  >;
}

/**
 * Provider "CURATED": legge un file JSON aggiornato manualmente dal team
 * (operazione reale di lettura/parsing, nessun dato inventato a runtime).
 * E' la soluzione onesta per avere trend utili in v1 senza un accordo
 * commerciale con un provider con licenza: qualcuno in azienda osserva le
 * piattaforme e aggiorna il file periodicamente.
 *
 * Segnala esplicitamente se il file e' piu' vecchio di
 * `maxAgeDays` (default 14), cosi' la UI puo' avvisare l'utente che il
 * trend mostrato potrebbe non essere piu' attuale — trasparenza invece di
 * far credere che sia un dato live.
 */
export class CuratedFeedTrendProvider implements TrendProvider {
  readonly name = "curated-feed";

  constructor(
    private readonly filePath: string,
    private readonly maxAgeDays: number = 14
  ) {}

  supports(_input: TrendFetchInput): boolean {
    return true;
  }

  async fetchTrends(input: TrendFetchInput): Promise<DailyTrendSnapshot> {
    const raw = await readFile(this.filePath, "utf-8");
    const parsed = JSON.parse(raw) as CuratedFeedFile;
    const platformData = parsed.platforms[input.platform];
    if (!platformData) {
      throw new Error(`Nessun dato curato per la piattaforma ${input.platform} in ${this.filePath}`);
    }

    const lastUpdated = new Date(parsed.lastUpdated);
    const ageDays = (input.date.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    const isStale = ageDays > this.maxAgeDays;

    return {
      platform: input.platform,
      trendingSounds: platformData.trendingSounds,
      emergingHashtags: isStale
        ? [...platformData.emergingHashtags, "__STALE_DATA__"]
        : platformData.emergingHashtags,
      viralFormats: platformData.viralFormats,
      growingNiches: platformData.growingNiches,
      source: "CURATED",
    };
  }
}
