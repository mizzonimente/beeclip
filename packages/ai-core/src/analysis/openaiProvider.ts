import type { LanguageModelProvider, AnalysisContext } from "./types.js";
import type { ClipCandidateDraft } from "@clipmanager/shared";
import { buildClipSelectionPrompt } from "./prompts.js";
import { CLIP_CANDIDATES_JSON_SCHEMA, type ClipCandidatesPayload } from "./clipCandidateJsonSchema.js";

/**
 * Provider reale basato su OpenAI GPT, via Chat Completions con
 * `response_format: json_schema` (structured outputs) per ottenere lo
 * stesso contratto di `AnthropicAnalysisProvider` — i due provider sono
 * intercambiabili lato chiamante.
 */
export class OpenAIAnalysisProvider implements LanguageModelProvider {
  readonly name = "openai" as const;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = "gpt-4o"
  ) {
    if (!apiKey) throw new Error("OPENAI_API_KEY mancante per OpenAIAnalysisProvider");
  }

  async selectClipCandidates(ctx: AnalysisContext): Promise<ClipCandidateDraft[]> {
    const prompt = buildClipSelectionPrompt(ctx);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: { name: "clip_candidates", schema: CLIP_CANDIDATES_JSON_SCHEMA, strict: true },
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`OpenAI API error ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    const raw = data.choices[0]?.message?.content;
    if (!raw) throw new Error("OpenAI non ha restituito contenuto");

    const parsed = JSON.parse(raw) as ClipCandidatesPayload;
    return parsed.candidates.map((c) => ({ ...c, provider: "openai" as const }));
  }
}
