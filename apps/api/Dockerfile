# Dockerfile per @clipmanager/api (Fastify).
#
# I package del monorepo (@clipmanager/db, /shared, /storage, /ai-core) sono
# consumati come sorgente TypeScript (package.json: "main": "src/index.ts"),
# esattamente come in sviluppo con `tsx watch`. Per questo anche in produzione
# l'avvio usa `tsx` invece di `node dist/server.js`: stessa identica
# risoluzione dei moduli tra dev e prod, zero sorprese.
#
# `npm run build -w @clipmanager/api` viene comunque eseguito in fase di
# build come controllo dei tipi: se c'è un errore TypeScript (anche nei
# package importati), la build fallisce qui invece che a runtime su Railway.
#
# Il contesto di build DEVE essere la radice del monorepo (non apps/api/),
# perché il Dockerfile ha bisogno di vedere tutti i workspace.

FROM node:20-bookworm-slim AS deps
WORKDIR /app

# openssl: richiesto a runtime dal query engine di Prisma su Debian.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copiamo solo i package.json di ogni workspace: finché le dipendenze non
# cambiano, Docker riusa la cache di `npm ci` anche se il codice cambia.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ai-core/package.json packages/ai-core/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci

FROM deps AS build
COPY . .

# Genera il Prisma Client (packages/db/src/client.ts lo importa a runtime).
RUN npm run db:generate

# Type-check di apps/api (e, transitivamente, dei package che importa).
RUN npm run build -w @clipmanager/api

ENV NODE_ENV=production
EXPOSE 4000

# Applica le migrazioni Prisma in pending (idempotente, sicuro anche se
# eseguito ad ogni deploy) prima di avviare il server. Questo è l'UNICO
# servizio che esegue le migrazioni: il worker assume lo schema già
# aggiornato (vedi docs/05-deploy-railway.md sull'ordine di deploy).
CMD ["sh", "-c", "npx prisma migrate deploy --schema packages/db/prisma/schema.prisma && npx tsx apps/api/src/server.ts"]
