import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "@clipmanager/db";
import { registerSchema, loginSchema } from "@clipmanager/shared";

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }
    const { email, password, name } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: "Esiste già un utente con questa email" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { email, passwordHash, name } });

    // Iscrizione al piano FREE se è stato seminato in DB (vedi packages/db/prisma/seed.ts).
    // Se il piano non esiste ancora, l'utente resta senza subscription finché
    // non viene creata manualmente — non blocchiamo la registrazione per questo.
    const freePlan = await prisma.plan.findUnique({ where: { name: "FREE" } });
    if (freePlan) {
      await prisma.subscription.create({
        data: { userId: user.id, planId: freePlan.id, status: "active" },
      });
    }

    const accessToken = fastify.jwt.access.sign({ sub: user.id, email: user.email });
    const refreshToken = fastify.jwt.refresh.sign({ sub: user.id, email: user.email });
    return reply.code(201).send({
      user: { id: user.id, email: user.email, name: user.name },
      accessToken,
      refreshToken,
    });
  });

  fastify.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return reply.code(401).send({ error: "Email o password non corrette" });
    }

    const accessToken = fastify.jwt.access.sign({ sub: user.id, email: user.email });
    const refreshToken = fastify.jwt.refresh.sign({ sub: user.id, email: user.email });
    return reply.send({
      user: { id: user.id, email: user.email, name: user.name },
      accessToken,
      refreshToken,
    });
  });

  fastify.post<{ Body: { refreshToken?: string } }>("/auth/refresh", async (request, reply) => {
    const { refreshToken } = request.body ?? {};
    if (!refreshToken) {
      return reply.code(400).send({ error: "refreshToken mancante nel body" });
    }
    try {
      const payload = fastify.jwt.refresh.verify<{ sub: string; email: string }>(refreshToken);
      const accessToken = fastify.jwt.access.sign({ sub: payload.sub, email: payload.email });
      return reply.send({ accessToken });
    } catch {
      return reply.code(401).send({ error: "Refresh token non valido o scaduto" });
    }
  });

  fastify.get("/auth/me", { preHandler: fastify.authenticate }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.currentUserId },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    if (!user) return reply.code(404).send({ error: "Utente non trovato" });
    return reply.send({ user });
  });
}
