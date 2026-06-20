// Etichette in italiano per le chiavi condivise da @clipmanager/shared.
// packages/shared resta agnostico rispetto alla lingua (lo consumano anche
// apps/api e packages/ai-core, dove le chiavi finiscono nei prompt AI in
// inglese): le traduzioni per l'interfaccia vivono solo qui.
import { CONTENT_TYPES, CLIP_FORMATS, TREND_PLATFORMS } from "@clipmanager/shared";
import type { ContentTypeKey, ClipFormatKey, TrendPlatformKey } from "@clipmanager/shared";
import type { SocialPlatformKey, CropModeKey } from "./types";

export const CONTENT_TYPE_LABELS: Record<ContentTypeKey, string> = {
  EDUCATIONAL: "Educational",
  ENTERTAINMENT: "Intrattenimento",
  PROMO: "Promozionale",
  PODCAST: "Podcast",
  INTERVIEW: "Intervista",
  VLOG: "Vlog",
  BACKSTAGE: "Backstage",
  MUSIC: "Musica",
  CORPORATE: "Corporate",
  CREATOR: "Creator",
};

export const CONTENT_TYPE_OPTIONS = CONTENT_TYPES.map((value) => ({
  value,
  label: CONTENT_TYPE_LABELS[value],
}));

export const CLIP_FORMAT_OPTIONS = (Object.keys(CLIP_FORMATS) as ClipFormatKey[]).map((value) => ({
  value,
  label: CLIP_FORMATS[value].label,
}));

export const PLATFORM_LABELS: Record<SocialPlatformKey, string> = {
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
  YOUTUBE_SHORTS: "YouTube Shorts",
  LINKEDIN: "LinkedIn",
  FACEBOOK: "Facebook",
  OTHER: "Altro",
};

export const SOCIAL_PLATFORM_OPTIONS: { value: SocialPlatformKey; label: string }[] = [
  ...TREND_PLATFORMS.map((value) => ({ value, label: PLATFORM_LABELS[value] })),
  { value: "OTHER", label: PLATFORM_LABELS.OTHER },
];

export const TREND_PLATFORM_OPTIONS: { value: TrendPlatformKey; label: string }[] = TREND_PLATFORMS.map((value) => ({
  value,
  label: PLATFORM_LABELS[value],
}));

export const CROP_MODE_LABELS: Record<CropModeKey, string> = {
  CENTER: "Tutto schermo (centrato)",
  SMART: "Tutto schermo (segue il soggetto)",
  MANUAL: "Manuale",
  LETTERBOX: "Orizzontale con bande nere",
};

export const CROP_MODE_OPTIONS = (Object.keys(CROP_MODE_LABELS) as CropModeKey[]).map((value) => ({
  value,
  label: CROP_MODE_LABELS[value],
}));
