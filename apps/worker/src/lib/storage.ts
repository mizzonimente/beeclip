import { createStorageAdapter, type StorageAdapter } from "@clipmanager/storage";
import type { Env } from "../env.js";

// Stesso pattern singleton di apps/api/src/lib/storage.ts.
let instance: StorageAdapter | null = null;

export function getStorage(env: Env): StorageAdapter {
  if (!instance) instance = createStorageAdapter(env);
  return instance;
}
