import type { TranscriptionProvider } from "./types.js";
import { OpenAIWhisperProvider } from "./openaiWhisperProvider.js";
import { HeuristicMockTranscriptionProvider } from "./heuristicMockProvider.js";

export * from "./types.js";
export { OpenAIWhisperProvider } from "./openaiWhisperProvider.js";
export { HeuristicMockTranscriptionProvider } from "./heuristicMockProvider.js";

/**
 * Factory selezionata via env (`TRANSCRIPTION_PROVIDER`). Tutto il resto del
 * sistema dipende solo dall'interfaccia `TranscriptionProvider`, mai da una
 * implementazione concreta — vedi docs/02-architecture.md §2.
 */
export function createTranscriptionProvider(env: {
  TRANSCRIPTION_PROVIDER?: string;
  OPENAI_API_KEY?: string;
}): TranscriptionProvider {
  switch (env.TRANSCRIPTION_PROVIDER) {
    case "openai":
      if (!env.OPENAI_API_KEY) {
        throw new Error("TRANSCRIPTION_PROVIDER=openai richiede OPENAI_API_KEY");
      }
      return new OpenAIWhisperProvider(env.OPENAI_API_KEY);
    case "mock":
    default:
      return new HeuristicMockTranscriptionProvider();
  }
}
