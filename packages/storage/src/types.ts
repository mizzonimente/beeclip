/**
 * Astrazione di storage: lo stesso contratto serve sia in sviluppo (disco
 * locale) sia in produzione (S3/Cloudflare R2/MinIO). I moduli che
 * elaborano video (worker, ffmpeg) lavorano sempre su un percorso file
 * locale: `downloadToTempFile` materializza l'oggetto su disco quando serve
 * (no-op/copia per il driver locale, download reale per S3).
 */
export interface StorageAdapter {
  readonly name: "local" | "s3";

  /** Carica un file già su disco (es. output ffmpeg) sotto la chiave data. */
  putObjectFromFile(key: string, filePath: string, contentType?: string): Promise<void>;

  /** Carica dati in memoria (es. file multipart piccolo) sotto la chiave data. */
  putObjectFromBuffer(key: string, data: Buffer, contentType?: string): Promise<void>;

  /** Scrive un body in streaming (multipart upload) sotto la chiave data, senza caricare tutto in RAM. */
  putObjectFromStream(key: string, stream: NodeJS.ReadableStream, contentType?: string): Promise<void>;

  /** Materializza l'oggetto come file locale temporaneo; il chiamante è responsabile della pulizia. */
  downloadToTempFile(key: string): Promise<string>;

  /** URL firmato e a scadenza per il download diretto da client (browser). */
  getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;

  deleteObject(key: string): Promise<void>;

  exists(key: string): Promise<boolean>;
}

export function buildObjectKey(parts: { userId: string; projectId: string; videoId?: string; clipId?: string; filename: string }): string {
  const segments = [parts.userId, parts.projectId, parts.videoId, parts.clipId, parts.filename].filter(Boolean);
  return segments.join("/");
}
