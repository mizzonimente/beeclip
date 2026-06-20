export const CLIP_METADATA_JSON_SCHEMA = {
  type: "object",
  properties: {
    viralScore: { type: "integer", minimum: 0, maximum: 100 },
    viralReasoning: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    weaknesses: { type: "array", items: { type: "string" } },
    suggestedTitle: { type: "string" },
    suggestedDescription: { type: "string" },
    suggestedCaption: { type: "string" },
    suggestedHook: { type: "string" },
    suggestedOverlayText: { type: "string" },
    suggestedCoverHint: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
  },
  required: [
    "viralScore", "viralReasoning", "strengths", "weaknesses", "suggestedTitle",
    "suggestedDescription", "suggestedCaption", "suggestedHook",
    "suggestedOverlayText", "suggestedCoverHint", "hashtags",
  ],
} as const;

export interface ClipMetadataPayload {
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
}
