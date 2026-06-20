// Tipi che rispecchiano le risposte JSON delle route in apps/api/src/routes/*
// (vedi anche packages/db/prisma/schema.prisma per i modelli sorgente).
// Le Date di Prisma arrivano come stringhe ISO 8601 dopo la serializzazione
// JSON: i campi `*At`/`date` sono quindi `string`, non `Date`.

import type { ContentTypeKey, ClipFormatKey, TrendPlatformKey } from "@clipmanager/shared";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
}

export interface Project {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  industry: string | null;
  contentGoal: string | null;
  targetAudience: string | null;
  contentType: ContentTypeKey;
  createdAt: string;
  updatedAt: string;
  /** Presente solo in GET /projects (list), non nel detail. */
  _count?: { videos: number; clips: number };
}

export interface ContentIdea {
  id: string;
  trendSnapshotId: string;
  projectId: string | null;
  title: string;
  description: string;
  createdAt: string;
}

export interface ProjectDetail extends Project {
  videos: Video[];
  contentIdeas: ContentIdea[];
}

export type VideoStatusKey =
  | "UPLOADED"
  | "EXTRACTING_AUDIO"
  | "TRANSCRIBING"
  | "ANALYZING"
  | "RENDERING_CLIPS"
  | "READY"
  | "FAILED";

export type VideoSourceTypeKey = "FILE_UPLOAD" | "DRIVE_LINK";

export interface Video {
  id: string;
  projectId: string;
  originalFilename: string;
  storageKey: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  status: VideoStatusKey;
  sourceType: VideoSourceTypeKey;
  sourceUrl: string | null;
  errorMessage: string | null;
  desiredClipCount: number | null;
  avgClipDuration: number | null;
  minClipDuration: number;
  maxClipDuration: number;
  createdAt: string;
  updatedAt: string;
  /** Presente solo in dashboard.recentVideos (vedi apps/api/src/routes/dashboard.ts). */
  project?: { title: string };
}

export interface TranscriptWord {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  words: TranscriptWord[];
}

export interface Transcript {
  id: string;
  videoId: string;
  language: string;
  fullText: string;
  segments: TranscriptSegment[];
  provider: string;
  createdAt: string;
}

export interface AnalysisResult {
  id: string;
  clipCandidateId: string;
  viralScore: number;
  viralReasoning: string;
  strengths: string[];
  weaknesses: string[];
  suggestedTitle: string;
  suggestedDescription: string;
  suggestedCaption: string;
  suggestedHook: string;
  suggestedOverlayText: string;
  suggestedCoverHint: string;
  hashtags: string[];
  provider: string;
  createdAt: string;
}

export type ClipStatusKey = "QUEUED" | "RENDERING" | "READY" | "FAILED";
export type CropModeKey = "CENTER" | "SMART" | "MANUAL";

export interface Clip {
  id: string;
  clipCandidateId: string;
  projectId: string;
  format: ClipFormatKey;
  cropMode: CropModeKey;
  customCrop: { x: number; y: number; width: number; height: number } | null;
  storageKey: string | null;
  thumbnailKey: string | null;
  durationSeconds: number | null;
  status: ClipStatusKey;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  /** Presente quando il clip arriva annidato sotto una lista che include il candidate
   * (es. GET /projects/:id/clips, dashboard.recentClips). */
  clipCandidate?: { analysisResult: AnalysisResult | null };
}

export interface ClipCandidate {
  id: string;
  videoId: string;
  startSeconds: number;
  endSeconds: number;
  hookScore: number;
  emotionScore: number;
  retentionScore: number;
  pacingScore: number;
  clarityScore: number;
  standaloneScore: number;
  aggregateScore: number;
  emotionTags: string[];
  rationale: string;
  selected: boolean;
  provider: string;
  createdAt: string;
  analysisResult: AnalysisResult | null;
  clips: Clip[];
}

export interface VideoDetail extends Video {
  transcript: Transcript | null;
  clipCandidates: ClipCandidate[];
}

export interface ExportHistoryEntry {
  id: string;
  clipId: string;
  format: ClipFormatKey;
  storageKey: string;
  sizeBytes: number | null;
  exportedAt: string;
  clip: Clip;
}

export type SocialProfileTypeKey = "OWN" | "REFERENCE";
export type SocialPlatformKey = TrendPlatformKey | "OTHER";
export type ProfileConnectionTypeKey = "OAUTH" | "MANUAL" | "LICENSED_PROVIDER";

export interface BestPerformingContentEntry {
  title: string;
  reasonItWorked: string;
}

export interface SocialProfile {
  id: string;
  userId: string;
  type: SocialProfileTypeKey;
  platform: SocialPlatformKey;
  handle: string;
  connectedVia: ProfileConnectionTypeKey;
  toneOfVoice: string | null;
  recurringFormats: string[] | null;
  hashtagsUsed: string[];
  visualStyle: string | null;
  postingFrequency: string | null;
  avgEngagementRate: number | null;
  bestPerformingContent: BestPerformingContentEntry[] | null;
  lastAnalyzedAt: string | null;
  createdAt: string;
}

export interface TrendingSound {
  name: string;
  usageGrowthPct: number;
}

export interface ViralFormat {
  name: string;
  description: string;
}

export interface TrendSnapshot {
  id: string;
  date: string;
  platform: TrendPlatformKey;
  trendingSounds: TrendingSound[];
  emergingHashtags: string[];
  viralFormats: ViralFormat[];
  growingNiches: string[];
  source: "MOCK" | "LICENSED_PROVIDER" | "CURATED";
  createdAt: string;
  contentIdeas: ContentIdea[];
}

export interface UsageCounter {
  id: string;
  userId: string;
  periodStart: string;
  periodEnd: string;
  minutesProcessed: number;
  clipsGenerated: number;
}

export interface DashboardData {
  projects: Project[];
  recentVideos: Video[];
  recentClips: Clip[];
  ownProfile: SocialProfile | null;
  trends: TrendSnapshot[];
  usage: UsageCounter | null;
}
