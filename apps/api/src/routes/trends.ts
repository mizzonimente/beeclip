import type { FastifyInstance } from "fastify";
import { prisma } from "@clipmanager/db";
import { QUEUE_NAMES, TREND_PLATFORMS } from "@clipmanager/shared";
import { getQueues } from "../lib/queues.js";
import type { Env } from "../env.js";

export async function trendRoutes(fastify: FastifyInstance, opts: { env: Env }) {
  fastify.addHook("preHandler", fastify.authenticate);

  /** Homepage trend: ultimo snapshot per piattaforma + idee contenuto associate. */
  fastify.get("/trends", async () => {
    const snapshots = await Promise.all(
      TREND_PLATFORMS.map((platform) =>
        prisma.trendSnapshot.findFirst({
          where: { platform },
          orderBy: { date: "desc" },
          include: { contentIdeas: { orderBy: { createdAt: "desc" }, take: 5 } },
        })
      )
    );
    return { snapshots: snapshots.filter(Boolean) };
  });

  fastify.get<{ Params: { platform: string } }>("/trends/:platform", async (request, reply) => {
    const platform = request.params.platform.toUpperCase();
    if (!TREND_PLATFORMS.includes(platform as (typeof TREND_PLATFORMS)[number])) {
      return reply.code(400).send({ error: `Piattaforma non valida: ${platform}` });
    }
    const snapshot = await prisma.trendSnapshot.findFirst({
      where: { platform: platform as (typeof TREND_PLATFORMS)[number] },
      orderBy: { date: "desc" },
      include: { contentIdeas: { orderBy: { createdAt: "desc" }, take: 10 } },
    });
    if (!snapshot) return reply.code(404).send({ error: "Nessun trend disponibile per questa piattaforma ancora" });
    return reply.send({ snapshot });
  });

  /** Trigger manuale del refresh (oltre al cron giornaliero del worker) — utile per demo/test. */
  fastify.post("/trends/refresh", async (request, reply) => {
    const job = await prisma.job.create({ data: { type: "TREND_REFRESH", status: "PENDING" } });
    const queues = getQueues(opts.env);
    await queues[QUEUE_NAMES.TREND_REFRESH]!.add("refresh-all", { jobId: job.id }, { jobId: job.id, attempts: 2 });
    return reply.send({ queued: true, jobId: job.id });
  });
}
