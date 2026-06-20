import { z } from "zod";

// Stesso pattern di apps/api/src/env.ts: fail-fast all'avvio con un errore
// leggibile invece di un crash a metà job con una variabile mancante.
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  // Usato solo per derivare il segreto di firma delle URL del driver locale
  // (vedi @clipmanager/storage) — lo stesso valore configurato in apps/api.
  JWT_ACCESS_SECRET: z.string().min(8),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_PATH: z.string().default("../../storage/local"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  TRANSCRIPTION_PROVIDER: z.string().default("mock"),
  OPENAI_API_KEY: z.string().optional(),
  ANALYSIS_PROVIDER: z.string().default("mock"),
  ANTHROPIC_API_KEY: z.string().optional(),

  SOCIAL_DATA_PROVIDER: z.string().default("mock"),
  SOCIAL_DATA_PROVIDER_API_KEY: z.string().optional(),
  TREND_DATA_PROVIDER: z.string().default("mock"),
  TREND_DATA_PROVIDER_API_KEY: z.string().optional(),
  TREND_CURATED_FEED_PATH: z.string().optional(),
  TREND_CURATED_MAX_AGE_DAYS: z.string().optional(),

  // Face-tracking reale (rilevamento volto per-fotogramma) per il crop
  // SMART: di default disattivato perché aumenta sensibilmente il tempo di
  // elaborazione di ogni clip (decodifica fotogrammi campione + inferenza
  // del modello, per ogni candidato). Quando disattivato o in caso di
  // errore/nessun volto rilevato, il crop SMART ricade sul comportamento
  // statico esistente (vedi apps/worker/src/processors/videoProcessing.ts).
  FACE_TRACKING_ENABLED: z.coerce.boolean().default(false),

  // Concorrenza dei processor BullMQ: il video-processing è il più pesante
  // (ffmpeg + AI), tenuto basso di default per non saturare la CPU di una
  // singola istanza worker in sviluppo.
  WORKER_VIDEO_CONCURRENCY: z.coerce.number().default(2),
  WORKER_CLIP_EXPORT_CONCURRENCY: z.coerce.number().default(3),
  WORKER_SOCIAL_CONCURRENCY: z.coerce.number().default(2),
  WORKER_TREND_CONCURRENCY: z.coerce.number().default(1),

  NODE_ENV: z.string().default("development"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Variabili d'ambiente non valide:", parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}
