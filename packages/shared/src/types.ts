// Tipi condivisi che non derivano direttamente da zod (es. forme dei
// payload prodotti dai moduli ai-core, consumati da api/worker/web).

export interface TranscriptWord {
  start: number; // secondi
  end: number;
  text: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  words: TranscriptWord[];
}

export interface TranscriptionResult {
  language: string;
  fullText: string;
  segments: TranscriptSegment[];
  provider: "openai-whisper" | "heuristic-mock";
}

export interface ClipCandidateScores {
  hookScore: number;
  emotionScore: number;
  retentionScore: number;
  pacingScore: number;
  clarityScore: number;
  standaloneScore: number;
  aggregateScore: number;
}

export interface ClipCandidateDraft extends ClipCandidateScores {
  startSeconds: number;
  endSeconds: number;
  emotionTags: string[];
  rationale: string;
  provider: "anthropic" | "openai" | "heuristic-mock";
}

export interface ClipMetadataDraft {
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
}

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SocialProfileInsights {
  toneOfVoice: string;
  recurringFormats: string[];
  hashtagsUsed: string[];
  visualStyle: string;
  postingFrequency: string;
  avgEngagementRate: number;
  bestPerformingContent: Array<{ title: string; reasonItWorked: string }>;
}

export interface DailyTrendSnapshot {
  platform: "TIKTOK" | "INSTAGRAM" | "YOUTUBE_SHORTS" | "LINKEDIN" | "FACEBOOK";
  trendingSounds: Array<{ name: string; usageGrowthPct: number }>;
  emergingHashtags: string[];
  viralFormats: Array<{ name: string; description: string }>;
  growingNiches: string[];
  source: "MOCK" | "LICENSED_PROVIDER" | "CURATED";
}
