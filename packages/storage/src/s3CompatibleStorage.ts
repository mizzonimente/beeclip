import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";
import type { StorageAdapter } from "./types.js";

/**
 * Storage compatibile S3: funziona inalterato con AWS S3, Cloudflare R2 o
 * MinIO self-hosted (tutti parlano lo stesso protocollo), cambiando solo
 * endpoint/credenziali in `.env`.
 */
export class S3CompatibleStorage implements StorageAdapter {
  readonly name = "s3" as const;
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    region: string,
    endpoint?: string,
    accessKeyId?: string,
    secretAccessKey?: string
  ) {
    this.client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: !!endpoint, // richiesto da MinIO/R2 con endpoint custom
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });
  }

  async putObjectFromFile(key: string, filePath: string, contentType?: string): Promise<void> {
    const { readFile } = await import("node:fs/promises");
    const body = await readFile(filePath);
    await this.putObjectFromBuffer(key, body, contentType);
  }

  async putObjectFromBuffer(key: string, data: Buffer, contentType?: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType })
    );
  }

  async putObjectFromStream(key: string, stream: NodeJS.ReadableStream, contentType?: string): Promise<void> {
    // Niente PutObjectCommand qui: con un Body in streaming la lunghezza non
    // è nota in anticipo, e l'SDK v3 (checksum "flexible" attivati di
    // default su alcune versioni) finisce per calcolare l'header
    // "x-amz-decoded-content-length" come undefined, causando un 500
    // (ERR_HTTP_INVALID_HEADER_VALUE) ad ogni upload. `Upload` di
    // @aws-sdk/lib-storage è il pattern raccomandato da AWS per stream di
    // lunghezza ignota: gestisce internamente un multipart upload e non ha
    // bisogno di ContentLength.
    const upload = new Upload({
      client: this.client,
      params: { Bucket: this.bucket, Key: key, Body: stream as Readable, ContentType: contentType },
    });
    await upload.done();
  }

  async downloadToTempFile(key: string): Promise<string> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const dest = join(tmpdir(), `clipmanager-${randomUUID()}-${key.split("/").pop()}`);
    await mkdir(dirname(dest), { recursive: true });
    await new Promise<void>((resolve, reject) => {
      const out = createWriteStream(dest);
      (res.Body as Readable).pipe(out);
      out.on("error", reject);
      out.on("finish", () => resolve());
    });
    return dest;
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
}
