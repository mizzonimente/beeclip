import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import { Queue, Worker } from "bullmq";
import { QUEUE_NAMES } from "@clipmanager/shared";
import type { VideoProcessingPayload } from "./processors/videoProcessing.js";
import type { ClipExportPayload } from "./processors/clipExport.js";
import type { SocialProfileRefreshPayload } from "./processors/socialProfileRefresh.js";
import type { TrendRefreshPayload } from "./processors/trendRefresh.js";

// Stesso motivo di apps/api/src/server.ts: i quattro processor importano
// `@clipmanager/db`, il cui `client.ts` esegue `new PrismaClient()` a
// livello di modulo. Un `import "dotenv/config"` in testa al file non
// basterebbe — in ESM l'intero albero delle dipendenze statiche viene
// valutato prima del corpo di questo modulo, quindi Prisma leggerebbe
// `DATABASE_URL` prima che fosse popolata. Carichiamo perciò `env.js`,
// `lib/redis.js` e i processor con un `import()` dinamico, dopo aver
// popolato `process.env` con `dotenv.config()`. `bullmq` e
// `@clipmanager/shared` non leggono variabili d'ambiente al caricamento del
// modulo, quindi restano import statici.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const { loadEnv } = await import("./env.js");
const { getConnection } = await import("./lib/redis.js");
const { processVideoJob } = await import("./processors/videoProcessing.js");
const { processClipExportJob } = await import("./processors/clipExport.js");
const { processSocialProfileRefreshJob } = await import("./processors/socialProfileRefresh.js");
const { processTrendRefreshJob } = await import("./processors/trendRefresh.js");

const env = loadEnv();
const connection = getConnection(env);

// ── Un Worker BullMQ per coda, concorrenza configurabile via env (vedi
// apps/worker/src/env.ts: video-processing è il più pesante per CPU/IO
// perché combina ffmpeg e provider AI, quindi ha il default più basso). ──
const videoWorker = new Worker<VideoProcessingPayload>(
  QUEUE_NAMES.VIDEO_PROCESSING,
  (job) => processVideoJob(job, env),
  { connection, concurrency: env.WORKER_VIDEO_CONCURRENCY }
);

const clipExportWorker = new Worker<ClipExportPayload>(
  QUEUE_NAMES.CLIP_EXPORT,
  (job) => processClipExportJob(job, env),
  { connection, concurrency: env.WORKER_CLIP_EXPORT_CONCURRENCY }
);

const socialWorker = new Worker<SocialProfileRefreshPayload>(
  QUEUE_NAMES.SOCIAL_PROFILE_REFRESH,
  (job) => processSocialProfileRefreshJob(job, env),
  { connection, concurrency: env.WORKER_SOCIAL_CONCURRENCY }
);

const trendWorker = new Worker<TrendRefreshPayload>(
  QUEUE_NAMES.TREND_REFRESH,
  (job) => processTrendRefreshJob(job, env),
  { connection, concurrency: env.WORKER_TREND_CONCURRENCY }
);

const workers = [videoWorker, clipExportWorker, socialWorker, trendWorker];

for (const worker of workers) {
  worker.on("failed", (job, err) => {
    console.error(`[${worker.name}] job ${job?.id ?? "?"} fallito definitivamente:`, err.message);
  });
  worker.on("error", (err) => {
    // Errori del Worker stesso (es. connessione Redis), non di un singolo job.
    console.error(`[${worker.name}] errore worker:`, err);
  });
}

console.log(`ClipManager AI worker avviato. Code attive: ${workers.map((w) => w.name).join(", ")}.`);

/**
 * Cron giornaliero per il refresh dei trend. Registrato come job BullMQ
 * ripetibile (opzione `repeat` su `Queue.add`, supportata dall'intera serie
 * BullMQ v5) invece di un `setInterval` in-process, per due motivi: la
 * pianificazione è persistita in Redis e sopravvive ai riavvii del worker, e
 * resta un singolo schedule condiviso anche se in futuro si scala a più
 * istanze worker (altrimenti N timer in-process finirebbero per duplicare
 * l'esecuzione N volte al giorno).
 *
 * Il job ripetuto (`"daily-cron-tick"`) viene enqueuato SENZA `jobId` nel
 * payload: a differenza del trigger manuale `POST /trends/refresh` (che crea
 * la riga `Job` prima di enqueuare), qui non esiste una richiesta HTTP che
 * possa farlo — `processTrendRefreshJob` (vedi processors/trendRefresh.ts)
 * riconosce l'assenza di `jobId` e crea la riga da sé a ogni esecuzione.
 *
 * `Queue.add` con le stesse opzioni `repeat` è idempotente — BullMQ deriva
 * una chiave dal nome del job + pattern cron + timezone — quindi rieseguire
 * questa funzione a ogni boot del worker non crea schedule duplicati.
 */
async function scheduleDailyTrendRefresh(): Promise<void> {
  const trendQueue = new Queue<TrendRefreshPayload>(QUEUE_NAMES.TREND_REFRESH, { connection });
  // 05:00 ora italiana: prima che gli utenti inizino la giornata, i trend e
  // le idee contenuto in homepage sono già aggiornati.
  await trendQueue.add("daily-cron-tick", {}, { repeat: { pattern: "0 5 * * *", tz: "Europe/Rome" } });
}

scheduleDailyTrendRefresh()
  .then(() => console.log("Cron giornaliero trend registrato (05:00 Europe/Rome)."))
  .catch((err) => console.error("Impossibile registrare il cron giornaliero dei trend:", err));

// ── Spegnimento pulito: lascia terminare i job in corso prima di uscire ──
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Segnale ${signal} ricevuto, chiusura worker in corso...`);
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
