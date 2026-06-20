# ClipManager AI — Database Schema

Schema relazionale completo in `packages/db/prisma/schema.prisma` (fonte di verità, generata da Prisma). Questo documento ne spiega le scelte.

## Entità principali e relazioni

```
User 1───* Project 1───* Video 1───1 Transcript
  │                        │
  │                        └──* ClipCandidate 1───1 AnalysisResult
  │                                  │
  │                                  └──* Clip ──* ExportHistory
  │
  ├──1 Subscription ──1 Plan
  ├──* UsageCounter
  └──* SocialProfile

TrendSnapshot ──* ContentIdea (*── Project, opzionale)
```

## Scelte di modellazione

- **`ClipCandidate` separato da `Clip`**: il candidate è il risultato dell'analisi (range temporale + punteggi), il `Clip` è il render concreto in un formato specifico. Un solo candidate può generare più `Clip` (es. stessa clip in 9:16 e 1:1) senza ripetere l'analisi AI — risparmio di costo e tempo, e coerenza tra formati diversi della stessa idea.
- **`AnalysisResult` 1:1 con `ClipCandidate`**: separato per tenere il risultato "grezzo" della selezione (punteggi per criterio, usati anche internamente per ordinare i candidate) distinto dal risultato "di marketing" (viral score, caption, hashtag) pensato per essere mostrato all'utente e potenzialmente rigenerato senza ricalcolare i punteggi di selezione.
- **Campi JSON mirati** (`segments` su Transcript, `recurringFormats`/`bestPerformingContent` su SocialProfile, `trendingSounds`/`viralFormats` su TrendSnapshot): dati strutturati ma di forma variabile, dove forzare tabelle separate avrebbe aggiunto complessità senza benefici di query reali a questo stadio. Possono essere normalizzati più avanti se necessario.
- **`UsageCounter` per periodo**: i limiti di piano si verificano per periodo di fatturazione, non in modo cumulativo — serve un contatore per finestra temporale per supportare correttamente i piani SaaS.
- **`SocialProfile.connectedVia`**: traccia esplicitamente se un profilo è collegato via OAuth (proprio account, dati affidabili e legittimi), inserito manualmente dall'utente, o ottenuto da un provider dati con licenza — fondamentale per essere trasparenti con l'utente su provenienza e affidabilità del dato.
- **`Job`**: storico persistente dei job (oltre allo stato interno di BullMQ in Redis, che è effimero), utile per dashboard "cronologia elaborazioni" e debug.

## Enum principali

`ContentType`, `VideoStatus`, `ClipFormat`, `CropMode`, `ClipStatus`, `SocialPlatform`, `ProfileType`, `ProfileConnectionType` — vedi schema per i valori esatti.

## Indici e vincoli notevoli

- `Video.status`, `Clip.status`, `Job.status` indicizzati: sono i campi più filtrati dalla dashboard e dal polling di stato.
- `TrendSnapshot` con vincolo unico `(date, platform)`: un solo snapshot trend per piattaforma al giorno, evita duplicati dal cron giornaliero.
- `UsageCounter` con vincolo unico `(userId, periodStart)`.
