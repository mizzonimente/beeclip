import { Queue } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_NAMES } from "@clipmanager/shared";
import type { Env } from "../env.js";

let connection: IORedis | null = null;
let queues: Record<string, Queue> | null = null;

function getConnection(env: Env): IORedis {
  if (!connection) connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  return connection;
}

/** Code BullMQ condivise: l'API fa solo `add`, il worker le consuma. */
export function getQueues(env: Env) {
  if (queues) return queues;
  const conn = getConnection(env);
  queues = {
    [QUEUE_NAMES.VIDEO_PROCESSING]: new Queue(QUEUE_NAMES.VIDEO_PROCESSING, { connection: conn }),
    [QUEUE_NAMES.CLIP_EXPORT]: new Queue(QUEUE_NAMES.CLIP_EXPORT, { connection: conn }),
    [QUEUE_NAMES.TREND_REFRESH]: new Queue(QUEUE_NAMES.TREND_REFRESH, { connection: conn }),
    [QUEUE_NAMES.SOCIAL_PROFILE_REFRESH]: new Queue(QUEUE_NAMES.SOCIAL_PROFILE_REFRESH, { connection: conn }),
  };
  return queues;
}
