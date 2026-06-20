import type { ClipCandidateDraft, ClipMetadataDraft, ContentTypeKey } from "@clipmanager/shared";
import type { ProjectContext } from "../analysis/types.js";

export interface BrandContext {
  toneOfVoice?: string;
  hashtagsUsed?: string[];
  recurringFormats?: string[];
}

export interface MetadataContext {
  candidate: ClipCandidateDraft;
  clipText: string;
  project: ProjectContext;
  contentType: ContentTypeKey;
  brand?: BrandContext;
}

export interface MetadataGenerator {
  readonly name: string;
  generate(ctx: MetadataContext): Promise<ClipMetadataDraft>;
}
