import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Ogni job video crea una propria directory temporanea isolata (file
 * originale scaricato, audio estratto, clip renderizzate, thumbnail) e la
 * rimuove sempre a fine job, anche in caso di errore — vedi `withTempDir`.
 * Evita sia collisioni tra job concorrenti sia l'accumulo di file orfani sul
 * disco del worker.
 */
export async function withTempDir<T>(prefix: string, fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), `${prefix}-`));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {
      /* best effort: non far fallire il job per un cleanup non riuscito */
    });
  }
}

export function tempPath(dir: string, filename: string): string {
  return join(dir, filename);
}
