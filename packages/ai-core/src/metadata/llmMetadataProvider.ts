import type { MetadataGenerator, MetadataContext } from "./types.js";
import type { ClipMetadataDraft } from "@clipmanager/shared";
import { buildMetadataPrompt } from "./prompt.js";
import { CLIP_METADATA_JSON_SCHEMA, type ClipMetadataPayload } from "./metadataJsonSchema.js";

type Backend = "anthropic" | "openai";

/**
 * Generatore di metadata (viral score, caption, hashtag, ecc.) basato su
 * LLM. Una sola classe parametrizzata sul backend invece di due classi
 * duplicate: la chiamata HTTP cambia, il contratto di input/output no.
 */
export class LlmMetadataProvider implements MetadataGenerator {
  readonly name: string;

  constructor(private readonly backend: Backend, private readonly apiKey: string, private readonly model?: string) {
    this.name = backend;
    if (!apiKey) throw new Error(`API key mancante per LlmMetadataProvider(${backend})`);
  }

  async generate(ctx: MetadataContext): Promise<ClipMetadataDraft> {
    const prompt = buildMetadataPrompt(ctx);
    const payload = this.backend === "anthropic" ? await this.callAnthropic(prompt) : await this.callOpenAI(prompt);
    return { ...payload, provider: this.backend };
  }

  private async callAnthropic(prompt: string): Promise<ClipMetadataPayload> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model ?? "claude-sonnet-4-5",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            name: "submit_clip_metadata",
            description: "Invia i metadata generati per la clip.",
            input_schema: CLIP_METADATA_JSON_SCHEMA,
          },
        ],
        tool_choice: { type: "tool", name: "submit_clip_metadata" },
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { content: Array<{ type: string; input?: ClipMetadataPayload }> };
    const toolUse = data.content.find((c) => c.type === "tool_use");
    if (!toolUse?.input) throw new Error("Anthropic non ha restituito i metadata via tool_use");
    return toolUse.input;
  }

  private async callOpenAI(prompt: string): Promise<ClipMetadataPayload> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model ?? "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: { name: "clip_metadata", schema: CLIP_METADATA_JSON_SCHEMA, strict: true },
        },
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    const raw = data.choices[0]?.message?.content;
    if (!raw) throw new Error("OpenAI non ha restituito contenuto");
    return JSON.parse(raw) as ClipMetadataPayload;
  }
}
