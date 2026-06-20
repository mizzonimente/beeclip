import { PrismaClient } from "@prisma/client";
import { PLAN_DEFAULTS } from "@clipmanager/shared";

/**
 * Seed della tabella `Plan`. Eseguito da `prisma db seed` (config in
 * package.json, campo "prisma".seed) e automaticamente da `prisma migrate
 * dev` la prima volta che il DB è vuoto — vedi anche `npm run db:seed` dalla
 * root del monorepo.
 *
 * I limiti (minuti/clip al mese, profili di riferimento, risoluzione export)
 * vengono da `PLAN_DEFAULTS` in @clipmanager/shared — la stessa costante usata
 * come fallback implicito in `packages/db/src/planLimits.ts` quando un utente
 * non ha ancora una `Subscription` seminata. Derivarli dalla stessa fonte
 * (invece di ridigitarli qui) garantisce che le righe `Plan` nel DB e il
 * fallback "senza piano" restino sempre coerenti.
 *
 * `priceMonthlyCents` è invece una decisione commerciale, non tecnica: i
 * valori sotto (0 / 19€ / 49€ / 149€ al mese) sono placeholder ragionevoli
 * per sviluppo e demo, NON un prezzo definitivo — vanno validati dal business
 * owner prima del lancio in produzione.
 */
const PLAN_SEED_DATA = [
  { name: "FREE", priceMonthlyCents: 0, ...PLAN_DEFAULTS.FREE },
  { name: "STARTER", priceMonthlyCents: 1900, ...PLAN_DEFAULTS.STARTER },
  { name: "PRO", priceMonthlyCents: 4900, ...PLAN_DEFAULTS.PRO },
  { name: "AGENCY", priceMonthlyCents: 14900, ...PLAN_DEFAULTS.AGENCY },
] as const;

// Client Prisma dedicato a questo script (non il singleton di src/client.ts,
// pensato per il processo API/worker a lunga vita con hot-reload in dev):
// un seed è un'esecuzione singola e si disconnette esplicitamente alla fine.
const prisma = new PrismaClient();

async function main(): Promise<void> {
  for (const plan of PLAN_SEED_DATA) {
    const { name, priceMonthlyCents, minutesPerMonth, clipsPerMonth, maxReferenceProfiles, maxExportResolution } = plan;
    await prisma.plan.upsert({
      where: { name },
      // `features` non è incluso nell'update: se in futuro un admin lo
      // personalizza via pannello, ri-eseguire il seed non lo sovrascrive.
      update: { priceMonthlyCents, minutesPerMonth, clipsPerMonth, maxReferenceProfiles, maxExportResolution },
      create: {
        name,
        priceMonthlyCents,
        minutesPerMonth,
        clipsPerMonth,
        maxReferenceProfiles,
        maxExportResolution,
        // Riservato per flag futuri (es. "nessun watermark", supporto
        // prioritario): nessun codice lo legge ancora, quindi lo lasciamo
        // vuoto invece di inventare flag non realmente usati da nessuna parte.
        features: {},
      },
    });
    console.log(`Piano "${name}" seminato/aggiornato.`);
  }
}

main()
  .catch((err) => {
    console.error("Seed dei piani fallito:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
