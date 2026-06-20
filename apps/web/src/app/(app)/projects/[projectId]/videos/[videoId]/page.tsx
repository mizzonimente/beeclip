"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ClipFormatKey } from "@clipmanager/shared";
import { api, ApiError } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import { CLIP_FORMAT_OPTIONS, CROP_MODE_OPTIONS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatDuration, scoreTone } from "@/lib/utils";
import type { ClipCandidate, CropModeKey } from "@/lib/types";

const TERMINAL_VIDEO_STATUSES = new Set(["READY", "FAILED"]);
const TERMINAL_CLIP_STATUSES = new Set(["READY", "FAILED"]);

export default function VideoDetailPage() {
  const params = useParams<{ projectId: string; videoId: string }>();
  const { projectId, videoId } = params;
  const { data, loading, error, refetch } = useApiQuery(() => api.videos.get(videoId), [videoId]);

  // Il video passa per più stadi asincroni (estrazione audio, trascrizione,
  // analisi, rendering) gestiti dai worker BullMQ: non avendo un endpoint di
  // streaming dedicato, eseguiamo polling leggero finché video e clip non
  // raggiungono uno stato terminale (READY/FAILED).
  useEffect(() => {
    if (!data) return;
    const videoPending = !TERMINAL_VIDEO_STATUSES.has(data.video.status);
    const anyClipPending = data.video.clipCandidates.some((c) =>
      c.clips.some((clip) => !TERMINAL_CLIP_STATUSES.has(clip.status)),
    );
    if (!videoPending && !anyClipPending) return;
    const interval = setInterval(() => refetch(), 4000);
    return () => clearInterval(interval);
  }, [data, refetch]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return <Alert variant="error">{error ?? "Video non trovato."}</Alert>;
  }

  const { video } = data;
  const candidates = [...video.clipCandidates].sort((a, b) => b.aggregateScore - a.aggregateScore);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={`/projects/${projectId}`} className="text-sm text-slate-500 hover:text-slate-300">
          ← Torna al progetto
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-100">{video.originalFilename}</h1>
          <StatusBadge status={video.status} />
        </div>
        <p className="mt-1 text-sm text-slate-400">
          {formatDuration(video.durationSeconds)}
          {video.width && video.height ? ` · ${video.width}×${video.height}` : ""}
          {video.fps ? ` · ${video.fps} fps` : ""} · caricato il {formatDate(video.createdAt)}
        </p>
      </div>

      {video.status === "FAILED" && video.errorMessage && <Alert variant="error">{video.errorMessage}</Alert>}

      {!TERMINAL_VIDEO_STATUSES.has(video.status) && (
        <Alert variant="info">
          Elaborazione in corso ({video.status === "EXTRACTING_AUDIO" && "estrazione audio"}
          {video.status === "TRANSCRIBING" && "trascrizione"}
          {video.status === "ANALYZING" && "analisi dei momenti migliori"}
          {video.status === "RENDERING_CLIPS" && "generazione clip"}
          {video.status === "UPLOADED" && "in coda"}). Questa pagina si aggiorna automaticamente.
        </Alert>
      )}

      {video.transcript && (
        <Card>
          <CardHeader>
            <CardTitle>Trascrizione</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-xs text-slate-500">
              Lingua: {video.transcript.language} · provider: {video.transcript.provider}
            </p>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-surface-border bg-surface p-3 text-sm leading-relaxed text-slate-300">
              {video.transcript.fullText}
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold text-slate-100">Momenti individuati dall&apos;AI ({candidates.length})</h2>
        <p className="mt-1 text-sm text-slate-400">
          Ordinati per punteggio aggregato: hook, emozione, retention, ritmo, chiarezza e capacità di funzionare come
          contenuto autonomo.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          {candidates.length === 0 ? (
            <EmptyState
              title="Nessun momento ancora individuato"
              description="Una volta completata l'analisi, qui appariranno i segmenti candidati a diventare clip."
            />
          ) : (
            candidates.map((candidate) => (
              <ClipCandidateCard key={candidate.id} candidate={candidate} onChanged={refetch} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-center">
      <p className="text-base font-semibold text-slate-100">{Math.round(value)}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

function ClipCandidateCard({
  candidate,
  onChanged,
}: {
  candidate: ClipCandidate;
  onChanged: () => void;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const analysis = candidate.analysisResult;

  async function handleDownload(clipId: string) {
    setDownloadError(null);
    try {
      const { url } = await api.clips.getDownloadUrl(clipId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : "Impossibile generare il link di download.");
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 p-5 pb-0">
        <div>
          <CardTitle>
            {formatDuration(candidate.startSeconds)} – {formatDuration(candidate.endSeconds)}
          </CardTitle>
          <p className="mt-1 text-sm text-slate-400">{candidate.rationale}</p>
        </div>
        <div className="flex items-center gap-2">
          {candidate.selected && <Badge variant="brand">Selezionata dall&apos;AI</Badge>}
          <Badge variant={scoreTone(candidate.aggregateScore)}>{Math.round(candidate.aggregateScore)}/100</Badge>
        </div>
      </div>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <ScoreStat label="Hook" value={candidate.hookScore} />
          <ScoreStat label="Emozione" value={candidate.emotionScore} />
          <ScoreStat label="Retention" value={candidate.retentionScore} />
          <ScoreStat label="Ritmo" value={candidate.pacingScore} />
          <ScoreStat label="Chiarezza" value={candidate.clarityScore} />
          <ScoreStat label="Autonomia" value={candidate.standaloneScore} />
        </div>

        {candidate.emotionTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {candidate.emotionTags.map((tag) => (
              <Badge key={tag} variant="neutral">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {analysis && (
          <div className="flex flex-col gap-3 rounded-lg border border-surface-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-100">{analysis.suggestedTitle}</p>
              <Badge variant={scoreTone(analysis.viralScore)}>Viral score: {analysis.viralScore}/100</Badge>
            </div>
            <p className="text-sm text-slate-400">{analysis.viralReasoning}</p>
            <p className="text-sm text-slate-300">{analysis.suggestedDescription}</p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-400">Punti di forza</p>
                <ul className="mt-1 list-inside list-disc text-sm text-slate-400">
                  {analysis.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-amber-400">Rischi</p>
                <ul className="mt-1 list-inside list-disc text-sm text-slate-400">
                  {analysis.weaknesses.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-slate-500">Hook suggerito:</span> <span className="text-slate-300">{analysis.suggestedHook}</span>
              </p>
              <p>
                <span className="text-slate-500">Testo overlay:</span>{" "}
                <span className="text-slate-300">{analysis.suggestedOverlayText}</span>
              </p>
              <p className="sm:col-span-2">
                <span className="text-slate-500">Caption:</span> <span className="text-slate-300">{analysis.suggestedCaption}</span>
              </p>
              <p className="sm:col-span-2">
                <span className="text-slate-500">Copertina:</span>{" "}
                <span className="text-slate-300">{analysis.suggestedCoverHint}</span>
              </p>
            </div>

            {analysis.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {analysis.hashtags.map((tag) => (
                  <Badge key={tag} variant="brand">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {downloadError && <Alert variant="error">{downloadError}</Alert>}

        {candidate.clips.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Export generati</p>
            <ul className="flex flex-col gap-2">
              {candidate.clips.map((clip) => (
                <li
                  key={clip.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-surface-border px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <span>{CLIP_FORMAT_OPTIONS.find((o) => o.value === clip.format)?.label ?? clip.format}</span>
                    {clip.durationSeconds && <span className="text-slate-500">· {formatDuration(clip.durationSeconds)}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={clip.status} />
                    {clip.status === "READY" && (
                      <Button size="sm" variant="secondary" onClick={() => handleDownload(clip.id)}>
                        Scarica
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isExporting ? (
          <ExportClipForm
            candidateId={candidate.id}
            onDone={() => {
              setIsExporting(false);
              onChanged();
            }}
            onCancel={() => setIsExporting(false)}
          />
        ) : (
          <Button size="sm" variant="secondary" className="self-start" onClick={() => setIsExporting(true)}>
            Esporta clip
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ExportClipForm({
  candidateId,
  onDone,
  onCancel,
}: {
  candidateId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [format, setFormat] = useState<ClipFormatKey>("VERTICAL_9_16");
  const [cropMode, setCropMode] = useState<CropModeKey>("SMART");
  const [x, setX] = useState("0");
  const [y, setY] = useState("0");
  const [width, setWidth] = useState("1080");
  const [height, setHeight] = useState("1920");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.clips.exportCandidate(candidateId, {
        format,
        cropMode,
        ...(cropMode === "MANUAL"
          ? { customCrop: { x: Number(x), y: Number(y), width: Number(width), height: Number(height) } }
          : {}),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Esportazione non riuscita.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-surface-border p-4">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="Formato"
          options={CLIP_FORMAT_OPTIONS}
          value={format}
          onChange={(e) => setFormat(e.target.value as ClipFormatKey)}
        />
        <Select
          label="Modalità crop"
          options={CROP_MODE_OPTIONS}
          value={cropMode}
          onChange={(e) => setCropMode(e.target.value as CropModeKey)}
        />
      </div>

      {cropMode === "MANUAL" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Input label="X (px)" type="number" value={x} onChange={(e) => setX(e.target.value)} />
          <Input label="Y (px)" type="number" value={y} onChange={(e) => setY(e.target.value)} />
          <Input label="Larghezza (px)" type="number" value={width} onChange={(e) => setWidth(e.target.value)} />
          <Input label="Altezza (px)" type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
        </div>
      )}
      {cropMode === "MANUAL" && (
        <p className="text-xs text-slate-500">Coordinate in pixel rispetto al video originale.</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" isLoading={isSubmitting}>
          Conferma export
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Annulla
        </Button>
      </div>
    </form>
  );
}
