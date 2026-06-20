// Logica di quota piano spostata in @clipmanager/db (condivisa con
// apps/worker, che deve incrementare gli usi reali ed eseguire il controllo
// sui minuti dopo il probe ffmpeg). Questo file resta come re-export per non
// rompere gli import esistenti in apps/api/src/routes/*.
export { checkClipQuota, checkMinutesQuota, incrementUsage, type PlanLimitCheck } from "@clipmanager/db";
