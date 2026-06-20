import type { LanguageModelProvider } from "./types.js";
import { AnthropicAnalysisProvider } from "./anthropicProvider.js";
import { OpenAIAnalysisProvider } from "./openaiProvider.js";
import { HeuristicAnalysisProvider } from "./heuristicProvider.js";

export * from "./types.js";
export * from "./prompts.js";
export * from "./clipCandidateJsonSchema.js";
export { AnthropicAnalysisProvider } from "./anthropicProvider.js";
export { OpenAIAnalysisProvider } from "./openaiProvider.js";
export { HeuristicAnalysisProvider } from "./heuristicProvider.js";

export function createAnalysisProvider(env: {
  ANALYSIS_PROVIDER?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
}): LanguageModelProvider {
  switch (env.ANALYSIS_PROVIDER) {
    case "anthropic":
      if (!env.ANTHROPIC_API_KEY) throw new Error("ANALYSIS_PROVIDER=anthropic richiede ANTHROPIC_API_KEY");
      return new AnthropicAnalysisProvider(env.ANTHROPIC_API_KEY);
    case "openai":
      if (!env.OPENAI_API_KEY) throw new Error("ANALYSIS_PROVIDER=openai richiede OPENAI_API_KEY");
      return new OpenAIAnalysisProvider(env.OPENAI_API_KEY);
    case "mock":
    default:
      return new HeuristicAnalysisProvider();
  }
}
