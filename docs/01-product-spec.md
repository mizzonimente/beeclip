# ClipManager AI — Specifica di Prodotto

Versione 0.1 — 16/06/2026

## 1. Visione

ClipManager AI è una piattaforma SaaS che trasforma un video lungo in clip brevi pronte per i social, comportandosi come un social media manager esperto: non taglia a caso, ma capisce hook, ritmo, emozione, storytelling e potenziale di retention, e propone clip già pronte per la pubblicazione con titolo, caption, hashtag e formato corretto.

Non è un tool di trascrizione né un semplice "auto-cut by silence". Il differenziale è il livello di analisi (narrativo + tecnico + di marketing) e la coerenza con il brand e i trend del giorno.

## 2. Target

- Creator indipendenti (YouTuber, podcaster, educator) che vogliono riutilizzare contenuti lunghi.
- Social media manager e agenzie che gestiscono più clienti/profili.
- Aziende con contenuti corporate, interviste, webinar, eventi.

## 3. Problema risolto

Trasformare 1 video lungo in N clip short-form richiede oggi ore di lavoro manuale: rivedere il video, individuare i momenti migliori, tagliare, sottotitolare, adattare il formato per ogni piattaforma, scrivere caption e hashtag, e capire cosa è in tendenza. ClipManager AI comprime questo lavoro in un processo automatico supervisionabile.

## 4. Funzionalità principali (mappate ai moduli tecnici in `02-architecture.md`)

### 4.1 Upload e contesto del progetto

- Upload video lunghi (mp4, mov, webm), upload diretto o multipart per file grandi.
- Metadati progetto: titolo, descrizione, settore, obiettivo del contenuto (educare / intrattenere / vendere / fare brand awareness), target audience.
- Questi metadati condizionano il prompt di analisi AI (es. un video "vendita" privilegia clip con CTA e obiezioni risolte; un video "intrattenimento" privilegia battute e colpi di scena).

### 4.2 Analisi intelligente del video

Pipeline di analisi multi-segnale, eseguita in background (job asincrono):

1. **Trascrizione completa** con timestamp parola-per-parola e frase-per-frase.
2. **Segmentazione semantica**: il video viene diviso in "beat" narrativi (non semplici frasi) usando pause, cambi di argomento e cambi di intonazione/ritmo del parlato.
3. **Analisi multimodale per ogni beat**:
   - Forza del hook (le prime 1-3 frasi trattengono l'attenzione?).
   - Carica emotiva (sorpresa, rabbia, gioia, tensione, commozione).
   - Densità informativa / chiarezza del messaggio.
   - Autonomia del segmento (ha senso se isolato dal resto del video?).
   - Cambi di inquadratura e di ritmo (rilevati via analisi visiva: scene change detection).
   - Espressioni facciali quando rilevabili (via face/emotion detection, modulo opzionale).
   - Pause, silenzi e momenti morti (per il taglio, non per la selezione).
   - Potenziale di retention (curva attesa di drop-off, stimata da pattern linguistici e ritmo).
4. **Output dell'analisi**: lista di "clip candidate" con range temporale, punteggio per ciascun criterio, punteggio aggregato, e motivazione testuale.

### 4.3 Generazione automatica delle clip

L'utente configura:

- Numero di clip desiderate (oppure "automatico": l'AI decide quante ne valgono la pena).
- Durata media, minima, massima.
- Tipo di contenuto: educativo, entertainment, promo, podcast, intervista, vlog, backstage, musica, aziendale, creator content (questo influenza i criteri di scoring, non solo i metadati).

### 4.4 Formati di esportazione

- 9:16 (TikTok, Reels, Shorts), 1:1, 16:9, 4:5, custom crop manuale.
- **Auto-crop intelligente**: segue il soggetto principale; in v1 usa un crop "rule-of-thirds" pesato sul centro visivo della scena (centroide di movimento), con punto di estensione per face-tracking via modulo CV dedicato (vedi `02-architecture.md`, modulo `smart-crop`).

### 4.5 Valutazione viralità (per ogni clip)

- Titolo suggerito, descrizione breve, caption pronta, hook testuale, hashtag consigliati.
- Viral score 0–100, con motivazione esplicita (quali criteri hanno pesato).
- Punti di forza e possibili debolezze/rischi (es. "hook forte ma payoff lento dopo 8s").
- Suggerimento testo in sovrimpressione e suggerimento per la copertina/thumbnail.

### 4.6 Analisi profili social (cliente + reference)

- Collegamento del profilo del cliente (account proprio, via OAuth dove l'API ufficiale lo consente) e/o inserimento manuale di profili reference.
- Estrazione di tone of voice, formati ricorrenti, hashtag usati, stile visivo, frequenza di pubblicazione, contenuti migliori, pattern di engagement.
- Questi dati arricchiscono il prompt di generazione: le clip e le caption proposte sono coerenti con lo stile del cliente o dei reference scelti.
- **Nota importante sui limiti reali delle API social**: le API ufficiali (Instagram Graph API, TikTok for Developers) permettono in modo affidabile l'accesso ai dati del **proprio account autenticato via OAuth**, non lo scraping di profili di terzi. Per i profili reference di terzi, la piattaforma è progettata per collegarsi a provider di dati con licenza (es. servizi di social analytics B2B) oppure per accettare dati incollati manualmente dall'utente, mai per scraping non autorizzato.

### 4.7 Trend giornalieri

- Job giornaliero che aggiorna: trend TikTok/Reels/Shorts, suoni in crescita, hashtag emergenti, format virali, nicchie in crescita.
- Stessa nota sui limiti API: in v1 il modulo trend è alimentato da provider dati con licenza o da un feed curato/configurabile; l'interfaccia è già pronta per collegare provider terzi (vedi `02-architecture.md`).
- Homepage aziendale con: trend del giorno, suoni consigliati, hashtag consigliati, idee contenuto, suggerimenti applicati ai video già caricati dal cliente.

### 4.8 Editing automatico

- Taglio preciso sui beat selezionati.
- Sottotitoli automatici (burn-in) con evidenziazione parole chiave.
- Zoom automatico nei momenti identificati come "alta energia".
- Rimozione pause/silenzi superiori a soglia configurabile.
- Suggerimento (non automatico in v1) di B-roll e testo dinamico aggiuntivo.

### 4.9 Dashboard

- Progetti, video caricati, clip generate, stato elaborazione, viral score, formato, download, cronologia esportazioni, trend del giorno, analisi profilo cliente e reference.

### 4.10 Piani SaaS

- Limiti per piano: minuti di video processati/mese, numero clip/mese, numero profili reference, risoluzione export, accesso a provider trend premium.
- Schema dati pronto per integrazione Stripe (subscription, usage metering) — vedi `04-database-schema.md`.

## 5. Fuori scope per la v1 (dichiarato esplicitamente, non nascosto)

- Pubblicazione automatica diretta sui social (richiede API di pubblicazione ufficiali per account — pianificabile in v2 con Instagram Content Publishing API / TikTok Content Posting API, entrambe disponibili solo per account business verificati).
- Face-tracking video in tempo reale "broadcast quality" — v1 usa crop intelligente euristico, v2 introduce un modulo CV dedicato.
- Scraping non autorizzato di profili terzi — sostituito da provider con licenza o input manuale.

## 6. Metriche di successo del prodotto

- Tempo medio per ottenere la prima clip pubblicabile da un video caricato.
- % di clip generate effettivamente pubblicate dall'utente (proxy di qualità della selezione AI).
- Correlazione tra viral score stimato e performance reale post-pubblicazione (richiede feedback loop, vedi `05-roadmap.md`).
