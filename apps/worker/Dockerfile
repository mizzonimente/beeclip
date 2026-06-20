# Dockerfile per @clipmanager/worker (processori BullMQ).
#
# Stesso approccio del Dockerfile di apps/api (vedi i commenti lì per il
# perché si usa `tsx` a runtime invece di `node dist/index.js`).
#
# In più: questo worker invoca i binari di sistema `ffmpeg`/`ffprobe` via
# child_process (packages/ai-core/src/ffmpeg/runFfmpeg.ts), quindi qui
# vanno installati con apt-get — apps/api non li usa e non li installa.
#
# Il contesto di build DEVE essere la radice del monorepo (non apps/worker/).

FROM node:20-bookworm-slim AS deps
WORKDIR /app

# openssl: richiesto da Prisma. ffmpeg: richiesto dai processori video.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates ffmpeg \
  && rm -rf /var/lib/apt/lists/*

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

RUN npm run db:generate
RUN npm run build -w @clipmanager/worker

ENV NODE_ENV=production

CMD ["npx", "tsx", "apps/worker/src/index.ts"]
