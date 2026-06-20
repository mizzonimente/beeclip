import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Crea (o aggiorna) un utente di test per provare l'app senza passare dalla
 * pagina di registrazione. Solo per sviluppo locale — non eseguire mai contro
 * un database di produzione.
 *
 * Uso: `npm run db:seed-test-user` dalla root del monorepo.
 */
const TEST_USER_EMAIL = "test@clipmanager.local";
const TEST_USER_PASSWORD = "Test1234!";
const TEST_USER_NAME = "Utente Test";

// Client Prisma dedicato a questo script, come in seed.ts: esecuzione singola,
// disconnessione esplicita alla fine.
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(TEST_USER_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: TEST_USER_EMAIL },
    update: { passwordHash, name: TEST_USER_NAME },
    create: { email: TEST_USER_EMAIL, passwordHash, name: TEST_USER_NAME },
  });

  // Stesso comportamento di /auth/register: assegna il piano FREE se è stato
  // seminato (vedi seed.ts) e l'utente non ha già una subscription.
  const existingSubscription = await prisma.subscription.findFirst({ where: { userId: user.id } });
  if (!existingSubscription) {
    const freePlan = await prisma.plan.findUnique({ where: { name: "FREE" } });
    if (freePlan) {
      await prisma.subscription.create({
        data: { userId: user.id, planId: freePlan.id, status: "active" },
      });
    }
  }

  console.log(`Utente di test pronto -> email: ${TEST_USER_EMAIL}  password: ${TEST_USER_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error("Creazione utente di test fallita:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
