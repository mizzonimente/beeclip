import type { LanguageModelProvider, AnalysisContext } from "./types.js";
import type { ClipCandidateDraft } from "@clipmanager/shared";
import { buildClipSelectionPrompt } from "./prompts.js";
import { CLIP_CANDIDATES_JSON_SCHEMA, type ClipCandidatesPayload } from "./clipCandidateJsonSchema.js";

/**
 * Provider reale basato su Anthropic Claude, via REST + tool use forzato
 * (`tool_choice`) per ottenere output strutturato affidabile invece di
 * dover fare parsing fragile di testo libero. Implementato con `fetch`
 * nativo per lo stesso motivo descritto in `OpenAIWhisperProvider`.
 */
export class AnthropicAnalysisProvider implements LanguageModelProvider {
  readonly name = "anthropic" as const;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = "claude-sonnet-4-5"
  ) {
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY mancante per AnthropicAnalysisProvider");
  }

  async selectClipCandidates(ctx: AnalysisContext): Promise<ClipCandidateDraft[]> {
    const prompt = buildClipSelectionPrompt(ctx);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            name: "submit_clip_candidates",
            description: "Invia l'elenco delle clip candidate selezionate con i relativi punteggi.",
            input_schema: CLIP_CANDIDATES_JSON_SCHEMA,
          },
        ],
        tool_choice: { type: "tool", name: "submit_clip_candidates" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Anthropic API error ${res.status}: ${errText}`);
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; input?: ClipCandidatesPayload }>;
    };
    const toolUse = data.content.find((c) => c.type === "tool_use");
    if (!toolUse?.input) {
      throw new Error("Anthropic non ha restituito un tool_use con i candidate (risposta inattesa)");
    }

    return toolUse.input.candidates.map((c) => ({ ...c, provider: "anthropic" as const }));
  }
}
