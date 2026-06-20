import { spawn } from "node:child_process";

/**
 * Esegue ffmpeg/ffprobe passando gli argomenti come array (mai come stringa
 * di shell concatenata): elimina per costruzione il rischio di shell
 * injection anche se in futuro un argomento (es. un titolo utente) dovesse
 * finire in un filtro.
 */
export function runCommand(bin: "ffmpeg" | "ffprobe", args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${bin} exited with code ${code}\n${stderr.slice(-4000)}`));
    });
  });
}

export interface ProbeResult {
  durationSeconds: number;
  width: number | null;
  height: number | null;
  fps: number | null;
  hasAudio: boolean;
}

export async function probeVideo(filePath: string): Promise<ProbeResult> {
  const { stdout } = await runCommand("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate",
    "-of", "json",
    filePath,
  ]);
  const data = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{ codec_type?: string; width?: number; height?: number; r_frame_rate?: string }>;
  };
  const videoStream = data.streams?.find((s) => s.codec_type === "video");
  const hasAudio = !!data.streams?.some((s) => s.codec_type === "audio");
  let fps: number | null = null;
  if (videoStream?.r_frame_rate) {
    const [num, den] = videoStream.r_frame_rate.split("/").map(Number);
    if (num && den) fps = num / den;
  }
  return {
    durationSeconds: Number(data.format?.duration ?? 0),
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
    fps,
    hasAudio,
  };
}
