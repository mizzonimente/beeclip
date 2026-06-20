# ClipManager AI — Architettura Tecnica

## 1. Vista d'insieme

```
                         ┌─────────────────────┐
                         │   apps/web (Next.js) │  Dashboard, upload, review clip
                         └──────────┬───────────┘
                                    │ REST (HTTPS, JWT)
                         ┌──────────▼───────────┐
                         │   apps/api (Fastify)  │  Auth, progetti, video, clip,
                         │                       │  trend, profili, billing
                         └──────────┬───────────┘
                     ┌──────────────┼──────────────────┐
                     ▼              ▼                  ▼
            ┌────────────┐  ┌──────────────┐   ┌───────────────┐
            │ PostgreSQL │  │ Redis (BullMQ)│   │ Storage (S3 / │
            │ (Prisma)   │  │  job queue    │   │ disco locale) │
            └────────────┘  └──────┬────────┘   └───────────────┘
                                    │
                         ┌──────────▼───────────┐
                         │  apps/worker (Node)   │  Consuma le code:
                         │                       │  - video-processing
                         │                       │  - clip-export
                         │                       │  - trend-refresh (cron)
                         └──────────┬────────────┘
                                    │
                    ┌───────────────┼────────────────────┐
                    ▼               ▼                    ▼
          ┌──────────────┐ ┌────────────────┐  ┌────────────────────┐
          │ packages/     │ │ ffmpeg (taglio, │  │ packages/ai-core    │
          │ ai-core:      │ │ crop, sottotitoli│  │ provider trend/     │
          │ trascrizione  │ │ thumbnail)       │  │ social (mock o      │
          │ + analisi LLM │ │                  │  │ provider con        │
          │ + scoring     │ │                  │  │ licenza)            │
          └──────────────┘ └────────────────┘  └────────────────────┘
```

## 2. Principio guida: moduli AI separati e intercambiabili

Ogni capacità "intelligente" è dietro un'interfaccia TypeScript in `packages/ai-core`, con almeno due implementazioni:

1. Un **provider reale** (chiamata a OpenAI/Anthropic o a un servizio terzo).
2. Un **provider mock/euristico**, che non è un placeholder vuoto ma un algoritmo deterministico reale (basato su pause, durata frasi, densità di parole chiave, varianza di ritmo) — così l'app è funzionante anche senza chiavi API, e il comportamento è prevedibile per i test.

Il provider attivo si seleziona via variabile d'ambiente (`AI_PROVIDER`, `TRANSCRIPTION_PROVIDER`, ecc.), senza toccare il codice chiamante. Questo è il punto chiave per "non creare solo una demo finta": la logica di business (selezione clip, scoring, crop) è reale e testabile; solo la sorgente di intelligenza linguistica è sostituibile.

Moduli in `packages/ai-core`:

| Modulo | Responsabilità | Provider reale | Provider di fallback |
|---|---|---|---|
| `transcription` | Speech-to-text con timestamp parola/frase | OpenAI Whisper API | Euristica su silenzi (mock realistico) |
| `analysis` | Segmentazione in beat, scoring hook/emozione/retention, selezione clip candidate | Anthropic Claude / OpenAI GPT (JSON strutturato) | Euristica basata su regole linguistiche |
| `ffmpeg/sceneDetect` | Rilevamento reale dei cambi di inquadratura sul video (filtro `scene` di ffmpeg) | — (sempre la stessa tecnica, nessun "provider" intercambiabile) | — |
| `viral-scoring` | Punteggio 0-100, motivazione, punti forza/debolezza | Stesso LLM di `analysis`, prompt dedicato | Formula pesata sui segnali euristici |
| `metadata-gen` | Titolo, caption, hashtag, hook testuale, testo overlay, suggerimento cover | LLM | Template basati su parole chiave estratte |
| `smart-crop` | Calcolo area di crop per formato target | Centroide movimento (OpenCV, v1) | Crop centrato fisso |
| `social-profile` | Tone of voice, formati ricorrenti, engagement profilo | Provider dati con licenza / dati incollati manualmente | Mock con dati di esempio strutturati |
| `trends` | Trend giornalieri per piattaforma | Provider dati con licenza / feed curato configurabile | Mock con dataset di esempio aggiornabile |

## 3. Flusso end-to-end (caricamento → clip pronte)

1. `POST /videos` (multipart) → file salvato via `StorageAdapter`, record `Video` creato con stato `UPLOADED`.
2. API enqueue job `video-processing` su BullMQ con `videoId`.
3. Worker: estrae audio (ffmpeg) → `transcription.transcribe()` → salva `Transcript` (segmenti + parole con timestamp).
3b. Worker: `ffmpeg/sceneDetect.detectSceneChanges(sourcePath)` → lista di timestamp dei cambi di inquadratura reali nel video (signal processing puro, nessuna AI). Se fallisce non blocca la pipeline: è un segnale aggiuntivo, non un requisito.
4. Worker: `analysis.selectClipCandidates(transcript, videoMeta, userConfig)` → usa anche i cambi di inquadratura (sia nei prompt LLM sia come bonus nell'euristica di fallback) → salva N `ClipCandidate` con punteggi per criterio.
5. Worker: per ogni candidate selezionato, `viral-scoring.score()` + `metadata-gen.generate()` → salva `AnalysisResult`.
6. Worker: per ogni formato richiesto, `smart-crop.computeCrop()` → costruisce filtro ffmpeg → taglia, brucia sottotitoli, genera thumbnail → salva file via `StorageAdapter` → crea record `Clip` con stato `READY`.
7. Video passa a stato `READY`; frontend fa polling/SSE su `/videos/:id/status`.
8. Utente rivede le clip in dashboard, scarica o richiede re-export in altro formato (`POST /clips/:id/export` → job `clip-export`, riusa lo stesso candidate senza rianalizzare).

## 4. Job queue (perché serve)

Il processing video è lento (minuti) e usa CPU/IO pesante (ffmpeg, chiamate AI). Va eseguito fuori dal ciclo richiesta/risposta HTTP. BullMQ (su Redis) dà: retry automatico, concorrenza configurabile, priorità per piano (es. utenti Pro hanno coda prioritaria), e cron nativo per il refresh trend giornaliero.

## 5. Storage

`StorageAdapter` con due implementazioni: `LocalDiskStorage` (sviluppo) e `S3CompatibleStorage` (produzione, funziona con AWS S3, Cloudflare R2, MinIO — stessa API). Il video originale, i file intermedi e le clip finali sono oggetti con chiave `{userId}/{projectId}/{videoId}/...`.

## 6. Autenticazione e piani

JWT (access + refresh token), password con bcrypt. Middleware `requirePlanLimit('clipsPerMonth')` controlla l'uso corrente (tabella `UsageCounter`) prima di accettare un nuovo job. Schema pronto per Stripe (`Plan`, `Subscription`, `UsageCounter` — vedi `04-database-schema.md`), integrazione Stripe vera e propria pianificata come passo successivo esplicito.

## 7. Sicurezza e limiti onesti da comunicare

- Le funzionalità che dipendono da API social ufficiali (analisi profilo proprio, futura pubblicazione) richiedono che l'utente colleghi il proprio account via OAuth: nessuna credenziale social viene mai gestita direttamente dalla piattaforma.
- L'analisi di profili di terzi (reference) e i trend giornalieri dipendono da provider dati con licenza; senza un provider configurato, il sistema funziona con dataset mock chiaramente etichettati come tali in UI ("dati di esempio finché non collegata una fonte").
- Face-tracking ed emotion detection da video sono moduli pesanti (richiedono GPU per essere realmente accurati in produzione); v1 li implementa in forma euristica/leggera ed espone l'interfaccia per innestare un modello dedicato senza riscrivere il resto del sistema.
