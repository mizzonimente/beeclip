import type { FastifyInstance } from "fastify";
import { prisma } from "@clipmanager/db";
import { TREND_PLATFORMS } from "@clipmanager/shared";

/**
 * Endpoint unico per la homepage azienda (docs/01-product-spec.md §4.7 e
 * §4.9): trend del giorno, ultimi video/clip, profilo cliente, in una sola
 * chiamata per evitare waterfall di richieste dal frontend.
 */
export async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/dashboard", async (request) => {
    const userId = request.currentUserId;

    const [projects, recentVideos, recentClips, ownProfile, trendSnapshots, usage] = await Promise.all([
      prisma.project.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.video.findMany({
        where: { project: { userId } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { project: { select: { title: true } } },
      }),
      prisma.clip.findMany({
        where: { project: { userId } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { clipCandidate: { include: { analysisResult: true } } },
      }),
      prisma.socialProfile.findFirst({ where: { userId, type: "OWN" } }),
      Promise.all(
        TREND_PLATFORMS.map((platform) =>
          prisma.trendSnapshot.findFirst({
            where: { platform },
            orderBy: { date: "desc" },
            include: { contentIdeas: { orderBy: { createdAt: "desc" }, take: 3 } },
          })
        )
      ),
      prisma.usageCounter.findFirst({ where: { userId }, orderBy: { periodStart: "desc" } }),
    ]);

    return {
      projects,
      recentVideos,
      recentClips,
      ownProfile,
      trends: trendSnapshots.filter(Boolean),
      usage,
    };
  });
}
