import { z } from "zod";
import { CONTENT_TYPES } from "./constants.js";

// ── Auth ─────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri"),
  name: z.string().min(1),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ── Progetti ─────────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  industry: z.string().optional(),
  contentGoal: z.string().optional(),
  targetAudience: z.string().optional(),
  contentType: z.enum(CONTENT_TYPES).default("CREATOR"),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// ── Upload video / configurazione generazione clip ─────────────────────────

export const clipGenerationConfigSchema = z
  .object({
    mode: z.enum(["AUTO", "MANUAL"]).default("AUTO"),
    desiredClipCount: z.number().int().min(1).max(50).optional(),
    avgClipDurationSeconds: z.number().int().min(5).max(600).optional(),
    minClipDurationSeconds: z.number().int().min(5).max(600).default(15),
    maxClipDurationSeconds: z.number().int().min(5).max(600).default(90),
    formats: z
      .array(z.enum(["VERTICAL_9_16", "SQUARE_1_1", "HORIZONTAL_16_9", "VERTICAL_4_5", "CUSTOM"]))
      .min(1)
      .default(["VERTICAL_9_16"]),
  })
  .refine((v) => v.minClipDurationSeconds <= v.maxClipDurationSeconds, {
    message: "minClipDurationSeconds deve essere <= maxClipDurationSeconds",
  });
export type ClipGenerationConfig = z.infer<typeof clipGenerationConfigSchema>;

export const uploadVideoMetaSchema = z.object({
  projectId: z.string().min(1),
  contentType: z.enum(CONTENT_TYPES).optional(),
  generationConfig: clipGenerationConfigSchema.optional(),
});
export type UploadVideoMeta = z.infer<typeof uploadVideoMetaSchema>;

// Import da link pubblico Google Drive: stessi metadati dell'upload da file,
// più l'URL da cui scaricare. Niente schema equivalente per YouTube/social:
// non esiste un modo di scaricare automaticamente da quelle piattaforme senza
// fare scraping non autorizzato (vedi docs/02-architecture.md §7), quindi il
// backend non offre quella scorciatoia — solo l'upload manuale del file.
export const createVideoFromDriveLinkSchema = z.object({
  projectId: z.string().min(1),
  driveUrl: z.string().url("Inserisci un link Google Drive valido"),
  contentType: z.enum(CONTENT_TYPES).optional(),
  generationConfig: clipGenerationConfigSchema.optional(),
});
export type CreateVideoFromDriveLinkInput = z.infer<typeof createVideoFromDriveLinkSchema>;

// ── Profili social ───────────────────────────────────────────────────────

export const createSocialProfileSchema = z.object({
  type: z.enum(["OWN", "REFERENCE"]),
  platform: z.enum(["TIKTOK", "INSTAGRAM", "YOUTUBE_SHORTS", "LINKEDIN", "FACEBOOK", "OTHER"]),
  handle: z.string().min(1),
  connectedVia: z.enum(["OAUTH", "MANUAL", "LICENSED_PROVIDER"]).default("MANUAL"),
});
export type CreateSocialProfileInput = z.infer<typeof createSocialProfileSchema>;

// ── Export clip ──────────────────────────────────────────────────────────

export const exportClipSchema = z.object({
  format: z.enum(["VERTICAL_9_16", "SQUARE_1_1", "HORIZONTAL_16_9", "VERTICAL_4_5", "CUSTOM"]),
  cropMode: z.enum(["CENTER", "SMART", "MANUAL"]).default("SMART"),
  customCrop: z
    .object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
    .optional(),
});
export type ExportClipInput = z.infer<typeof exportClipSchema>;
