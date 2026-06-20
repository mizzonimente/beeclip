import type { TranscriptionResult } from "@clipmanager/shared";

export interface TranscriptionProvider {
  readonly name: TranscriptionResult["provider"];
  transcribe(audioFilePath: string, language?: string): Promise<TranscriptionResult>;
}
