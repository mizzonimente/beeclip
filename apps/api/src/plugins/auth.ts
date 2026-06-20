import fastifyPlugin from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Env } from "../env.js";

export interface AccessTokenPayload {
  sub: string; // userId
  email: string;
}

interface JwtNamespace {
  sign(payload: AccessTokenPayload, options?: Record<string, unknown>): string;
  verify<T = AccessTokenPayload>(token: string, options?: Record<string, unknown>): T;
}

declare module "fastify" {
  interface FastifyInstance {
    // @fastify/jwt con l'opzione `namespace: "x"` decora l'istanza con
    // `fastify.jwt.x` (un oggetto Object.create(null) condiviso tra tutti i
    // namespace registrati), NON con `fastify.x` direttamente — vedi
    // node_modules/@fastify/jwt/jwt.js, riga "fastify.jwt[namespace] = ...".
    jwt: {
      access: JwtNamespace;
      refresh: JwtNamespace;
    };
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    currentUserId: string;
  }
}

/**
 * Due istanze di @fastify/jwt con namespace diversi (`access`/`refresh`):
 * i token di accesso (vita breve, su ogni richiesta) e quelli di refresh
 * (vita lunga, solo per ottenere un nuovo access token) usano segreti
 * diversi — se uno dei due viene compromesso, l'altro resta valido.
 *
 * Usiamo l'API a livello di istanza (`fastify.jwt.access.sign/verify`) invece
 * dei decorator su request/reply: è la parte più stabile e meno ambigua
 * dell'API di @fastify/jwt quando si gestiscono due namespace insieme,
 * ed è quella che usiamo qui sia per firmare (con payload esplicito) sia
 * per verificare (con token esplicito, utile per il refresh via body JSON
 * oltre che via header Authorization).
 */
export const authPlugin = fastifyPlugin(async (fastify: FastifyInstance, opts: { env: Env }) => {
  await fastify.register(fastifyJwt, {
    secret: opts.env.JWT_ACCESS_SECRET,
    namespace: "access",
    sign: { expiresIn: "15m" },
  });

  await fastify.register(fastifyJwt, {
    secret: opts.env.JWT_REFRESH_SECRET,
    namespace: "refresh",
    sign: { expiresIn: "30d" },
  });

  fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      reply.code(401).send({ error: "Header Authorization Bearer mancante" });
      return;
    }
    try {
      const payload = fastify.jwt.access.verify<AccessTokenPayload>(header.slice("Bearer ".length));
      request.currentUserId = payload.sub;
    } catch {
      reply.code(401).send({ error: "Token di accesso non valido o scaduto" });
    }
  });
});
