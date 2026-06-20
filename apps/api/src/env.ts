import { z } from "zod";

// Validazione esplicita delle variabili d'ambiente all'avvio: l'app fallisce
// subito con un errore leggibile invece di comportarsi in modo imprevedibile
// più avanti con una variabile mancante.
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),

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

  API_PORT: z.coerce.number().default(4000),
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
