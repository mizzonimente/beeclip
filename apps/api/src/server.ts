import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

// Carichiamo le variabili d'ambiente dal file `.env` nella root del monorepo
// (creato a partire da `.env.example`, condiviso da apps/api e apps/worker)
// PRIMA di importare qualsiasi modulo applicativo. Non basta un semplice
// `import "dotenv/config"` in testa al file: in ESM l'intero albero delle
// dipendenze statiche viene valutato prima del corpo di questo modulo,
// indipendentemente da dove compare la dichiarazione `import` nel file. Qui
// `./app.js` importa a cascata le route e quindi `@clipmanager/db`, il cui
// `client.ts` esegue `new PrismaClient()` a livello di modulo — se quel
// modulo venisse caricato con un `import` statico, Prisma leggerebbe
// `DATABASE_URL` da `process.env` prima che `dotenv.config()` l'abbia
// popolato. Per questo carichiamo `env.js` e `app.js` con un `import()`
// dinamico, eseguito solo dopo aver popolato `process.env`.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const { loadEnv } = await import("./env.js");
const { buildApp } = await import("./app.js");

const env = loadEnv();
const app = buildApp(env);

app
  .listen({ port: env.API_PORT, host: "0.0.0.0" })
  .then(() => {
    app.log.info(`ClipManager AI API in ascolto su http://localhost:${env.API_PORT}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
