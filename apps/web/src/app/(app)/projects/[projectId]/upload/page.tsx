"use client";

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ContentTypeKey, ClipFormatKey } from "@clipmanager/shared";
import { api, ApiError } from "@/lib/api";
import { CONTENT_TYPE_OPTIONS, CLIP_FORMAT_OPTIONS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatBytes } from "@/lib/utils";

const MODE_OPTIONS = [
  { value: "AUTO", label: "Automatica — decide l'AI" },
  { value: "MANUAL", label: "Manuale — imposto io i parametri" },
];

type SourceTab = "FILE" | "DRIVE" | "SOCIAL";

const SOURCE_TABS: { value: SourceTab; label: string }[] = [
  { value: "FILE", label: "File dal computer" },
  { value: "DRIVE", label: "Link Google Drive" },
  { value: "SOCIAL", label: "Link YouTube / social" },
];

export default function UploadVideoPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const router = useRouter();

  const [sourceTab, setSourceTab] = useState<SourceTab>("FILE");
  const [file, setFile] = useState<File | null>(null);
  const [driveUrl, setDriveUrl] = useState("");
  const [contentType, setContentType] = useState<ContentTypeKey | "">("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mode, setMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [desiredClipCount, setDesiredClipCount] = useState("");
  const [avgClipDurationSeconds, setAvgClipDurationSeconds] = useState("");
  const [minClipDurationSeconds, setMinClipDurationSeconds] = useState("15");
  const [maxClipDurationSeconds, setMaxClipDurationSeconds] = useState("90");
  const [formats, setFormats] = useState<ClipFormatKey[]>(["VERTICAL_9_16"]);

  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
  }

  function toggleFormat(value: ClipFormatKey) {
    setFormats((prev) => {
      if (prev.includes(value)) {
        // Lo schema richiede almeno un formato: non permettere di togliere l'ultimo.
        if (prev.length === 1) return prev;
        return prev.filter((f) => f !== value);
      }
      return [...prev, value];
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const min = Number(minClipDurationSeconds);
    const max = Number(maxClipDurationSeconds);
    if (min > max) {
      setError("La durata minima della clip non può superare quella massima.");
      return;
    }
    if (avgClipDurationSeconds) {
      const avg = Number(avgClipDurationSeconds);
      if (avg < min || avg > max) {
        setError("La durata media deve essere compresa tra la durata minima e massima della clip.");
        return;
      }
    }

    const generationConfig = {
      mode,
      minClipDurationSeconds: min,
      maxClipDurationSeconds: max,
      formats,
      ...(mode === "MANUAL" && desiredClipCount ? { desiredClipCount: Number(desiredClipCount) } : {}),
      ...(avgClipDurationSeconds ? { avgClipDurationSeconds: Number(avgClipDurationSeconds) } : {}),
    };

    if (sourceTab === "FILE") {
      if (!file) {
        setError("Seleziona un file video.");
        return;
      }
      setIsUploading(true);
      setProgress(0);
      try {
        const { video } = await api.videos.upload({
          projectId,
          file,
          contentType: contentType || undefined,
          generationConfig,
          onProgress: setProgress,
        });
        router.push(`/projects/${projectId}/videos/${video.id}`);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Upload non riuscito, riprova.");
        setIsUploading(false);
        setProgress(null);
      }
      return;
    }

    if (sourceTab === "DRIVE") {
      if (!driveUrl.trim()) {
        setError("Incolla il link di condivisione del file Google Drive.");
        return;
      }
      setIsUploading(true);
      try {
        const { video } = await api.videos.createFromDriveLink({
          projectId,
          driveUrl: driveUrl.trim(),
          contentType: contentType || undefined,
          generationConfig,
        });
        router.push(`/projects/${projectId}/videos/${video.id}`);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Import da Google Drive non riuscito, riprova.");
        setIsUploading(false);
      }
      return;
    }

    // sourceTab === "SOCIAL": il pulsante di invio non è nemmeno mostrato in
    // questa tab (vedi sotto), quindi questo ramo non è raggiungibile.
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/projects/${projectId}`} className="text-sm text-slate-500 hover:text-slate-300">
          ← Torna al progetto
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100">Carica un nuovo video</h1>
        <p className="mt-1 text-sm text-slate-400">
          Una volta caricato, avvieremo automaticamente trascrizione, analisi e generazione delle clip.
        </p>
      </div>

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {error && <Alert variant="error">{error}</Alert>}

            <div className="flex flex-wrap gap-2 rounded-lg border border-surface-border bg-surface-raised p-1">
              {SOURCE_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    setSourceTab(tab.value);
                    setError(null);
                  }}
                  disabled={isUploading}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    sourceTab === tab.value
                      ? "bg-brand-500 text-surface"
                      : "text-slate-400 hover:bg-surface hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {sourceTab === "FILE" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-300">File video</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="block w-full cursor-pointer rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-brand-500 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-surface hover:file:bg-brand-600"
                />
                {file && (
                  <p className="text-xs text-slate-500">
                    {file.name} · {formatBytes(file.size)}
                  </p>
                )}
              </div>
            )}

            {sourceTab === "DRIVE" && (
              <div className="flex flex-col gap-2">
                <Input
                  label="Link di condivisione Google Drive"
                  type="url"
                  placeholder="https://drive.google.com/file/d/.../view"
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  disabled={isUploading}
                  helperText="Il file su Drive deve essere condiviso con 'Chiunque abbia il link' (almeno come visualizzatore), altrimenti non riusciamo a scaricarlo."
                />
              </div>
            )}

            {sourceTab === "SOCIAL" && (
              <Alert variant="info">
                Non disponibile: YouTube e i social non offrono un modo ufficiale per scaricare automaticamente un
                video, nemmeno il proprio. Scarica il file dalla piattaforma (es. da YouTube Studio, o salvando il
                video da TikTok/Instagram) e caricalo qui usando la tab &quot;File dal computer&quot;.
              </Alert>
            )}

            {sourceTab !== "SOCIAL" && (
              <>
                <Select
                  label="Tipo di contenuto (opzionale)"
                  options={[{ value: "", label: "Usa il tipo di contenuto del progetto" }, ...CONTENT_TYPE_OPTIONS]}
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value as ContentTypeKey | "")}
                  disabled={isUploading}
                />

                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="self-start text-sm font-medium text-brand-300 hover:text-brand-200"
                >
                  {showAdvanced ? "Nascondi configurazione avanzata" : "Configurazione avanzata clip"}
                </button>

                {showAdvanced && (
                  <div className="flex flex-col gap-4 rounded-lg border border-surface-border p-4">
                    <Select
                      label="Modalità di generazione"
                      options={MODE_OPTIONS}
                      value={mode}
                      onChange={(e) => setMode(e.target.value as "AUTO" | "MANUAL")}
                      disabled={isUploading}
                    />

                    {mode === "MANUAL" && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input
                          label="Numero di clip desiderato"
                          type="number"
                          min={1}
                          max={50}
                          value={desiredClipCount}
                          onChange={(e) => setDesiredClipCount(e.target.value)}
                          disabled={isUploading}
                          placeholder="Lascia vuoto per lasciare decidere l'AI"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <Input
                        label="Durata media clip (secondi)"
                        type="number"
                        min={5}
                        max={600}
                        value={avgClipDurationSeconds}
                        onChange={(e) => setAvgClipDurationSeconds(e.target.value)}
                        disabled={isUploading}
                        placeholder="Lascia vuoto per lasciare decidere l'AI"
                        helperText="Le clip generate punteranno a questa durata, quando il contenuto lo permette."
                      />
                      <Input
                        label="Durata minima clip (secondi)"
                        type="number"
                        min={5}
                        max={600}
                        value={minClipDurationSeconds}
                        onChange={(e) => setMinClipDurationSeconds(e.target.value)}
                        disabled={isUploading}
                      />
                      <Input
                        label="Durata massima clip (secondi)"
                        type="number"
                        min={5}
                        max={600}
                        value={maxClipDurationSeconds}
                        onChange={(e) => setMaxClipDurationSeconds(e.target.value)}
                        disabled={isUploading}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-slate-300">Formati di export</span>
                      <div className="flex flex-wrap gap-3">
                        {CLIP_FORMAT_OPTIONS.map((opt) => (
                          <label
                            key={opt.value}
                            className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm text-slate-300"
                          >
                            <input
                              type="checkbox"
                              checked={formats.includes(opt.value)}
                              onChange={() => toggleFormat(opt.value)}
                              disabled={isUploading}
                              className="h-4 w-4 rounded border-surface-border bg-surface text-brand-500 focus:ring-brand-400/50"
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {progress !== null && (
              <div className="flex flex-col gap-1.5">
                <ProgressBar value={progress} />
                <p className="text-xs text-slate-500">{progress}% caricato</p>
              </div>
            )}

            {sourceTab !== "SOCIAL" && (
              <Button type="submit" isLoading={isUploading} className="self-start">
                {sourceTab === "FILE" ? "Carica e avvia analisi" : "Importa da Drive e avvia analisi"}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cosa succede dopo</CardTitle>
          <CardDescription>
            Estrazione audio, trascrizione, individuazione dei momenti migliori (hook, emozione, ritmo, chiarezza del
            messaggio) e generazione delle clip nei formati scelti. Potrai seguire l&apos;avanzamento dalla pagina del
            video.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
