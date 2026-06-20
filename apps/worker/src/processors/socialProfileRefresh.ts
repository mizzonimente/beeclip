import type { Job } from "bullmq";
import { prisma, Prisma } from "@clipmanager/db";
import { createSocialProfileResolver } from "@clipmanager/ai-core";
import type { Env } from "../env.js";

export interface SocialProfileRefreshPayload {
  socialProfileId: string;
  jobId: string;
}

/**
 * Processor della coda `social-profile-refresh` (vedi
 * `apps/api/src/routes/social.ts`, route `POST /social-profiles` e
 * `POST /social-profiles/:id/refresh`, entrambe enqueuano
 * `{ socialProfileId, jobId }` con `attempts: 2`).
 *
 * Nessuna logica di quota/validità qui (a differenza di video-processing e
 * clip-export): `createSocialProfileResolver` (vedi
 * `packages/ai-core/src/social/index.ts`) garantisce sempre un risultato,
 * perché la sua catena di provider termina sempre su
 * `MockSocialProfileProvider`, che accetta qualsiasi input e restituisce
 * dati di esempio chiaramente etichettati come tali nelle stringhe stesse
 * (es. "... (dati di esempio)") — non serve un campo DB separato per
 * marcare la provenienza, e infatti `SocialProfile` non ne ha uno.
 *
 * L'unico errore realmente possibile è tecnico/di configurazione (es.
 * `LicensedReferenceProvider` non configurato per un profilo REFERENCE con
 * `connectedVia = LICENSED_PROVIDER`, o un errore di rete verso l'Instagram
 * Graph API): lo lasciamo sempre rilanciare, così BullMQ può riprovare nei
 * limiti di `attempts: 2` configurati lato API.
 */
export async function processSocialProfileRefreshJob(job: Job<SocialProfileRefreshPayload>, env: Env): Promise<void> {
  const { socialProfileId, jobId } = job.data;

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "RUNNING", attempts: { increment: 1 } },
  });

  const profile = await prisma.socialProfile.findUnique({ where: { id: socialProfileId } });
  if (!profile) {
    // Stato anomalo: la route API crea sempre SocialProfile+Job nella
    // stessa richiesta prima di enqueuare. Se manca, è un bug altrove.
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "FAILED", lastError: `SocialProfile ${socialProfileId} non trovato`, finishedAt: new Date() },
    });
    throw new Error(`SocialProfile ${socialProfileId} non trovato`);
  }

  try {
    const resolver = createSocialProfileResolver(env);
    // `accessToken` non è ancora persistito da nessuna parte: il flusso
    // OAuth che lo produrrebbe non è implementato in v1 (vedi commento in
    // `instagramOwnAccountProvider.ts`). Per profili OAUTH senza token la
    // catena di provider ricade correttamente sul mock, senza inventare un
    // token finto.
    const { insights, sourceProvider } = await resolver.analyze({
      platform: profile.platform,
      handle: profile.handle,
      connectedVia: profile.connectedVia,
      accessToken: undefined,
    });

    await job.log(`Insights generati dal provider "${sourceProvider}" per ${profile.platform}/${profile.handle}.`);

    await prisma.socialProfile.update({
      where: { id: profile.id },
      data: {
        toneOfVoice: insights.toneOfVoice,
        recurringFormats: insights.recurringFormats as unknown as Prisma.InputJsonValue,
        hashtagsUsed: insights.hashtagsUsed,
        visualStyle: insights.visualStyle,
        postingFrequency: insights.postingFrequency,
        avgEngagementRate: insights.avgEngagementRate,
        bestPerformingContent: insights.bestPerformingContent as unknown as Prisma.InputJsonValue,
        lastAnalyzedAt: new Date(),
      },
    });

    await prisma.job.update({ where: { id: jobId }, data: { status: "COMPLETED", finishedAt: new Date() } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // `SocialProfile` non ha un campo `errorMessage` (a differenza di
    // Video/Clip): in caso di fallimento il profilo resta semplicemente con
    // l'ultimo `lastAnalyzedAt` valido (se presente), e il dettaglio
    // dell'errore vive solo sul `Job`.
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "FAILED", lastError: message, finishedAt: new Date() },
    });
    throw err; // sempre tecnico/di configurazione: lascia che BullMQ riprovi.
  }
}
