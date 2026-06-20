import { createStorageAdapter, type StorageAdapter } from "@clipmanager/storage";
import type { Env } from "../env.js";

let instance: StorageAdapter | null = null;

export function getStorage(env: Env): StorageAdapter {
  if (!instance) instance = createStorageAdapter(env);
  return instance;
}
