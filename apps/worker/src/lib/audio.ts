import { runCommand } from "@clipmanager/ai-core";

/**
 * Estrae solo l'audio dal video originale come WAV mono 16kHz: formato
 * compatto e quello che sia il provider Whisper reale sia l'euristica mock
 * (silencedetect via ffmpeg) si aspettano. Tenerlo come step esplicito (e
 * non passare il file video intero ai provider di trascrizione) riduce i
 * dati trasferiti/caricati e rende onesto cosa viene davvero analizzato.
 */
export async function extractAudio(sourcePath: string, outputPath: string): Promise<void> {
  await runCommand("ffmpeg", [
    "-y",
    "-i", sourcePath,
    "-vn",
    "-ac", "1",
    "-ar", "16000",
    outputPath,
  ]);
}
