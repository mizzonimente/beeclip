import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { prisma } from "@clipmanager/db";
import {
  uploadVideoMetaSchema,
  createVideoFromDriveLinkSchema,
  QUEUE_NAMES,
  type ClipGenerationConfig,
  type ContentTypeKey,
} from "@clipmanager/shared";
import { buildObjectKey, extractDriveFileId, downloadPublicDriveFile, DriveDownloadError } from "@clipmanager/storage";
import { checkClipQuota } from "../lib/planLimits.js";
import { getStorage } from "../lib/storage.js";
import { getQueues } from "../lib/queues.js";
import type { Env } from "../env.js";

const ALLOWED_MIME = new Set(["video/mp4", "video/quicktime", "video/webm"]);

// Stesso limite configurato per il multipart upload (vedi app.ts:
// @fastify/multipart limits.fileSize). Lo applichiamo anche qui quando Drive
// ci dice la dimensione in anticipo (header Content-Length); se Drive non la
// espone, lo stream procede comunque e sarà il probe ffmpeg del worker a
// intercettare file non validi più avanti nella pipeline.
const MAX_DRIVE_DOWNLOAD_BYTES = 5 * 1024 * 1024 * 1024;

/**
 * Verifica proprietà del progetto + quota piano. Condivisa tra upload da
 * file e import da link Drive: entrambi i percorsi devono rifiutare nello
 * stesso modo un progetto non posseduto o una quota esaurita, PRIMA di
 * iniziare a scaricare/ricevere un solo byte di video.
 */
async function assertProjectAndQuota(
  userId: string,
  projectId: string
): Promise<{ project: { id: string } } | { error: { code: number; message: string } }> {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) return { error: { code: 404, message: "Progetto non trovato" } };

  const quota = await checkClipQuota(userId);
  if (!quota.allowed) return { error: { code: 402, message: quota.reason } };

  return { project };
}

interface VideoCreationParams {
  env: Env;
  videoId: string;
  projectId: string;
  storageKey: string;
  stream: NodeJS.ReadableStream;
  contentType: string;
  originalFilename: string;
  sourceType: "FILE_UPLOAD" | "DRIVE_LINK";
  sourceUrl?: string;
  contentTypeOverride?: ContentTypeKey;
  generationConfig?: ClipGenerationConfig;
}

/**
 * Logica condivisa tra upload da file e import da link Drive: una volta che
 * lo stream del video è scritto nello storage, entrambi i percorsi creano lo
 * stesso identico Video + Job + enqueue su VIDEO_PROCESSING. Il worker non sa
 * né si cura di come il file sia arrivato in storage (vedi
 * apps/worker/src/processors/videoProcessing.ts, che lavora solo su
 * `video.storageKey`).
 */
async function createVideoAndEnqueue(params: VideoCreationParams) {
  const storage = getStorage(params.env);
  await storage.putObjectFromStream(params.storageKey, params.stream, params.contentType);

  const video = await prisma.video.create({
    data: {
      id: params.videoId,
      projectId: params.projectId,
      originalFilename: params.originalFilename,
      storageKey: params.storageKey,
      status: "UPLOADED",
      sourceType: params.sourceType,
      sourceUrl: params.sourceUrl,
      desiredClipCount: params.generationConfig?.mode === "MANUAL" ? params.generationConfig.desiredClipCount : null,
      avgClipDuration: params.generationConfig?.avgClipDurationSeconds,
      minClipDuration: params.generationConfig?.minClipDurationSeconds ?? 15,
      maxClipDuration: params.generationConfig?.maxClipDurationSeconds ?? 90,
    },
  });

  if (params.contentTypeOverride) {
    await prisma.project.update({ where: { id: params.projectId }, data: { contentType: params.contentTypeOverride } });
  }

  const job = await prisma.job.create({
    data: { type: "VIDEO_PROCESSING", videoId: video.id, status: "PENDING" },
  });

  const queues = getQueues(params.env);
  await queues[QUEUE_NAMES.VIDEO_PROCESSING]!.add(
    "process",
    { videoId: video.id, jobId: job.id, formats: params.generationConfig?.formats ?? ["VERTICAL_9_16"] },
    { jobId: job.id, attempts: 3, backoff: { type: "exponential", delay: 5000 } }
  );

  return video;
}

/** Drive a volte non riconosce il mimetype reale e risponde con
 * "application/octet-stream": in quel caso ricaviamo il tipo dall'estensione
 * del filename invece di rifiutare un video legittimo. Il probe ffmpeg nel
 * worker resta comunque la rete di sicurezza finale. */
function resolveDriveContentType(driveContentType: string, filename: string | null): string {
  if (driveContentType.startsWith("video/")) return driveContentType;
  const ext = filename?.split(".").pop()?.toLowerCase();
  if (ext === "mp4") return "video/mp4";
  if (ext === "mov") return "video/quicktime";
  if (ext === "webm") return "video/webm";
  return driveContentType;
}

function extensionForContentType(contentType: string, filename: string | null): string {
  const fromFilename = filename?.split(".").pop()?.toLowerCase();
  if (fromFilename) return fromFilename;
  if (contentType === "video/quicktime") return "mov";
  if (contentType === "video/webm") return "webm";
  return "mp4";
}

export async function videoRoutes(fastify: FastifyInstance, opts: { env: Env }) {
  fastify.addHook("preHandler", fastify.authenticate);

  /**
   * Upload da file: i metadati (projectId, contentType, generationConfig)
   * viaggiano in query string, il body multipart contiene solo il file
   * binario. Scelta deliberata per poter validare proprietà del progetto e
   * quota piano PRIMA di toccare lo stream del file, ed evitare di
   * bufferizzare interi video in RAM (lo stream va dritto allo storage via
   * `putObjectFromStream`).
   */
  fastify.post<{ Querystring: { projectId?: string; contentType?: string; generationConfig?: string } }>(
    "/videos",
    async (request, reply) => {
      const metaParsed = uploadVideoMetaSchema.safeParse({
        projectId: request.query.projectId,
        contentType: request.query.contentType,
        generationConfig: request.query.generationConfig ? JSON.parse(request.query.generationConfig) : undefined,
      });
      if (!metaParsed.success) {
        return reply.code(400).send({ error: metaParsed.error.flatten().fieldErrors });
      }
      const meta = metaParsed.data;

      const check = await assertProjectAndQuota(request.currentUserId, meta.projectId);
      if ("error" in check) return reply.code(check.error.code).send({ error: check.error.message });
      const { project } = check;

      const filePart = await request.file();
      if (!filePart) return reply.code(400).send({ error: "Nessun file caricato (campo multipart 'file' mancante)" });
      if (!ALLOWED_MIME.has(filePart.mimetype)) {
        return reply.code(415).send({ error: `Formato non supportato: ${filePart.mimetype}. Usa mp4, mov o webm.` });
      }

      const videoId = randomUUID();
      const extension = filePart.filename.split(".").pop() ?? "mp4";
      const storageKey = buildObjectKey({
        userId: request.currentUserId,
        projectId: project.id,
        videoId,
        filename: `original.${extension}`,
      });

      const video = await createVideoAndEnqueue({
        env: opts.env,
        videoId,
        projectId: project.id,
        storageKey,
        stream: filePart.file,
        contentType: filePart.mimetype,
        originalFilename: filePart.filename,
        sourceType: "FILE_UPLOAD",
        contentTypeOverride: meta.contentType,
        generationConfig: meta.generationConfig,
      });

      return reply.code(201).send({ video });
    }
  );

  /**
   * Import da link pubblico Google Drive ("chiunque abbia il link"): niente
   * OAuth/API key, scarichiamo direttamente il binario lato server e lo
   * inoltriamo allo storage esattamente come l'upload da file. Da qui in
   * avanti la pipeline è identica — stesso Video, stesso Job, stessa coda.
   *
   * Non esiste l'equivalente per YouTube/social: scaricare video da quelle
   * piattaforme richiederebbe scraping non autorizzato (nessuna API
   * ufficiale per farlo, nemmeno sui propri contenuti), quindi questa route
   * resta solo per Drive. Vedi docs/02-architecture.md §7.
   */
  fastify.post<{ Body: unknown }>("/videos/from-drive-link", async (request, reply) => {
    const parsed = createVideoFromDriveLinkSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    const meta = parsed.data;

    const check = await assertProjectAndQuota(request.currentUserId, meta.projectId);
    if ("error" in check) return reply.code(check.error.code).send({ error: check.error.message });
    const { project } = check;

    const fileId = extractDriveFileId(meta.driveUrl);
    if (!fileId) {
      return reply.code(400).send({
        error:
          "Link Drive non valido. Incolla un link di condivisione di Google Drive (es. https://drive.google.com/file/d/.../view).",
      });
    }

    let drive;
    try {
      drive = await downloadPublicDriveFile(fileId);
    } catch (err) {
      const message = err instanceof DriveDownloadError ? err.message : "Download da Google Drive non riuscito.";
      return reply.code(422).send({ error: message });
    }

    if (drive.sizeBytes && drive.sizeBytes > MAX_DRIVE_DOWNLOAD_BYTES) {
      return reply.code(413).send({ error: "Il file su Drive supera il limite di 5GB." });
    }

    const resolvedContentType = resolveDriveContentType(drive.contentType, drive.filename);
    if (!ALLOWED_MIME.has(resolvedContentType)) {
      return reply.code(415).send({
        error: `Formato non supportato o non riconosciuto (${resolvedContentType}). Assicurati che il file su Drive sia mp4, mov o webm.`,
      });
    }

    const videoId = randomUUID();
    const extension = extensionForContentType(resolvedContentType, drive.filename);
    const storageKey = buildObjectKey({
      userId: request.currentUserId,
      projectId: project.id,
      videoId,
      filename: `original.${extension}`,
    });

    const video = await createVideoAndEnqueue({
      env: opts.env,
      videoId,
      projectId: project.id,
      storageKey,
      stream: drive.stream,
      contentType: resolvedContentType,
      originalFilename: drive.filename ?? `drive-${fileId}.${extension}`,
      sourceType: "DRIVE_LINK",
      sourceUrl: meta.driveUrl,
      contentTypeOverride: meta.contentType,
      generationConfig: meta.generationConfig,
    });

    return reply.code(201).send({ video });
  });

  fastify.get<{ Params: { id: string } }>("/videos/:id", async (request, reply) => {
    const video = await prisma.video.findFirst({
      where: { id: request.params.id, project: { userId: request.currentUserId } },
      include: {
        transcript: true,
        clipCandidates: {
          orderBy: { aggregateScore: "desc" },
          include: { analysisResult: true, clips: true },
        },
      },
    });
    if (!video) return reply.code(404).send({ error: "Video non trovato" });
    return reply.send({ video });
  });

  fastify.get<{ Params: { projectId: string } }>("/projects/:projectId/videos", async (request, reply) => {
    const project = await prisma.project.findFirst({
      where: { id: request.params.projectId, userId: request.currentUserId },
    });
    if (!project) return reply.code(404).send({ error: "Progetto non trovato" });

    const videos = await prisma.video.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ videos });
  });
}
