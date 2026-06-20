# Dockerfile per @clipmanager/web (Next.js 14).
#
# A differenza di api/worker, Next.js produce davvero un build "compilato"
# (next build, con output "standalone": vedi next.config.mjs) — qui non
# serve tsx a runtime, il bundler di Next include già tutto il necessario.
#
# NEXT_PUBLIC_API_URL viene "incorporato" nel bundle client al momento del
# build (`next build`), non letto a runtime: per questo va passato come
# build ARG, impostato su Railway nelle variabili della fase di build (non
# basta impostarlo come variabile d'ambiente del servizio).
#
# Il contesto di build DEVE essere la radice del monorepo (non apps/web/).

FROM node:20-bookworm-slim AS deps
WORKDIR /app
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
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build -w @clipmanager/web

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
