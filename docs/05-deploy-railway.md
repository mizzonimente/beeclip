# Deploy su Railway

Questa guida copre il deploy di ClipManager AI su Railway: 3 servizi Docker
(api, worker, web) + Postgres + Redis (plugin Railway) + storage file su
Cloudflare R2 (sostituisce MinIO, usato solo in locale).

Le azioni che richiedono creare un account o inserire credenziali da qualche
parte le devi fare tu personalmente (non posso farlo per te). Tutto il resto
— Dockerfile, codice, configurazione — è già pronto in questo repo.

## 0. Correzioni fatte al codice per abilitare il deploy

Durante la preparazione ho trovato e corretto un problema che avrebbe
impedito all'app di partire in produzione: `apps/api` e `apps/worker`
avevano script `start` che eseguivano `node dist/server.js` /
`node dist/index.js`, ma i package interni (`@clipmanager/db`, `/shared`,
`/storage`, `/ai-core`) sono scritti per essere usati come sorgente
TypeScript diretta (esattamente come fa già `npm run dev:*` in locale con
`tsx`), non come JS compilato. `node` da solo non può eseguire `.ts`.

Correzioni applicate:
- `apps/api` e `apps/worker`: lo script `start` ora usa `tsx` (stesso motore
  usato in sviluppo) invece di `node dist/...`. `tsx` è stato spostato tra le
  dipendenze di produzione.
- `apps/web/next.config.mjs`: aggiunto `output: "standalone"` per
  un'immagine Docker minima.
- Creati `apps/api/Dockerfile`, `apps/worker/Dockerfile`, `apps/web/Dockerfile`
  e un `.dockerignore` alla radice.

Nessuna di queste modifiche cambia il comportamento in locale (`npm run dev:*`
continua a funzionare come prima).

## 1. Architettura su Railway

Un progetto Railway con 5 elementi:

| Elemento | Tipo | Note |
|---|---|---|
| Postgres | Plugin Railway | fornisce `DATABASE_URL` automaticamente |
| Redis | Plugin Railway | fornisce `REDIS_URL` automaticamente |
| api | Servizio da Dockerfile | `apps/api/Dockerfile`, porta 4000, dominio pubblico |
| worker | Servizio da Dockerfile | `apps/worker/Dockerfile`, nessuna porta/dominio |
| web | Servizio da Dockerfile | `apps/web/Dockerfile`, porta 3000, dominio pubblico |

Lo storage file (video, clip esportate) non gira su Railway: serve un bucket
S3-compatibile esterno. Consiglio Cloudflare R2 (gratuito fino a 10GB,
nessun costo di banda in uscita). Il codice (`packages/storage`) è già
compatibile, basta impostare le variabili `S3_*`.

## 2. Variabili d'ambiente

Non riusare MAI le credenziali di sviluppo locale (`clipmanager`/`clipmanager`
per Postgres, `clipmanager`/`clipmanager123` per MinIO, viste in
`docker-compose.yml`). Sono solo per il tuo computer.

### Servizio `api`

| Variabile | Obbligatoria | Valore consigliato |
|---|---|---|
| `DATABASE_URL` | sì | `${{Postgres.DATABASE_URL}}` (referenza automatica Railway) |
| `REDIS_URL` | sì | `${{Redis.REDIS_URL}}` |
| `JWT_ACCESS_SECRET` | sì | stringa random, min. 8 caratteri (vedi sotto come generarla) |
| `JWT_REFRESH_SECRET` | sì | stringa random, diversa dalla precedente |
| `STORAGE_DRIVER` | sì | `s3` |
| `S3_ENDPOINT` | sì (se s3) | endpoint R2, es. `https://<account-id>.r2.cloudflarestorage.com` |
| `S3_REGION` | no | `auto` (default) |
| `S3_BUCKET` | sì (se s3) | nome bucket R2 |
| `S3_ACCESS_KEY_ID` | sì (se s3) | da token R2 |
| `S3_SECRET_ACCESS_KEY` | sì (se s3) | da token R2 |
| `TRANSCRIPTION_PROVIDER` | no | `mock` finché non collegata una vera API |
| `OPENAI_API_KEY` | solo se provider reale | — |
| `ANALYSIS_PROVIDER` | no | `mock` finché non collegata una vera API |
| `ANTHROPIC_API_KEY` | solo se provider reale | — |
| `SOCIAL_DATA_PROVIDER` | no | `mock` |
| `SOCIAL_DATA_PROVIDER_API_KEY` | solo se provider reale | — |
| `TREND_DATA_PROVIDER` | no | `mock` |
| `TREND_DATA_PROVIDER_API_KEY` | solo se provider reale | — |
| `API_PORT` | no | `4000` (deve combaciare con `EXPOSE` nel Dockerfile) |
| `NODE_ENV` | sì | `production` |

### Servizio `worker`

Stesse variabili `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET` (usa lo
stesso valore impostato su `api`), `STORAGE_DRIVER`/`S3_*`, e le variabili
provider (`TRANSCRIPTION_PROVIDER`, ecc. — stessi valori di `api`), più:

| Variabile | Obbligatoria | Default |
|---|---|---|
| `WORKER_VIDEO_CONCURRENCY` | no | `2` |
| `WORKER_CLIP_EXPORT_CONCURRENCY` | no | `3` |
| `WORKER_SOCIAL_CONCURRENCY` | no | `2` |
| `WORKER_TREND_CONCURRENCY` | no | `1` |
| `NODE_ENV` | sì | `production` |

Non serve `JWT_REFRESH_SECRET` qui.

### Servizio `web`

| Variabile | Quando | Valore |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | build-time (ARG Docker) | URL pubblico del servizio `api` (es. `https://api-xxxx.up.railway.app`) |

Importante: questa variabile viene "incorporata" nel codice al momento del
build, non letta a runtime. Su Railway va impostata nelle variabili del
servizio `web` PRIMA del deploy — Railway la passa al Dockerfile come build
arg automaticamente se ha lo stesso nome.

### Generare i JWT secret

Nel tuo terminale (in locale, non serve internet):

```
openssl rand -hex 32
```

Esegui il comando due volte: il primo risultato è `JWT_ACCESS_SECRET`, il
secondo `JWT_REFRESH_SECRET`. Copia i valori direttamente nei campi di
Railway.

## 3. Passo per passo su Railway

1. **Crea un account su railway.app** (con GitHub è il più comodo, dato che
   il deploy da Dockerfile funziona meglio collegando il repo GitHub).
2. Assicurati che il repo `nuddaclips` sia su GitHub (push delle ultime
   modifiche, incluse quelle di questa sessione).
3. **Nuovo progetto** → **Deploy from GitHub repo** → seleziona il repo.
4. **Aggiungi Postgres**: New → Database → PostgreSQL.
5. **Aggiungi Redis**: New → Database → Redis.
6. **Servizio `api`**: New → GitHub Repo (stesso repo) →
   - Settings → Source → **Root Directory**: lascia `/` (la radice del
     monorepo — il Dockerfile copia file da più cartelle, NON impostare
     `apps/api`).
   - Settings → Build → **Dockerfile Path**: `apps/api/Dockerfile`.
   - Settings → Networking → **Generate Domain** (ti serve l'URL pubblico
     per il passo 9).
   - Variables: inserisci la tabella del punto 2 (per `DATABASE_URL` e
     `REDIS_URL` usa il pulsante "Add Reference" e seleziona
     Postgres/Redis, così restano sincronizzate automaticamente).
7. **Servizio `worker`**: stesso repo, **Dockerfile Path**:
   `apps/worker/Dockerfile`, Root Directory `/`, nessun dominio pubblico.
   Variables come da tabella punto 2.
8. **Servizio `web`**: stesso repo, **Dockerfile Path**:
   `apps/web/Dockerfile`, Root Directory `/`. Genera dominio pubblico.
9. Imposta `NEXT_PUBLIC_API_URL` su `web` con l'URL del dominio generato per
   `api` al punto 6, poi fai redeploy di `web` (la variabile viene letta
   solo in fase di build).
10. **Ordine del primo deploy**: fai partire `api` per primo e aspetta che
    sia "Active" (le migrazioni Prisma vengono eseguite automaticamente
    all'avvio, vedi sezione 0). Solo dopo avvia `worker` e `web`.
11. **Configura Cloudflare R2** (cloudflare.com → R2 → Create bucket):
    crea un bucket, poi in "Manage R2 API Tokens" crea un token con
    permessi di lettura/scrittura su quel bucket. Copia Account ID, Access
    Key ID e Secret Access Key nelle variabili `S3_*` di `api` e `worker`
    (endpoint: `https://<account-id>.r2.cloudflarestorage.com`).
12. Testa l'app dall'URL pubblico di `web`: registrazione utente, creazione
    progetto, upload di un video breve, verifica che compaia un job nel
    worker (Railway → servizio worker → Logs).

## 4. Cosa non posso fare per te

- Creare l'account Railway o Cloudflare.
- Inserire credenziali, token o password in qualunque interfaccia.
- Collegare il repo GitHub al progetto Railway (richiede il tuo login).

Tutto il resto (Dockerfile, fix al codice, configurazione, questa guida) è
pronto. Se un deploy fallisce, copiami il log d'errore dalla dashboard
Railway e lo risolviamo insieme.
