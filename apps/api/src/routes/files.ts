import type { FastifyInstance } from "fastify";
import { createReadStream } from "node:fs";
import { LocalDiskStorage } from "@clipmanager/storage";
import { getStorage } from "../lib/storage.js";
import type { Env } from "../env.js";

/**
 * Serve i file quando STORAGE_DRIVER=local, validando il token HMAC emesso
 * da `LocalDiskStorage.getSignedDownloadUrl`. Con STORAGE_DRIVER=s3 questa
 * route non viene mai usata: i client scaricano direttamente dal presigned
 * URL S3 reale (vedi `clips.ts` → `/clips/:id/download-url`).
 * Nessun `fastify.authenticate` qui: l'autorizzazione è il token firmato
 * nell'URL stesso, pensato per essere passato a un tag <video>/<a> diretto.
 */
export async function fileRoutes(fastify: FastifyInstance, opts: { env: Env }) {
  fastify.get<{ Params: { "*": string }; Querystring: { exp?: string; token?: string } }>(
    "/files/*",
    async (request, reply) => {
      const storage = getStorage(opts.env);
      if (!(storage instanceof LocalDiskStorage)) {
        return reply.code(404).send({ error: "Storage locale non attivo" });
      }

      const key = request.params["*"];
      const exp = Number(request.query.exp);
      const token = request.query.token;
      if (!key || !exp || !token || !storage.verifyToken(key, exp, token)) {
        return reply.code(403).send({ error: "Link non valido o scaduto" });
      }

      const exists = await storage.exists(key);
      if (!exists) return reply.code(404).send({ error: "File non trovato" });

      const path = storage.resolvePathForServing(key);
      return reply.send(createReadStream(path));
    }
  );
}
