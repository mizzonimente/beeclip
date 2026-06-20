import type { FastifyInstance } from "fastify";
import { prisma } from "@clipmanager/db";
import { exportClipSchema, QUEUE_NAMES } from "@clipmanager/shared";
import { getStorage } from "../lib/storage.js";
import { getQueues } from "../lib/queues.js";
import type { Env } from "../env.js";

export async function clipRoutes(fastify: FastifyInstance, opts: { env: Env }) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get<{ Params: { projectId: string } }>("/projects/:projectId/clips", async (request, reply) => {
    const project = await prisma.project.findFirst({
      where: { id: request.params.projectId, userId: request.currentUserId },
    });
    if (!project) return reply.code(404).send({ error: "Progetto non trovato" });

    const clips = await prisma.clip.findMany({
      where: { projectId: project.id },
      include: { clipCandidate: { include: { analysisResult: true } } },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ clips });
  });

  fastify.get<{ Params: { id: string } }>("/clips/:id/download-url", async (request, reply) => {
    const clip = await prisma.clip.findFirst({
      where: { id: request.params.id, project: { userId: request.currentUserId } },
    });
    if (!clip) return reply.code(404).send({ error: "Clip non trovata" });
    if (!clip.storageKey || clip.status !== "READY") {
      return reply.code(409).send({ error: "La clip non è ancora pronta" });
    }

    const storage = getStorage(opts.env);
    const url = await storage.getSignedDownloadUrl(clip.storageKey, 3600);
    return reply.send({ url, expiresInSeconds: 3600 });
  });

  /** Richiede il render dello stesso clip candidate in un nuovo formato,
   *  senza ripetere l'analisi AI (vedi docs/04-database-schema.md). */
  fastify.post<{ Params: { candidateId: string } }>("/clip-candidates/:candidateId/export", async (request, reply) => {
    const parsed = exportClipSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });

    const candidate = await prisma.clipCandidate.findFirst({
      where: { id: request.params.candidateId, video: { project: { userId: request.currentUserId } } },
      include: { video: true },
    });
    if (!candidate) return reply.code(404).send({ error: "Clip candidate non trovato" });

    const clip = await prisma.clip.create({
      data: {
        clipCandidateId: candidate.id,
        projectId: candidate.video.projectId,
        format: parsed.data.format,
        cropMode: parsed.data.cropMode,
        customCrop: parsed.data.customCrop,
        status: "QUEUED",
      },
    });

    const job = await prisma.job.create({
      data: { type: "CLIP_EXPORT", videoId: candidate.videoId, refId: clip.id, status: "PENDING" },
    });

    const queues = getQueues(opts.env);
    await queues[QUEUE_NAMES.CLIP_EXPORT]!.add(
      "export",
      { clipId: clip.id, jobId: job.id },
      { jobId: job.id, attempts: 3, backoff: { type: "exponential", delay: 5000 } }
    );

    return reply.code(201).send({ clip });
  });

  fastify.get<{ Params: { projectId: string } }>("/projects/:projectId/export-history", async (request, reply) => {
    const project = await prisma.project.findFirst({
      where: { id: request.params.projectId, userId: request.currentUserId },
    });
    if (!project) return reply.code(404).send({ error: "Progetto non trovato" });

    const history = await prisma.exportHistory.findMany({
      where: { clip: { projectId: project.id } },
      include: { clip: true },
      orderBy: { exportedAt: "desc" },
    });
    return reply.send({ history });
  });
}
