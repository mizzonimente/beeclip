import type { Job } from "bullmq";
import { prisma, Prisma } from "@clipmanager/db";
import { TREND_PLATFORMS } from "@clipmanager/shared";
import { createTrendResolver, buildContentIdeas } from "@clipmanager/ai-core";
import type { Env } from "../env.js";

export interface TrendRefreshPayload {
  /**
   * Presente quando il trigger è la route manuale `POST /trends/refresh`
   * (vedi `apps/api/src/routes/trends.ts`), che crea già la riga `Job` prima
   * di enqueuare. Assente quando il trigger è il cron giornaliero registrato
   * in `apps/worker/src/index.ts`: in quel caso non esiste ancora nessuna
   * riga `Job` (non c'è stata una richiesta HTTP a crearla) e il processor ne
   * crea una propria all'inizio dell'esecuzione.
   */
  jobId?: string;
}

/**
 * Processor della coda `trend-refresh`. A differenza degli altri processor
 * (video-processing, clip-export, social-profile-refresh, che operano su una
 * singola riga identificata dal payload), un'unica esecuzione aggiorna TUTTE
 * le piattaforme in `TREND_PLATFORMS`.
 *
 * Ogni piattaforma è isolata nel proprio try/catch (stesso principio di
 * `renderOneClip` in videoProcessing.ts): un fallimento su TikTok non deve
 * impedire l'aggiornamento di Instagram/YouTube Shorts/LinkedIn/Facebook. In
 * pratica `createTrendResolver` (vedi packages/ai-core/src/trends/index.ts)
 * termina sempre sul `MockTrendProvider`, che non lancia mai — quindi un
 * fallimento qui segnala quasi sempre un problema reale (DB irraggiungibile,
 * provider configurato in modo incoerente). Per questo il job fallisce (ed è
 * quindi ritentabile da BullMQ) solo se TUTTE le piattaforme falliscono;
 * fallimenti parziali vengono registrati in `Job.lastError` ma il job resta
 * COMPLETED.
 */
export async function processTrendRefreshJob(job: Job<TrendRefreshPayload>, env: Env): Promise<void> {
  let jobId = job.data.jobId;
  if (!jobId) {
    const created = await prisma.job.create({ data: { type: "TREND_REFRESH", status: "PENDING" } });
    jobId = created.id;
  }

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "RUNNING", attempts: { increment: 1 } },
  });

  const resolver = createTrendResolver(env);
  const date = todayDateOnly();

  let successCount = 0;
  const errors: string[] = [];

  for (const platform of TREND_PLATFORMS) {
    try {
      const { snapshot, sourceProvider } = await resolver.fetch({ platform, date });

      const persisted = await prisma.trendSnapshot.upsert({
        where: { date_platform: { date, platform } },
        update: {
          trendingSounds: snapshot.trendingSounds as unknown as Prisma.InputJsonValue,
          emergingHashtags: snapshot.emergingHashtags,
          viralFormats: snapshot.viralFormats as unknown as Prisma.InputJsonValue,
          growingNiches: snapshot.growingNiches,
          source: snapshot.source,
        },
        create: {
          date,
          platform,
          trendingSounds: snapshot.trendingSounds as unknown as Prisma.InputJsonValue,
          emergingHashtags: snapshot.emergingHashtags,
          viralFormats: snapshot.viralFormats as unknown as Prisma.InputJsonValue,
          growingNiches: snapshot.growingNiches,
          source: snapshot.source,
        },
      });

      // Le idee "generiche" (non legate a un progetto specifico, projectId
      // null) si rigenerano ad ogni refresh invece di accumularsi: senza
      // questa pulizia, un trigger manuale di test lo stesso giorno dopo il
      // cron duplicherebbe le stesse idee sullo stesso snapshot.
      await prisma.contentIdea.deleteMany({ where: { trendSnapshotId: persisted.id, projectId: null } });
      const ideas = buildContentIdeas(snapshot);
      if (ideas.length > 0) {
        await prisma.contentIdea.createMany({
          data: ideas.map((idea) => ({
            trendSnapshotId: persisted.id,
            title: idea.title,
            description: idea.description,
          })),
        });
      }

      await job.log(`Trend "${platform}" aggiornato dal provider "${sourceProvider}" (${ideas.length} idee generate).`);
      successCount++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${platform}: ${message}`);
      await job.log(`Trend "${platform}" non aggiornato: ${message}`);
    }
  }

  if (successCount === 0) {
    const message = `Nessuna piattaforma aggiornata. Dettagli: ${errors.join(" | ")}`;
    await prisma.job.update({ where: { id: jobId }, data: { status: "FAILED", lastError: message, finishedAt: new Date() } });
    throw new Error(message); // probabile problema sistemico: lascia che BullMQ riprovi.
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      finishedAt: new Date(),
      lastError: errors.length > 0 ? `Piattaforme non aggiornate: ${errors.join(" | ")}` : null,
    },
  });
}

/**
 * Mezzanotte UTC del giorno corrente. Il campo `TrendSnapshot.date` è
 * `@db.Date` (ignora l'orario): normalizziamo qui invece di passare `new
 * Date()` diretto per evitare che il fuso orario del processo worker (non
 * garantito essere UTC) faccia "scivolare" la data su un giorno diverso da
 * quello inteso, rompendo l'unicità `@@unique([date, platform])` o creando
 * uno snapshot duplicato per lo stesso giorno percepito dall'utente.
 */
function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
