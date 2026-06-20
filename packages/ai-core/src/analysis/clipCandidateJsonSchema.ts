/**
 * JSON Schema condiviso tra il provider Anthropic (tool use) e il provider
 * OpenAI (structured output), così i due provider sono realmente
 * intercambiabili: stesso contratto di output, stesso codice di parsing
 * lato chiamante.
 */
export const CLIP_CANDIDATES_JSON_SCHEMA = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          startSeconds: { type: "number" },
          endSeconds: { type: "number" },
          hookScore: { type: "number", minimum: 0, maximum: 100 },
          emotionScore: { type: "number", minimum: 0, maximum: 100 },
          retentionScore: { type: "number", minimum: 0, maximum: 100 },
          pacingScore: { type: "number", minimum: 0, maximum: 100 },
          clarityScore: { type: "number", minimum: 0, maximum: 100 },
          standaloneScore: { type: "number", minimum: 0, maximum: 100 },
          aggregateScore: { type: "number", minimum: 0, maximum: 100 },
          emotionTags: { type: "array", items: { type: "string" } },
          rationale: { type: "string" },
        },
        required: [
          "startSeconds",
          "endSeconds",
          "hookScore",
          "emotionScore",
          "retentionScore",
          "pacingScore",
          "clarityScore",
          "standaloneScore",
          "aggregateScore",
          "emotionTags",
          "rationale",
        ],
      },
    },
  },
  required: ["candidates"],
} as const;

export interface ClipCandidatesPayload {
  candidates: Array<{
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
  }>;
}
