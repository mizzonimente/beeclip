import IORedis from "ioredis";
import type { Env } from "../env.js";

// Connessione Redis condivisa da tutti i Worker BullMQ del processo: evita
// di apgrire N connessioni separate (una per coda) verso lo stesso Redis.
let connection: IORedis | null = null;

export function getConnection(env: Env): IORedis {
  if (!connection) {
    connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return connection;
}
