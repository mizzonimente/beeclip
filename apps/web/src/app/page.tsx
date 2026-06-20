import Link from "next/link";
import { Logo } from "@/components/layout/Logo";

// Landing page pubblica — struttura ispirata a opus.pro (hero con CTA forte,
// sezione "come funziona", grid di funzionalità, anteprima risultato, FAQ,
// CTA finale) ma con copy e dati onesti per BeeClip: nessuna metrica utenti/
// testimonial inventata. Dove opus.pro mostra "16M+ creator" o loghi cliente,
// qui c'è un'unica sezione di output di esempio etichettata esplicitamente
// "ESEMPIO" — mai presentata come dato reale.
//
// Niente "use client": è tutta markup statico, l'accordion FAQ usa
// <details>/<summary> nativi invece di stato React.

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Carica il video",
    description: "Da file (MP4, MOV, WebM) o da un link Google Drive pubblico. Niente scraping di piattaforme social.",
  },
  {
    step: "2",
    title: "Trascrizione e analisi AI",
    description: "Trascrizione automatica del parlato e analisi di hook, emozione, ritmo e potenziale di retention.",
  },
  {
    step: "3",
    title: "Clip pronte",
    description: "Candidati clip con punteggio virale, titolo, caption e hashtag suggeriti — in modalità auto o manuale.",
  },
  {
    step: "4",
    title: "Esporta nel formato giusto",
    description: "9:16, 1:1, 16:9 o 4:5 con crop intelligente, pronte da scaricare e pubblicare.",
  },
];

const FEATURES = [
  {
    title: "Analisi virale automatica",
    description:
      "Ogni clip candidata viene valutata su hook, emozione, ritmo e retention per assegnare un punteggio virale 0-100.",
  },
  {
    title: "Upload multi-sorgente",
    description:
      "Carica un file direttamente o importa da un link Google Drive pubblico: stessa pipeline di analisi per entrambi.",
  },
  {
    title: "Export multi-formato",
    description: "9:16, 1:1, 16:9, 4:5 e crop personalizzato, generati automaticamente da ogni clip selezionata.",
  },
  {
    title: "Caption e hashtag suggeriti",
    description: "Titolo, caption e hashtag proposti per ogni clip, pronti da rivedere prima della pubblicazione.",
  },
  {
    title: "Profili social collegati",
    description: "Analisi del tuo profilo e di profili di riferimento per generare clip coerenti col tuo tono di voce.",
  },
  {
    title: "Trend giornalieri",
    description: "Hashtag e suoni emergenti aggiornati ogni giorno per piattaforma, per restare sul pezzo.",
  },
];

const USE_CASES = [
  { title: "Creator indipendenti", description: "Trasforma podcast, dirette e long-form in clip pronte per ogni piattaforma." },
  { title: "Agenzie social", description: "Gestisci più progetti e profili cliente mantenendo un tono coerente per ciascuno." },
  { title: "Team marketing", description: "Riusa webinar, interviste e contenuti interni come materiale per i social." },
];

const FAQS = [
  {
    q: "Quali formati video posso caricare?",
    a: "MP4, MOV e WebM, sia come file diretto sia tramite link Google Drive pubblico ('chiunque abbia il link').",
  },
  {
    q: "Perché non posso incollare un link YouTube o TikTok?",
    a: "Scaricare video da quelle piattaforme richiederebbe scraping non autorizzato. Per questo offriamo solo upload file diretto e import da Google Drive pubblico.",
  },
  {
    q: "Come funziona il punteggio virale?",
    a: "Ogni candidato clip viene analizzato su hook iniziale, emozione, ritmo e potenziale di retention; il punteggio (0-100) ti aiuta a scegliere quali pubblicare prima.",
  },
  {
    q: "Posso scegliere io durata e numero di clip?",
    a: "Sì: in modalità manuale puoi impostare numero desiderato di clip, durata minima e massima; in automatico decide l'analisi AI.",
  },
  {
    q: "I dati di esempio nella pagina sono reali?",
    a: "No. Tutto ciò che è etichettato 'ESEMPIO' in questa pagina è un'illustrazione di come appare l'output, non una metrica reale di utenti o risultati.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface text-slate-100">
      {/* ───────────────────────── Nav ───────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-surface-border/60 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 lg:px-12">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-400 md:flex">
            <a href="#come-funziona" className="hover:text-slate-100">Come funziona</a>
            <a href="#funzionalita" className="hover:text-slate-100">Funzionalità</a>
            <a href="#faq" className="hover:text-slate-100">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white">
              Accedi
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-surface shadow-glow hover:bg-brand-600"
            >
              Inizia gratis
            </Link>
          </div>
        </div>
      </header>

      {/* ───────────────────────── Hero ───────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-[-10rem] mx-auto h-[28rem] max-w-3xl rounded-full bg-brand-500/10 blur-3xl"
        />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-6 py-20 text-center lg:py-28">
          <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-300">
            BeeClip · clip social generate dall&apos;AI
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight lg:text-5xl">
            Trasforma i tuoi video lunghi in clip che diventano virali
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-400">
            BeeClip analizza i tuoi contenuti come un social media manager esperto e genera automaticamente clip
            ottimizzate, con punteggio virale, caption e hashtag già pronti.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-surface shadow-glow hover:bg-brand-600"
            >
              Crea il tuo primo progetto
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-surface-border px-6 py-3 text-sm font-semibold text-slate-200 hover:border-brand-400/60"
            >
              Ho già un account
            </Link>
          </div>

          {/* Anteprima onesta del flusso reale: non un uploader funzionante
              per visitatori anonimi (richiede login/progetto), ma una
              rappresentazione fedele dei due modi reali di caricare un video. */}
          <div className="mt-16 grid w-full gap-3 rounded-2xl border border-surface-border bg-surface-raised p-4 text-left sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border border-surface-border bg-surface px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300">
                ↑
              </span>
              <div>
                <p className="text-sm font-medium text-slate-100">Carica un file</p>
                <p className="text-xs text-slate-500">MP4, MOV, WebM — direttamente dal tuo computer</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-surface-border bg-surface px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300">
                ⛓
              </span>
              <div>
                <p className="text-sm font-medium text-slate-100">Oppure incolla un link Drive</p>
                <p className="text-xs text-slate-500">Link Google Drive pubblico, nessun account da collegare</p>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">Disponibile dopo la registrazione, dentro ogni progetto.</p>
        </div>
      </section>

      {/* ───────────────────────── Come funziona ───────────────────────── */}
      <section id="come-funziona" className="border-t border-surface-border/60 px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold lg:text-3xl">Come funziona</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="rounded-xl border border-surface-border bg-surface-raised p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-surface">
                  {item.step}
                </span>
                <h3 className="mt-4 text-sm font-semibold text-slate-100">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── Funzionalità ───────────────────────── */}
      <section id="funzionalita" className="border-t border-surface-border/60 px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold lg:text-3xl">Tutto quello che serve per pubblicare di più</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-xl border border-surface-border bg-surface-raised p-6">
                <h3 className="text-sm font-semibold text-slate-100">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── Esempio output (onesto) ───────────────────────── */}
      <section className="border-t border-surface-border/60 px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-300">
            ESEMPIO — non un risultato reale
          </span>
          <h2 className="mt-4 text-2xl font-bold lg:text-3xl">Cosa ottieni per ogni clip</h2>
          <p className="mt-3 text-sm text-slate-400">
            Un&apos;illustrazione di come si presenta una clip generata. I valori reali dipendono dal tuo video.
          </p>
        </div>
        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-surface-border bg-surface-raised p-6 text-left">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
              87/100 · viral score (esempio)
            </span>
            <span className="text-xs text-slate-500">00:42</span>
          </div>
          <p className="mt-4 text-sm font-medium text-slate-100">
            &quot;Il trucco che nessuno ti dice su…&quot; (titolo suggerito, esempio)
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Caption ed hashtag suggeriti compaiono qui, pronti da rivedere prima di esportare. (esempio)
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["9:16", "1:1", "4:5"].map((format) => (
              <span key={format} className="rounded-md border border-surface-border px-2 py-1 text-xs text-slate-400">
                {format}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── A chi è utile ───────────────────────── */}
      <section className="border-t border-surface-border/60 px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold lg:text-3xl">Pensato per chi pubblica contenuti ogni giorno</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {USE_CASES.map((useCase) => (
              <div key={useCase.title} className="rounded-xl border border-surface-border bg-surface-raised p-6 text-center">
                <h3 className="text-sm font-semibold text-slate-100">{useCase.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{useCase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── FAQ ───────────────────────── */}
      <section id="faq" className="border-t border-surface-border/60 px-6 py-20 lg:px-12">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center text-2xl font-bold lg:text-3xl">Domande frequenti</h2>
          <div className="mt-10 flex flex-col gap-3">
            {FAQS.map((item) => (
              <details key={item.q} className="group rounded-xl border border-surface-border bg-surface-raised p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-100">
                  {item.q}
                  <span className="ml-3 text-brand-300 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-slate-400">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── CTA finale ───────────────────────── */}
      <section className="border-t border-surface-border/60 px-6 py-20 text-center lg:px-12">
        <h2 className="text-2xl font-bold lg:text-3xl">Pronta a trasformare il tuo primo video?</h2>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-surface shadow-glow hover:bg-brand-600"
          >
            Inizia gratis
          </Link>
        </div>
      </section>

      {/* ───────────────────────── Footer ───────────────────────── */}
      <footer className="border-t border-surface-border/60 px-6 py-10 lg:px-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Logo size="sm" />
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} BeeClip</p>
        </div>
      </footer>
    </div>
  );
}
