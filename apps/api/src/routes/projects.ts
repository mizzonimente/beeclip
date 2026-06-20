import type { FastifyInstance } from "fastify";
import { prisma } from "@clipmanager/db";
import { createProjectSchema } from "@clipmanager/shared";

export async function projectRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/projects", async (request) => {
    const projects = await prisma.project.findMany({
      where: { userId: request.currentUserId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { videos: true, clips: true } } },
    });
    return { projects };
  });

  fastify.post("/projects", async (request, reply) => {
    const parsed = createProjectSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });

    const project = await prisma.project.create({
      data: { ...parsed.data, userId: request.currentUserId },
    });
    return reply.code(201).send({ project });
  });

  fastify.get<{ Params: { id: string } }>("/projects/:id", async (request, reply) => {
    const project = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.currentUserId },
      include: {
        videos: { orderBy: { createdAt: "desc" } },
        contentIdeas: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!project) return reply.code(404).send({ error: "Progetto non trovato" });
    return reply.send({ project });
  });

  fastify.patch<{ Params: { id: string } }>("/projects/:id", async (request, reply) => {
    const parsed = createProjectSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });

    const existing = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.currentUserId },
    });
    if (!existing) return reply.code(404).send({ error: "Progetto non trovato" });

    const project = await prisma.project.update({ where: { id: existing.id }, data: parsed.data });
    return reply.send({ project });
  });

  fastify.delete<{ Params: { id: string } }>("/projects/:id", async (request, reply) => {
    const existing = await prisma.project.findFirst({
      where: { id: request.params.id, userId: request.currentUserId },
    });
    if (!existing) return reply.code(404).send({ error: "Progetto non trovato" });

    await prisma.project.delete({ where: { id: existing.id } });
    return reply.code(204).send();
  });
}
