// Costanti condivise tra api / worker / web.
// Centralizzate qui per evitare che limiti di piano o aspect ratio
// divergano tra backend e frontend.

export const CLIP_FORMATS = {
  VERTICAL_9_16: { label: "Verticale 9:16 (TikTok, Reels, Shorts)", width: 1080, height: 1920 },
  SQUARE_1_1: { label: "Quadrato 1:1", width: 1080, height: 1080 },
  HORIZONTAL_16_9: { label: "Orizzontale 16:9", width: 1920, height: 1080 },
  VERTICAL_4_5: { label: "Verticale 4:5", width: 1080, height: 1350 },
  CUSTOM: { label: "Crop personalizzato", width: null, height: null },
} as const;

export type ClipFormatKey = keyof typeof CLIP_FORMATS;

export const CONTENT_TYPES = [
  "EDUCATIONAL",
  "ENTERTAINMENT",
  "PROMO",
  "PODCAST",
  "INTERVIEW",
  "VLOG",
  "BACKSTAGE",
  "MUSIC",
  "CORPORATE",
  "CREATOR",
] as const;

export type ContentTypeKey = (typeof CONTENT_TYPES)[number];

// Pesi dei criteri di scoring per tipo di contenuto: un podcast/intervista
// privilegia chiarezza e autonomia del segmento, l'entertainment privilegia
// hook ed emozione. Usati sia dal provider AI reale (nel prompt) sia
// dall'euristica di fallback (calcolo pesato esplicito).
export const SCORING_WEIGHTS_BY_CONTENT_TYPE: Record<
  ContentTypeKey,
  { hook: number; emotion: number; retention: number; pacing: number; clarity: number; standalone: number }
> = {
  EDUCATIONAL:    { hook: 0.20, emotion: 0.10, retention: 0.15, pacing: 0.10, clarity: 0.30, standalone: 0.15 },
  ENTERTAINMENT:  { hook: 0.30, emotion: 0.30, retention: 0.15, pacing: 0.15, clarity: 0.05, standalone: 0.05 },
  PROMO:          { hook: 0.30, emotion: 0.15, retention: 0.10, pacing: 0.10, clarity: 0.20, standalone: 0.15 },
  PODCAST:        { hook: 0.20, emotion: 0.15, retention: 0.15, pacing: 0.10, clarity: 0.20, standalone: 0.20 },
  INTERVIEW:      { hook: 0.20, emotion: 0.20, retention: 0.10, pacing: 0.10, clarity: 0.20, standalone: 0.20 },
  VLOG:           { hook: 0.25, emotion: 0.25, retention: 0.15, pacing: 0.15, clarity: 0.10, standalone: 0.10 },
  BACKSTAGE:      { hook: 0.25, emotion: 0.25, retention: 0.10, pacing: 0.15, clarity: 0.10, standalone: 0.15 },
  MUSIC:          { hook: 0.35, emotion: 0.25, retention: 0.10, pacing: 0.20, clarity: 0.00, standalone: 0.10 },
  CORPORATE:      { hook: 0.20, emotion: 0.10, retention: 0.10, pacing: 0.10, clarity: 0.30, standalone: 0.20 },
  CREATOR:        { hook: 0.25, emotion: 0.20, retention: 0.15, pacing: 0.15, clarity: 0.15, standalone: 0.10 },
};

export const DEFAULT_MIN_CLIP_SECONDS = 15;
export const DEFAULT_MAX_CLIP_SECONDS = 90;
export const DEFAULT_AVG_CLIP_SECONDS = 45;

export const PLAN_DEFAULTS = {
  FREE:    { minutesPerMonth: 30,  clipsPerMonth: 15,  maxReferenceProfiles: 1,  maxExportResolution: "720p" },
  STARTER: { minutesPerMonth: 180, clipsPerMonth: 100, maxReferenceProfiles: 3,  maxExportResolution: "1080p" },
  PRO:     { minutesPerMonth: 600, clipsPerMonth: 400, maxReferenceProfiles: 10, maxExportResolution: "1080p" },
  AGENCY:  { minutesPerMonth: 2000,clipsPerMonth: 1500,maxReferenceProfiles: 50, maxExportResolution: "4k" },
} as const;

// Piattaforme per cui generiamo trend giornalieri: sottoinsieme di
// SocialPlatform (schema.prisma) che esclude "OTHER", perché non esiste una
// fonte trend dedicata (né reale né mock) per una piattaforma generica.
// Centralizzato qui (invece che duplicato in apps/api/src/routes/trends.ts e
// apps/worker/src/processors/trendRefresh.ts) così l'elenco non può
// disallinearsi tra le due app; packages/ai-core lo ri-esporta come
// `TrendPlatformKey` per chi consuma solo il tipo.
export const TREND_PLATFORMS = ["TIKTOK", "INSTAGRAM", "YOUTUBE_SHORTS", "LINKEDIN", "FACEBOOK"] as const;

export type TrendPlatformKey = (typeof TREND_PLATFORMS)[number];

// Nomi delle code BullMQ: condivisi tra apps/api (che fa l'enqueue) e
// apps/worker (che le consuma), così non possono disallinearsi.
export const QUEUE_NAMES = {
  VIDEO_PROCESSING: "video-processing",
  CLIP_EXPORT: "clip-export",
  TREND_REFRESH: "trend-refresh",
  SOCIAL_PROFILE_REFRESH: "social-profile-refresh",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
