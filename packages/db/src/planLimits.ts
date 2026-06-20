import { prisma } from "./client.js";
import { PLAN_DEFAULTS } from "@clipmanager/shared";

// Spostato qui (da apps/api) perché sia apps/api (controllo "soft" sulle clip
// prima dell'upload) sia apps/worker (controllo reale sui minuti dopo il
// probe ffmpeg, e incremento contatori a fine job) hanno bisogno della stessa
// logica di quota — duplicarla nei due app sarebbe garantito divergere nel
// tempo.

function currentPeriod(): { periodStart: Date; periodEnd: Date } {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { periodStart, periodEnd };
}

/** Ritorna il piano effettivo dell'utente: quello sottoscritto, oppure FREE
 *  come default implicito se non ha (ancora) una subscription/piano seminato. */
async function resolveEffectivePlanLimits(userId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { userId }, include: { plan: true } });
  if (subscription?.plan) {
    return {
      clipsPerMonth: subscription.plan.clipsPerMonth,
      minutesPerMonth: subscription.plan.minutesPerMonth,
    };
  }
  return { clipsPerMonth: PLAN_DEFAULTS.FREE.clipsPerMonth, minutesPerMonth: PLAN_DEFAULTS.FREE.minutesPerMonth };
}

async function getOrCreateUsageCounter(userId: string) {
  const { periodStart, periodEnd } = currentPeriod();
  return prisma.usageCounter.upsert({
    where: { userId_periodStart: { userId, periodStart } },
    update: {},
    create: { userId, periodStart, periodEnd, minutesProcessed: 0, clipsGenerated: 0 },
  });
}

export interface PlanLimitCheck {
  allowed: boolean;
  reason?: string;
}

/** Controllo "soft" prima dell'upload: blocca solo se l'utente ha già
 *  esaurito le clip del mese. Il controllo sui minuti effettivi avviene nel
 *  worker dopo il probe ffmpeg, quando la durata reale è nota. */
export async function checkClipQuota(userId: string): Promise<PlanLimitCheck> {
  const limits = await resolveEffectivePlanLimits(userId);
  const usage = await getOrCreateUsageCounter(userId);
  if (usage.clipsGenerated >= limits.clipsPerMonth) {
    return { allowed: false, reason: `Limite piano raggiunto: ${limits.clipsPerMonth} clip/mese` };
  }
  return { allowed: true };
}

export async function checkMinutesQuota(userId: string, additionalMinutes: number): Promise<PlanLimitCheck> {
  const limits = await resolveEffectivePlanLimits(userId);
  const usage = await getOrCreateUsageCounter(userId);
  if (usage.minutesProcessed + additionalMinutes > limits.minutesPerMonth) {
    return { allowed: false, reason: `Limite piano raggiunto: ${limits.minutesPerMonth} minuti/mese` };
  }
  return { allowed: true };
}

export async function incrementUsage(userId: string, { minutes = 0, clips = 0 }: { minutes?: number; clips?: number }) {
  const { periodStart, periodEnd } = currentPeriod();
  await prisma.usageCounter.upsert({
    where: { userId_periodStart: { userId, periodStart } },
    update: { minutesProcessed: { increment: minutes }, clipsGenerated: { increment: clips } },
    create: { userId, periodStart, periodEnd, minutesProcessed: minutes, clipsGenerated: clips },
  });
}
