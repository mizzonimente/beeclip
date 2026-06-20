import { rm, stat, writeFile } from "node:fs/promises";
import type { Job } from "bullmq";
import { prisma, checkClipQuota, incrementUsage } from "@clipmanager/db";
import type { CropRegion } from "@clipmanager/shared";
import {
  probeVideo,
  detectSilences,
  computeKeepRangesForClip,
  computeCrop,
  buildSrt,
  renderClip,
  extractThumbnail,
  computeFaceTrackingTrajectory,
  toPixelKeyframes,
  type ClipRenderSpec,
  type KeepRange,
  type DynamicCrop,
} from "@clipmanager/ai-core";
import { buildObjectKey } from "@clipmanager/storage";
import { withTempDir, tempPath } from "../lib/tempDir.js";
import { getStorage } from "../lib/storage.js";
import { NonRetryableJobError, QuotaExceededError, UnprocessableMediaError } from "../lib/jobErrors.js";
import type { Env } from "../env.js";

export interface ClipExportPayload {
  clipId: string;
  jobId: string;
}

/**
 * Processor della coda `clip-export` (vedi `apps/api/src/routes/clips.ts`,
 * route `POST /clip-candidates/:candidateId/export`, che crea la riga
 * `Clip` con status `QUEUED` e il `Job` corrispondente PRIMA di enqueuare).
 *
 * Differenza chiave rispetto a `videoProcessing.ts`: qui NON si ri-analizza
 * il video (niente trascrizione, niente selezione candidati) — si riusa il
 * range temporale già scelto da `ClipCandidate.startSeconds/endSeconds` e si
 * renderizza solo nel formato/crop richiesto dall'utente per questa
 * ri-esportazione. Per questo si AGGIORNA la riga `Clip` già esistente
 * (creata dalla route API) invece di crearne una nuova, a differenza di
 * `renderOneClip` in videoProcessing.ts che crea sempre righe Clip fresche.
 */
export async function processClipExportJob(job: Job<ClipExportPayload>, env: Env): Promise<void> {
  const { clipId, jobId } = job.data;

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "RUNNING", attempts: { increment: 1 } },
  });

  const clip = await loadClipWithRelations(clipId);

  if (!clip) {
    // Stato anomalo: la route API crea sempre Clip+Job nella stessa
    // richiesta prima di enqueuare. Se manca, è un bug altrove — non c'è
    // comunque una riga Clip su cui scrivere errorMessage.
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "FAILED", lastError: `Clip ${clipId} non trovata`, finishedAt: new Date() },
    });
    throw new Error(`Clip ${clipId} non trovata`);
  }

  const { video } = clip.clipCandidate;
  const { project } = video;

  try {
    await prisma.clip.update({ where: { id: clip.id }, data: { status: "RENDERING" } });

    // Ogni esportazione materializza un nuovo file e conta come una clip
    // generata agli effetti della quota piano: senza questo controllo un
    // utente potrebbe ri-esportare la stessa clip candidata all'infinito
    // bypassando il limite mensile (la route API non lo controlla, perché
    // a quel livello non sappiamo ancora se il rendering andrà a buon
    // fine — il controllo "reale" appartiene qui, subito prima di renderizzare).
    const quota = await checkClipQuota(project.userId);
    if (!quota.allowed) {
      throw new QuotaExceededError(quota.reason ?? "Quota clip mensili superata per il piano corrente.");
    }

    await renderAndPersist(clip, env);

    await prisma.job.update({ where: { id: jobId }, data: { status: "COMPLETED", finishedAt: new Date() } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.clip.update({ where: { id: clip.id }, data: { status: "FAILED", errorMessage: message } });
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

// Query centralizzata in una funzione propria (invece che inline in
// `processClipExportJob`) per due motivi: evita di duplicare la stessa
// forma di `include` altrove, e permette di derivare `ClipWithRelations`
// via `ReturnType` senza ricostruire manualmente il tipo annidato che
// Prisma genera per questo include.
function loadClipWithRelations(clipId: string) {
  return prisma.clip.findUnique({
    where: { id: clipId },
    include: { clipCandidate: { include: { video: { include: { project: true } } } } },
  });
}

type ClipWithRelations = NonNullable<Awaited<ReturnType<typeof loadClipWithRelations>>>;

async function renderAndPersist(clip: ClipWithRelations, env: Env): Promise<void> {
  const storage = getStorage(env);
  const { clipCandidate } = clip;
  const { video } = clipCandidate;
  const { project } = video;

  const sourcePath = await storage.downloadToTempFile(video.storageKey);

  try {
    await withTempDir(`clip-export-${clip.id}`, async (workDir) => {
      // Probe fresco invece di riusare Video.width/height/durationSeconds
      // già salvati dal primo rendering: il costo di un ffprobe è
      // trascurabile rispetto all'encode che segue, e ci protegge da righe
      // Video con dati storici incompleti o disallineati dal file reale.
      const probe = await probeVideo(sourcePath);
      if (!probe.hasAudio || !probe.width || !probe.height) {
        throw new UnprocessableMediaError(
          "Il video sorgente non ha più audio o dimensioni valide: impossibile ri-esportare la clip."
        );
      }
      const sourceDims = { width: probe.width, height: probe.height };

      // Modalità MANUAL: qui viene esercitato per la prima volta il ramo
      // `manualCrop` di computeCrop — in videoProcessing.ts ogni clip viene
      // sempre generata con cropMode "SMART" al primo giro, il crop
      // manuale esiste solo come scelta esplicita dell'utente in fase di
      // ri-esportazione (route POST /clip-candidates/:id/export).
      const manualCrop = clip.customCrop as unknown as CropRegion | null;
      const crop = computeCrop(sourceDims, clip.format, clip.cropMode, manualCrop ?? undefined);

      // Face-tracking solo per il crop SMART: questa funzione gestisce
      // anche le ri-esportazioni in MANUAL/CENTER/LETTERBOX (scelta esplicita
      // dell'utente in fase di export), dove sovrascrivere il crop con una
      // traiettoria inseguita sarebbe un comportamento a sorpresa rispetto
      // a quanto richiesto. È comunque un arricchimento, non un requisito:
      // se fallisce o non trova un volto si ricade sul crop statico già
      // calcolato sopra (stessa filosofia di videoProcessing.ts).
      let dynamicCrop: DynamicCrop | undefined;
      if (env.FACE_TRACKING_ENABLED && clip.cropMode === "SMART") {
        try {
          const trajectory = await computeFaceTrackingTrajectory({
            sourcePath,
            clipStartSeconds: clipCandidate.startSeconds,
            clipEndSeconds: clipCandidate.endSeconds,
            workDir,
          });
          if (trajectory) {
            const pixelKeyframes = toPixelKeyframes(trajectory, sourceDims.width, sourceDims.height, crop.width, crop.height);
            dynamicCrop = { keyframes: pixelKeyframes, width: crop.width, height: crop.height };
          }
        } catch (err) {
          console.warn(`[clip-export] face-tracking fallito per clip ${clip.id}:`, err);
        }
      }

      const transcript = await prisma.transcript.findUnique({ where: { videoId: video.id } });
      let srtPath: string | undefined;
      if (transcript && transcript.provider !== "heuristic-mock") {
        const segments = transcript.segments as unknown as Parameters<typeof buildSrt>[0];
        const srt = buildSrt(segments, clipCandidate.startSeconds, clipCandidate.endSeconds);
        if (srt.trim().length > 0) {
          srtPath = tempPath(workDir, `${clip.id}.srt`);
          await writeFile(srtPath, srt, "utf-8");
        }
      }

      const silences = await detectSilences(sourcePath);
      const keepRanges: KeepRange[] = computeKeepRangesForClip(
        silences,
        clipCandidate.startSeconds,
        clipCandidate.endSeconds
      );

      const outputPath = tempPath(workDir, `${clip.id}.mp4`);
      const renderSpec: ClipRenderSpec = {
        sourcePath,
        outputPath,
        clipStartSeconds: clipCandidate.startSeconds,
        clipEndSeconds: clipCandidate.endSeconds,
        crop,
        dynamicCrop,
        format: clip.format,
        srtPath,
        keepRanges,
      };
      await renderClip(renderSpec);

      const clipDuration = clipCandidate.endSeconds - clipCandidate.startSeconds;
      const thumbnailOffset = Math.min(0.5, clipDuration / 4);
      const thumbPath = tempPath(workDir, `${clip.id}.jpg`);
      await extractThumbnail(outputPath, thumbnailOffset, thumbPath);

      // Chiave nuova ad ogni export (basata su clip.id, univoco per ogni
      // riga Clip creata dalla route API): nessun rischio di sovrascrivere
      // export precedenti dello stesso ClipCandidate in formati diversi.
      const videoKey = buildObjectKey({
        userId: project.userId,
        projectId: video.projectId,
        videoId: video.id,
        clipId: clip.id,
        filename: "clip.mp4",
      });
      const thumbKey = buildObjectKey({
        userId: project.userId,
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

      await prisma.exportHistory.create({
        data: { clipId: clip.id, format: clip.format, storageKey: videoKey, sizeBytes },
      });

      await incrementUsage(project.userId, { clips: 1 });
    });
  } finally {
    await rm(sourcePath, { force: true }).catch(() => {
      /* best effort */
    });
  }
}
