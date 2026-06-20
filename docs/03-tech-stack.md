# ClipManager AI — Stack Tecnologico e Motivazioni

## Monorepo

**npm workspaces** (non pnpm/turborepo) per zero dipendenze extra da installare e massima compatibilità con qualsiasi ambiente; la struttura è comunque pronta per migrare a Turborepo quando il numero di pacchetti crescerà e servirà caching delle build.

```
apps/web      → frontend
apps/api      → backend REST
apps/worker   → job processing
packages/db   → Prisma schema + client condiviso
packages/shared → tipi/zod schema condivisi tra api/worker/web
packages/ai-core → moduli AI (vedi 02-architecture.md)
```

## Linguaggio

**TypeScript end-to-end** (frontend, backend, worker, tipi condivisi). Un solo linguaggio per tutto il sistema riduce gli errori di disallineamento tra contratti API e UI, ed è lo standard de facto per SaaS moderni di questa complessità.

## Frontend — Next.js 14 (App Router) + Tailwind CSS

- **Next.js**: rendering ibrido (SSR per dashboard con dati freschi, client components per interazioni come upload e player), routing a file, ecosistema maturo, deploy semplice (Vercel o self-hosted).
- **Tailwind CSS**: velocità di sviluppo per una UI SaaS moderna senza scrivere CSS custom per ogni componente; design system coerente via token (colori, spaziature) centralizzati.
- Alternative scartate: Remix (ecosistema più piccolo), SPA pura con Vite (perdiamo SSR utile per dashboard data-heavy).

## Backend API — Fastify + TypeScript + Zod

- **Fastify**: framework Node più rapido nella sua categoria, plugin system maturo (auth, rate-limit, multipart upload, swagger), basso overhead — importante perché l'API deve restare reattiva mentre worker/ffmpeg saturano CPU altrove.
- **Zod**: validazione input/output con inferenza di tipi TypeScript automatica, condivisa con `packages/shared`.
- Alternativa scartata: NestJS (più "enterprise" ma overhead architetturale non necessario in v1); tRPC (ottimo per type-safety, ma rinunceremmo a una API REST documentabile e consumabile da client esterni/futuri — requisito implicito di un "sistema con API" scalabile).

## Database — PostgreSQL + Prisma ORM

- **PostgreSQL**: relazioni naturali tra utenti, progetti, video, clip, analisi, trend — dominio fortemente relazionale. Supporto JSONB per campi semi-strutturati (es. punteggi per criterio, payload AI) senza perdere i vantaggi relazionali.
- **Prisma**: migrazioni versionate, client TypeScript generato e type-safe, ottima DX, query leggibili.

## Job Queue — BullMQ + Redis

Standard de facto nell'ecosistema Node per code di job affidabili (retry, backoff, priorità, cron), già pensato per scalare orizzontalmente aggiungendo worker.

## Video Processing — FFmpeg

Strumento di riferimento per taglio, crop, overlay testo, burn-in sottotitoli, generazione thumbnail. Eseguito da Node via `child_process` con comandi costruiti in modo tipizzato (nessuna stringa shell concatenata a mano per evitare injection — i parametri sono passati come array di argomenti).

## AI — provider intercambiabili (no lock-in)

- **Trascrizione**: interfaccia `TranscriptionProvider` → implementazione OpenAI Whisper API (qualità alta, costo per minuto) + euristica di fallback.
- **Analisi/scoring/metadata**: interfaccia `LanguageModelProvider` → implementazioni Anthropic Claude e OpenAI GPT-4, selezionabili a runtime. Claude è il default consigliato per l'analisi narrativa lunga (long-context, buon seguire istruzioni strutturate JSON); GPT-4 resta disponibile come alternativa o per ridondanza.
- Nessuna delle due è "hard-coded": cambiare provider è una variabile d'ambiente, non una riscrittura.

## Storage — Storage adapter (S3-compatible)

Interfaccia unica implementata da `LocalDiskStorage` (sviluppo, zero setup) e `S3CompatibleStorage` (produzione: AWS S3, Cloudflare R2 o MinIO self-hosted, tutte parlano lo stesso protocollo). Scelto perché l'utente ha indicato di voler partire in locale e restare cloud-ready.

## Autenticazione

JWT access+refresh con bcrypt per le password, implementazione propria (no vendor lock-in su Auth0/Clerk), ma struttura compatibile con un'eventuale migrazione futura se il prodotto crescerà (OAuth social login predisposto come estensione, non nel path critico v1).

## Containerizzazione locale — Docker Compose

`docker-compose.yml` con Postgres, Redis e MinIO (S3-compatibile locale) per avere un ambiente di sviluppo identico a produzione senza dipendere da servizi cloud nelle prime fasi.

## Testing

Vitest per unit test dei moduli `ai-core` (in particolare le euristiche di fallback, che devono essere deterministiche e testabili) e per la logica di costruzione comandi ffmpeg.
