import { resolve } from "node:path";
import type { StorageAdapter } from "./types.js";
import { LocalDiskStorage } from "./localDiskStorage.js";
import { S3CompatibleStorage } from "./s3CompatibleStorage.js";

export * from "./types.js";
export { LocalDiskStorage } from "./localDiskStorage.js";
export { S3CompatibleStorage } from "./s3CompatibleStorage.js";
export {
  extractDriveFileId,
  downloadPublicDriveFile,
  DriveDownloadError,
  type DriveDownloadResult,
} from "./driveIngest.js";

export function createStorageAdapter(env: {
  STORAGE_DRIVER?: string;
  LOCAL_STORAGE_PATH?: string;
  JWT_ACCESS_SECRET?: string;
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
}): StorageAdapter {
  if (env.STORAGE_DRIVER === "s3") {
    if (!env.S3_BUCKET) throw new Error("STORAGE_DRIVER=s3 richiede S3_BUCKET");
    return new S3CompatibleStorage(
      env.S3_BUCKET,
      env.S3_REGION ?? "auto",
      env.S3_ENDPOINT,
      env.S3_ACCESS_KEY_ID,
      env.S3_SECRET_ACCESS_KEY
    );
  }
  const rootDir = resolve(env.LOCAL_STORAGE_PATH ?? "../../storage/local");
  const signingSecret = env.JWT_ACCESS_SECRET ?? "dev-only-insecure-secret";
  return new LocalDiskStorage(rootDir, signingSecret);
}
