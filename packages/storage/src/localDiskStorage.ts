import { createHmac, timingSafeEqual } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, copyFile, rm, access, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { StorageAdapter } from "./types.js";

/**
 * Storage su disco locale per lo sviluppo: zero setup, stesso contratto del
 * driver S3 cosi' il resto del sistema non sa (e non deve sapere) quale
 * backend e' attivo.
 *
 * "URL firmati" qui non possono essere reali presigned URL S3 (non esiste un
 * provider cloud dietro), ma non sono nemmeno finti: generiamo un token
 * HMAC-SHA256 con scadenza, verificato lato API nella route statica di
 * download (vedi apps/api/src/routes/files.ts). E' un meccanismo di
 * autorizzazione reale, non un placeholder.
 */
export class LocalDiskStorage implements StorageAdapter {
  readonly name = "local" as const;

  constructor(
    private readonly rootDir: string,
    private readonly signingSecret: string
  ) {}

  private absolutePath(key: string): string {
    const safeKey = key.replace(/\.\./g, "");
    return resolve(this.rootDir, safeKey);
  }

  async putObjectFromFile(key: string, filePath: string): Promise<void> {
    const dest = this.absolutePath(key);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(filePath, dest);
  }

  async putObjectFromBuffer(key: string, data: Buffer): Promise<void> {
    const dest = this.absolutePath(key);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, data);
  }

  async putObjectFromStream(key: string, stream: NodeJS.ReadableStream): Promise<void> {
    const dest = this.absolutePath(key);
    await mkdir(dirname(dest), { recursive: true });
    await new Promise<void>((res, rej) => {
      const out = createWriteStream(dest);
      stream.pipe(out);
      stream.on("error", rej);
      out.on("error", rej);
      out.on("finish", () => res());
    });
  }

  async downloadToTempFile(key: string): Promise<string> {
    const src = this.absolutePath(key);
    const dest = join(tmpdir(), `clipmanager-${randomUUID()}-${key.split("/").pop()}`);
    await copyFile(src, dest);
    return dest;
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const exp = Date.now() + expiresInSeconds * 1000;
    const token = this.signToken(key, exp);
    return `/files/${key}?exp=${exp}&token=${token}`;
  }

  async deleteObject(key: string): Promise<void> {
    await rm(this.absolutePath(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.absolutePath(key));
      return true;
    } catch {
      return false;
    }
  }

  /** Usato dalla route statica `apps/api/src/routes/files.ts` per validare il token prima di servire il file. */
  verifyToken(key: string, exp: number, token: string): boolean {
    if (Date.now() > exp) return false;
    const expected = this.signToken(key, exp);
    const a = Buffer.from(expected);
    const b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  resolvePathForServing(key: string): string {
    return this.absolutePath(key);
  }

  private signToken(key: string, exp: number): string {
    return createHmac("sha256", this.signingSecret).update(`${key}:${exp}`).digest("hex");
  }
}
