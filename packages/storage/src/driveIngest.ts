import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";

// Import da Google Drive — SOLO link pubblici ("chiunque abbia il link"),
// nessuna API key/OAuth richiesta. Non usiamo le API ufficiali Google Drive
// (che richiederebbero credenziali Google Cloud Console) ma l'endpoint di
// download diretto che Drive esponeva già ai browser: stesso identico file
// che l'utente scaricherebbe cliccando "Scarica" sulla pagina pubblica, solo
// fatto da un server. Nessuno scraping di contenuti protetti: funziona solo
// se l'owner del file ha scelto esplicitamente la condivisione pubblica.

const DRIVE_HOSTNAMES = new Set(["drive.google.com", "docs.google.com"]);

/**
 * Estrae l'ID file da un link di condivisione Google Drive.
 * Formati supportati:
 *  - https://drive.google.com/file/d/<ID>/view?usp=sharing
 *  - https://drive.google.com/open?id=<ID>
 *  - https://drive.google.com/uc?id=<ID>&export=download
 * Ritorna null se l'URL non è un link Drive o non contiene un ID riconoscibile.
 */
export function extractDriveFileId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!DRIVE_HOSTNAMES.has(url.hostname)) return null;

  const pathMatch = url.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (pathMatch) return pathMatch[1];

  const idParam = url.searchParams.get("id");
  if (idParam) return idParam;

  return null;
}

export class DriveDownloadError extends Error {}

export interface DriveDownloadResult {
  stream: NodeJS.ReadableStream;
  contentType: string;
  /** Nome file originale se Drive lo espone via Content-Disposition, altrimenti null. */
  filename: string | null;
  /** Dimensione in byte se nota dall'header Content-Length, altrimenti null. */
  sizeBytes: number | null;
}

/**
 * Scarica un file pubblico da Google Drive in streaming.
 *
 * Usa `confirm=t` per saltare la pagina HTML intermedia che Drive mostra sui
 * file grandi ("impossibile eseguire la scansione antivirus, scarica
 * comunque?"): senza quel parametro, per i file oltre ~100MB l'endpoint
 * risponde con una pagina di conferma invece del binario.
 */
export async function downloadPublicDriveFile(fileId: string): Promise<DriveDownloadResult> {
  const url = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;

  let res: Response;
  try {
    res = await fetch(url, { redirect: "follow" });
  } catch (err) {
    throw new DriveDownloadError(
      `Impossibile contattare Google Drive: ${err instanceof Error ? err.message : "errore di rete"}`
    );
  }

  if (!res.ok) {
    throw new DriveDownloadError(`Google Drive ha risposto con errore ${res.status}`);
  }

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  // Drive restituisce una pagina HTML (non il binario) quando il file non è
  // condiviso pubblicamente, non esiste, o richiede un login Google. In quel
  // caso meglio fallire con un messaggio chiaro che salvare una pagina di
  // errore come se fosse un video.
  if (contentType.includes("text/html")) {
    throw new DriveDownloadError(
      "Il link non è scaricabile pubblicamente. Su Google Drive, imposta la condivisione del file su 'Chiunque abbia il link' e riprova."
    );
  }

  if (!res.body) {
    throw new DriveDownloadError("Google Drive ha risposto senza contenuto.");
  }

  const disposition = res.headers.get("content-disposition");
  const filenameMatch = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : null;

  const lengthHeader = res.headers.get("content-length");
  const sizeBytes = lengthHeader ? Number(lengthHeader) : null;

  return {
    stream: Readable.fromWeb(res.body as NodeWebReadableStream),
    contentType,
    filename,
    sizeBytes,
  };
}
