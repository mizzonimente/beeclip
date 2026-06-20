import type { MetadataGenerator } from "./types.js";
import { LlmMetadataProvider } from "./llmMetadataProvider.js";
import { HeuristicMetadataProvider } from "./heuristicMetadataProvider.js";

export * from "./types.js";
export { LlmMetadataProvider } from "./llmMetadataProvider.js";
export { HeuristicMetadataProvider } from "./heuristicMetadataProvider.js";

export function createMetadataProvider(env: {
  ANALYSIS_PROVIDER?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
}): MetadataGenerator {
  switch (env.ANALYSIS_PROVIDER) {
    case "anthropic":
      if (!env.ANTHROPIC_API_KEY) throw new Error("ANALYSIS_PROVIDER=anthropic richiede ANTHROPIC_API_KEY");
      return new LlmMetadataProvider("anthropic", env.ANTHROPIC_API_KEY);
    case "openai":
      if (!env.OPENAI_API_KEY) throw new Error("ANALYSIS_PROVIDER=openai richiede OPENAI_API_KEY");
      return new LlmMetadataProvider("openai", env.OPENAI_API_KEY);
    case "mock":
    default:
      return new HeuristicMetadataProvider();
  }
}
