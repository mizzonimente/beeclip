import type { TranscriptionResult, ClipCandidateDraft, ContentTypeKey, ClipGenerationConfig } from "@clipmanager/shared";

export interface ProjectContext {
  title: string;
  description?: string;
  industry?: string;
  contentGoal?: string;
  targetAudience?: string;
}

export interface AnalysisContext {
  transcript: TranscriptionResult;
  videoDurationSeconds: number;
  contentType: ContentTypeKey;
  project: ProjectContext;
  config: ClipGenerationConfig;
  /** Timestamp (secondi) dei cambi di inquadratura rilevati a livello visivo, se disponibili. */
  sceneChanges?: number[];
}

export interface LanguageModelProvider {
  readonly name: ClipCandidateDraft["provider"];
  selectClipCandidates(ctx: AnalysisContext): Promise<ClipCandidateDraft[]>;
}
