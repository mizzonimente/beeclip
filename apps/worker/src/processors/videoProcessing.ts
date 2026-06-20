import { rm, stat, writeFile } from "node:fs/promises";
import type { Job } from "bullmq";
import {
  prisma,
  checkMinutesQuota,
  incrementUsage,
  Prisma,
  type Video,
  type Project,
} from "@clipmanager/db";
import type { ClipFormatKey, TranscriptSegment } from "@clipmanager/shared";
import {
  probeVideo,
  detectSilences,
  detectSceneChanges,
  computeKeepRangesForClip,
  computeCrop,
  buildSrt,
  renderClip,
  extractThumbnail,
  createTranscriptionProvider,
  createAnalysisProvider,
  createMetadataProvider,
  type ClipRenderSpec,
  type KeepRange,
  type AnalysisContext,
  type BrandContext,
} from "@clipmanager/ai-core";
import { buildObjectKey, type StorageAdapter } from "@clipmanager/storage";
import { withTempDir, tempPath } from "../lib/tempDir.js";
import { extractAudio } from "../lib/audio.js";
import { getStorage } from "../lib/storage.js";
import { NonRetryableJobError, QuotaExceededError, UnprocessableMediaError } from "../lib/jobErrors.js";
import type { Env } from "../env.js";

export interface VideoProcessingPayload {
  videoId: string;
  jobId: string;
  formats: ClipFormatKey[];
}

type VideoWithProject = Video & { project: Project };

/**
 * Processor della coda `video-processing` (vedi docs/02-architecture.md §3
 * per la pipeline completa): probe → quota → audio → trascrizione →
 * analisi → metadata → rendering per formato → stato finale.
 *
 * Filosofia degli errori: aggiorniamo SEMPRE Video e Job a FAILED con un
 * messaggio leggibile prima di decidere se rilanciare l'eccezione. La
 * rilancio solo per errori tecnici, così BullMQ (attempts:3 + backoff
 * esponenziale, configurato lato API in `queues.ts`) può recuperare da
 * problemi transitori senza sprecare tentativi su condizioni permanenti.
 */
export async function processVideoJob(job: Job<VideoProcessingPayload>, env: Env): Promise<void> {
  const { videoId, jobId, formats } = job.data;
  const storage = getStorage(env);

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "RUNNING", attempts: { increment: 1 } },
  });

  const video = await prisma.video.findUnique({ where: { id: videoId }, include: { project: true } });
  if (!video) {
    // Stato anomalo: l'API crea sempre la riga Video prima di enqueuare il
    // job. Se non esiste, è un bug altrove, non un problema risolvibile
    // riprovando — ma non abbiamo un Video su cui scrivere errorMessage.
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "FAILED", lastError: `Video ${videoId} non trovato`, finishedAt: new Date() },
    });
    throw new Error(`Video ${videoId} non trovato`);
  }

  try {
    const renderedCount = await runPipeline(video, formats, env, storage);
    await prisma.video.update({ where: { id: video.id }, data: { status: "READY", errorMessage: null } });
    await prisma.job.update({ where: { id: jobId }, data: { status: "COMPLETED", finishedAt: new Date() } });
    void renderedCount; // già persistito dentro runPipeline (incrementUsage); ritornato solo per leggibilità/log
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.video.update({ where: { id: video.id }, data: { status: "FAILED", errorMessage: message } });
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "FAILED", lastError: message, finishedAt: new Date() },
    });

    if (err instanceof NonRetryableJobError) {
      return; // errore di business: nessun retry utile, non rilanciare.
    }
    throw err; // errore tecnico/transitorio: lascia che BullMQ riprovi.
  }
}

/**
 * Corpo della pipeline. Isolato in una funzione separata (invece di restare
 * tutto dentro `processVideoJob`) per tenere la gestione di stato/errori del
 * job (sopra) disaccoppiata dalla logica di elaborazione video (qui) —
 * la seconda è quella che cambierà più spesso (nuovi step, nuovi formati).
 *
 * Ritorna il numero di clip effettivamente renderizzate con successo.
 */
async function runPipeline(
  video: VideoWithProject,
  formats: ClipFormatKey[],
  env: Env,
  storage: StorageAdapter
): Promise<number> {
  const sourcePath = await storage.downloadToTempFile(video.storageKey);

  try {
    return await withTempDir(`video-${video.id}`, async (workDir) => {
      // ── 1. Probe: dimensioni/durata reali, non quelle dichiarate all'upload ──
      const probe = await probeVideo(sourcePath);
      if (!probe.hasAudio || !probe.width || !probe.height) {
        throw new UnprocessableMediaError(
          "Il file non ha una traccia audio o dimensioni video valide: ClipManager AI richiede un video con audio per trascrizione e analisi."
        );
      }

      await prisma.video.update({
        where: { id: video.id },
        data: {
          durationSeconds: probe.durationSeconds,
          width: probe.width,
          height: probe.height,
          fps: probe.fps,
          status: "EXTRACTING_AUDIO",
        },
      });

      // ── 2. Quota minuti: controllo reale sulla durata effettiva ──
      const quota = await checkMinutesQuota(video.project.userId, probe.durationSeconds / 60);
      if (!quota.allowed) {
        throw new QuotaExceededError(quota.reason ?? "Quota minuti mensili superata per il piano corrente.");
      }

      // ── 3. Estrazione audio (WAV mono 16kHz, vedi lib/audio.ts) ──
      const audioPath = tempPath(workDir, "audio.wav");
      await extractAudio(sourcePath, audioPath);

      // ── 4. Trascrizione ──
      await prisma.video.update({ where: { id: video.id }, data: { status: "TRANSCRIBING" } });
      const transcriptionProvider = createTranscriptionProvider(env);
      const transcript = await transcriptionProvider.transcribe(audioPath, "it");

      await prisma.transcript.upsert({
        where: { videoId: video.id },
        update: {
          language: transcript.language,
          fullText: transcript.fullText,
          segments: transcript.segments as unknown as Prisma.InputJsonValue,
          provider: transcript.provider,
        },
        create: {
          videoId: video.id,
          language: transcript.language,
          fullText: transcript.fullText,
          segments: transcript.segments as unknown as Prisma.InputJsonValue,
          provider: transcript.provider,
        },
      });

      // ── 5. Analisi: selezione dei segmenti candidati a diventare clip ──
      await prisma.video.update({ where: { id: video.id }, data: { status: "ANALYZING" } });

      // Rilevamento reale dei cambi di inquadratura sul video sorgente
      // (vedi ai-core/ffmpeg/sceneDetect.ts): è un segnale visivo aggiuntivo
      // rispetto alla sola trascrizione, usato sia dai provider LLM
      // (già previsto in prompts.ts) sia dall'euristica di fallback
      // (heuristicProvider.ts). Non è un'analisi multimodale completa come
      // quella di Opus Clip — è puro signal processing, niente AI — ma è un
      // dato reale, non inventato. Avvolto in try/catch: è un arricchimento,
      // non un requisito; se ffmpeg dovesse fallire su un file anomalo non
      // vogliamo abortire l'intera pipeline per questo.
      let sceneChanges: number[] | undefined;
      try {
        sceneChanges = await detectSceneChanges(sourcePath);
      } catch (err) {
        console.warn(`[video-processing] rilevamento scene changes fallito per video ${video.id}:`, err);
        sceneChanges = undefined;
      }

      const analysisProvider = createAnalysisProvider(env);
      const projectContext = {
        title: video.project.title,
        description: video.project.description ?? undefined,
        industry: video.project.industry ?? undefined,
        contentGoal: video.project.contentGoal ?? undefined,
        targetAudience: video.project.targetAudience ?? undefined,
      };
      const analysisCtx: AnalysisContext = {
        transcript,
        videoDurationSeconds: probe.durationSeconds,
        contentType: video.project.contentType,
        project: projectContext,
        sceneChanges,
        config: {
          mode: video.desiredClipCount != null ? "MANUAL" : "AUTO",
          desiredClipCount: video.desiredClipCount ?? undefined,
          avgClipDurationSeconds: video.avgClipDuration ?? undefined,
          minClipDurationSeconds: video.minClipDuration,
          maxClipDurationSeconds: video.maxClipDuration,
          formats,
        },
      };
      const candidateDrafts = await analysisProvider.selectClipCandidates(analysisCtx);

      if (candidateDrafts.length === 0) {
        throw new UnprocessableMediaError(
          "Nessun segmento idoneo trovato per generare clip (durata insufficiente o assenza di parlato rilevabile)."
        );
      }

      // ── 6. Metadata per candidato (viral score, hashtag, caption, hook...) ──
      // Se esiste un profilo social "proprio" già analizzato, lo usiamo come
      // contesto di brand (tono di voce, hashtag ricorrenti) per generare
      // metadata coerenti con l'identità social reale dell'utente — questo
      // collega la pipeline di generazione (step F/G/H) all'analisi profili
      // (step I) appena il dato è disponibile, senza aspettare che I sia
      // implementato per intero.
      const ownProfile = await prisma.socialProfile.findFirst({
        where: { userId: video.project.userId, type: "OWN", lastAnalyzedAt: { not: null } },
        orderBy: { lastAnalyzedAt: "desc" },
      });
      const brand: BrandContext | undefined = ownProfile
        ? {
            toneOfVoice: ownProfile.toneOfVoice ?? undefined,
            hashtagsUsed: ownProfile.hashtagsUsed,
            recurringFormats: Array.isArray(ownProfile.recurringFormats)
              ? (ownProfile.recurringFormats as string[])
              : undefined,
          }
        : undefined;

      const metadataProvider = createMetadataProvider(env);
      const persistedCandidates: Array<{ id: string; draft: (typeof candidateDrafts)[number] }> = [];

      for (const draft of candidateDrafts) {
        const created = await prisma.clipCandidate.create({
          data: {
            videoId: video.id,
            startSeconds: draft.startSeconds,
            endSeconds: draft.endSeconds,
            hookScore: draft.hookScore,
            emotionScore: draft.emotionScore,
            retentionScore: draft.retentionScore,
            pacingScore: draft.pacingScore,
            clarityScore: draft.clarityScore,
            standaloneScore: draft.standaloneScore,
            aggregateScore: draft.aggregateScore,
            emotionTags: draft.emotionTags,
            rationale: draft.rationale,
            selected: true,
            provider: draft.provider,
          },
        });
        persistedCandidates.push({ id: created.id, draft });

        const clipText = extractClipText(transcript.segments, draft.startSeconds, draft.endSeconds);
        const metadata = await metadataProvider.generate({
          candidate: draft,
          clipText,
          project: projectContext,
          contentType: video.project.contentType,
          brand,
        });

        await prisma.analysisResult.create({
          data: {
            clipCandidateId: created.id,
            viralScore: metadata.viralScore,
            viralReasoning: metadata.viralReasoning,
            strengths: metadata.strengths,
            weaknesses: metadata.weaknesses,
            suggestedTitle: metadata.suggestedTitle,
            suggestedDescription: metadata.suggestedDescription,
            suggestedCaption: metadata.suggestedCaption,
            suggestedHook: metadata.suggestedHook,
            suggestedOverlayText: metadata.suggestedOverlayText,
            suggestedCoverHint: metadata.suggestedCoverHint,
            hashtags: metadata.hashtags,
            provider: metadata.provider,
          },
        });
      }

      // ── 7. Rendering: per ogni candidato x ogni formato richiesto ──
      await prisma.video.update({ where: { id: video.id }, data: { status: "RENDERING_CLIPS" } });

      // I silenzi si calcolano UNA SOLA VOLTA sull'intero video sorgente:
      // ogni clip ne riusa solo il sottoinsieme rilevante al proprio range
      // (vedi computeKeepRangesForClip) invece di ri-eseguire ffmpeg
      // silencedetect per ogni candidato/formato.
      const silences = await detectSilences(sourcePath);
      const sourceDims = { width: probe.width, height: probe.height };

      let renderedCount = 0;
      for (const { id: candidateId, draft } of persistedCandidates) {
        for (const format of formats) {
          renderedCount += await renderOneClip({
            candidateId,
            draft,
            format,
            video,
            sourcePath,
            sourceDims,
            silences,
            transcript,
            workDir,
            storage,
          });
        }
      }

      if (renderedCount === 0) {
        throw new UnprocessableMediaError("Nessuna clip è stata renderizzata con successo (tutti i rendering sono falliti).");
      }

      // ── 8. Metering: un solo incremento minuti per video, clip totali generate ──
      await incrementUsage(video.project.userId, { minutes: probe.durationSeconds / 60, clips: renderedCount });

      return renderedCount;
    });
  } finally {
    // Il file scaricato da storage non vive in `workDir` (download
    // gestito internamente dallo StorageAdapter): va pulito a parte.
    await rm(sourcePath, { force: true }).catch(() => {
      /* best effort */
    });
  }
}

interface RenderOneClipArgs {
  candidateId: string;
  draft: { startSeconds: number; endSeconds: number };
  format: ClipFormatKey;
  video: VideoWithProject;
  sourcePath: string;
  sourceDims: { width: number; height: number };
  silences: Array<{ start: number; end: number }>;
  transcript: { provider: string; segments: TranscriptSegment[] };
  workDir: string;
  storage: StorageAdapter;
}

/**
 * Renderizza, carica e persiste una singola combinazione candidato×formato.
 * Estratta in funzione propria per poter fallire UNA clip (es. un formato
 * che va in errore) senza abortire l'intero video: l'errore viene loggato
 * sulla riga `Clip` e la pipeline continua con le altre combinazioni.
 * Ritorna 1 se il rendering è andato a buon fine, 0 altrimenti.
 */
async function renderOneClip(args: RenderOneClipArgs): Promise<0 | 1> {
  const { candidateId, draft, format, video, sourcePath, sourceDims, silences, transcript, workDir, storage } = args;

  const clip = await prisma.clip.create({
    data: { clipCandidateId: candidateId, projectId: video.projectId, format, cropMode: "SMART", status: "RENDERING" },
  });

  try {
    const crop = computeCrop(sourceDims, format, "SMART");
    const keepRanges: KeepRange[] = computeKeepRangesForClip(silences, draft.startSeconds, draft.endSeconds);

    // I sottotitoli bruciati nel video hanno senso solo con una trascrizione
    // reale: il provider euristico (senza chiavi API) produce solo
    // placeholder testuali ("[segmento N: parlato rilevato, testo non
    // trascritto in modalità mock]") che sarebbe ingannevole mostrare come
    // se fosse il parlato reale — quindi li omettiamo deliberatamente.
    let srtPath: string | undefined;
    if (transcript.provider !== "heuristic-mock") {
      const srt = buildSrt(transcript.segments, draft.startSeconds, draft.endSeconds);
      if (srt.trim().length > 0) {
        srtPath = tempPath(workDir, `${clip.id}.srt`);
        await writeFile(srtPath, srt, "utf-8");
      }
    }

    const outputPath = tempPath(workDir, `${clip.id}.mp4`);
    const renderSpec: ClipRenderSpec = {
      sourcePath,
      outputPath,
      clipStartSeconds: draft.startSeconds,
      clipEndSeconds: draft.endSeconds,
      crop,
      format,
      srtPath,
      keepRanges,
    };
    await renderClip(renderSpec);

    // Thumbnail presa poco dopo l'inizio della clip renderizzata (non del
    // sorgente): a quel punto il crop/formato finale sono già "bruciati".
    const clipDuration = draft.endSeconds - draft.startSeconds;
    const thumbnailOffset = Math.min(0.5, clipDuration / 4);
    const thumbPath = tempPath(workDir, `${clip.id}.jpg`);
    await extractThumbnail(outputPath, thumbnailOffset, thumbPath);

    const videoKey = buildObjectKey({
      userId: video.project.userId,
      projectId: video.projectId,
      videoId: video.id,
      clipId: clip.id,
      filename: "clip.mp4",
    });
    const thumbKey = buildObjectKey({
      userId: video.project.userId,
      projectId: video.projectId,
      videoId: video.id,
      clipId: clip.id,
      filename: "thumbnail.jpg",
    });

    await storage.putObjectFromFile(videoKey, outputPath, "video/mp4");
    await storage.putObjectFromFile(thumbKey, thumbPath, "image/jpeg");
    const { size: sizeBytes } = await stat(outputPath);

    await prisma.clip.update({
      where: { id: clip.id },
      data: { storageKey: videoKey, thumbnailKey: thumbKey, durationSeconds: clipDuration, status: "READY" },
    });

    // Storico export: anche il rendering "iniziale" (non solo le
    // ri-esportazioni successive via /clip-candidates/:id/export) conta
    // come materializzazione di un file per questa Clip — utile per audit
    // e per coerenza con il processor clip-export (vedi task #13).
    await prisma.exportHistory.create({
      data: { clipId: clip.id, format, storageKey: videoKey, sizeBytes },
    });

    return 1;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.clip.update({ where: { id: clip.id }, data: { status: "FAILED", errorMessage: message } });
    return 0;
  }
}

/** Ricostruisce il testo della trascrizione che cade (anche parzialmente)
 *  nel range [start, end) — stessa logica di filtro di `buildSrt`, ma
 *  restituisce testo semplice invece di un file .srt. Usato per dare ai
 *  generatori di metadata il contenuto reale della clip. */
function extractClipText(segments: TranscriptSegment[], start: number, end: number): string {
  return segments
    .filter((s) => s.end > start && s.start < end)
    .map((s) => s.text.trim())
    .join(" ");
}
