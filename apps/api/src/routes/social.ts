import type { FastifyInstance } from "fastify";
import { prisma } from "@clipmanager/db";
import { createSocialProfileSchema, QUEUE_NAMES, PLAN_DEFAULTS } from "@clipmanager/shared";
import { getQueues } from "../lib/queues.js";
import type { Env } from "../env.js";

export async function socialRoutes(fastify: FastifyInstance, opts: { env: Env }) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/social-profiles", async (request) => {
    const profiles = await prisma.socialProfile.findMany({
      where: { userId: request.currentUserId },
      orderBy: { createdAt: "desc" },
    });
    return { profiles };
  });

  fastify.post("/social-profiles", async (request, reply) => {
    const parsed = createSocialProfileSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });

    if (parsed.data.type === "REFERENCE") {
      const subscription = await prisma.subscription.findUnique({
        where: { userId: request.currentUserId },
        include: { plan: true },
      });
      const maxReferenceProfiles = subscription?.plan.maxReferenceProfiles ?? PLAN_DEFAULTS.FREE.maxReferenceProfiles;
      const currentCount = await prisma.socialProfile.count({
        where: { userId: request.currentUserId, type: "REFERENCE" },
      });
      if (currentCount >= maxReferenceProfiles) {
        return reply.code(402).send({ error: `Limite piano: massimo ${maxReferenceProfiles} profili reference` });
      }
    }

    const profile = await prisma.socialProfile.create({
      data: { ...parsed.data, userId: request.currentUserId },
    });

    const job = await prisma.job.create({ data: { type: "SOCIAL_PROFILE_REFRESH", refId: profile.id, status: "PENDING" } });
    const queues = getQueues(opts.env);
    await queues[QUEUE_NAMES.SOCIAL_PROFILE_REFRESH]!.add(
      "analyze",
      { socialProfileId: profile.id, jobId: job.id },
      { jobId: job.id, attempts: 2 }
    );

    return reply.code(201).send({ profile });
  });

  fastify.post<{ Params: { id: string } }>("/social-profiles/:id/refresh", async (request, reply) => {
    const profile = await prisma.socialProfile.findFirst({
      where: { id: request.params.id, userId: request.currentUserId },
    });
    if (!profile) return reply.code(404).send({ error: "Profilo non trovato" });

    const job = await prisma.job.create({ data: { type: "SOCIAL_PROFILE_REFRESH", refId: profile.id, status: "PENDING" } });
    const queues = getQueues(opts.env);
    await queues[QUEUE_NAMES.SOCIAL_PROFILE_REFRESH]!.add(
      "analyze",
      { socialProfileId: profile.id, jobId: job.id },
      { jobId: job.id, attempts: 2 }
    );
    return reply.send({ queued: true, jobId: job.id });
  });

  fastify.delete<{ Params: { id: string } }>("/social-profiles/:id", async (request, reply) => {
    const profile = await prisma.socialProfile.findFirst({
      where: { id: request.params.id, userId: request.currentUserId },
    });
    if (!profile) return reply.code(404).send({ error: "Profilo non trovato" });
    await prisma.socialProfile.delete({ where: { id: profile.id } });
    return reply.code(204).send();
  });
}
