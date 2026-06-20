import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { authPlugin } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { projectRoutes } from "./routes/projects.js";
import { videoRoutes } from "./routes/videos.js";
import { clipRoutes } from "./routes/clips.js";
import { socialRoutes } from "./routes/social.js";
import { trendRoutes } from "./routes/trends.js";
import { fileRoutes } from "./routes/files.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import type { Env } from "./env.js";

export function buildApp(env: Env) {
  const app = Fastify({ logger: true });

  app.register(cors, { origin: true });
  app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5GB: video lunghi in input
  });
  app.register(authPlugin, { env });

  app.register(authRoutes);
  app.register(projectRoutes);
  app.register(videoRoutes, { env });
  app.register(clipRoutes, { env });
  app.register(socialRoutes, { env });
  app.register(trendRoutes, { env });
  app.register(fileRoutes, { env });
  app.register(dashboardRoutes);

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
