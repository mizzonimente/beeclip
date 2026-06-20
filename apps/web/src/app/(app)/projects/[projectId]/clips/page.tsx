"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import { CLIP_FORMAT_OPTIONS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime, formatDuration, formatBytes, scoreTone } from "@/lib/utils";
import type { ClipFormatKey } from "@clipmanager/shared";

function formatLabel(format: ClipFormatKey): string {
  return CLIP_FORMAT_OPTIONS.find((o) => o.value === format)?.label ?? format;
}

export default function ProjectClipsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  // Una sola query combinata: la lista clip (con candidate/analysisResult
  // annidati, vedi api.clips.listByProject) e lo storico delle esportazioni
  // (più esportazioni possono riferirsi alla stessa clip se la si rigenera).
  const { data, loading, error, refetch } = useApiQuery(
    () => Promise.all([api.clips.listByProject(projectId), api.clips.exportHistory(projectId)]),
    [projectId],
  );

  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDownload(clipId: string) {
    setDownloadError(null);
    setDownloadingId(clipId);
    try {
      const { url } = await api.clips.getDownloadUrl(clipId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : "Impossibile generare il link di download.");
    } finally {
      setDownloadingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return <Alert variant="error">{error ?? "Impossibile caricare le clip."}</Alert>;
  }

  const [{ clips }, { history }] = data;
  const sortedClips = [...clips].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.exportedAt).getTime() - new Date(a.exportedAt).getTime(),
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href={`/projects/${projectId}`} className="text-sm text-slate-500 hover:text-slate-300">
            ← Torna al progetto
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-100">Clip del progetto</h1>
          <p className="mt-1 text-sm text-slate-400">Tutte le clip generate e lo storico delle esportazioni.</p>
        </div>
        <Button variant="secondary" onClick={refetch}>
          Aggiorna
        </Button>
      </div>

      {downloadError && <Alert variant="error">{downloadError}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Clip ({sortedClips.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedClips.length === 0 ? (
            <EmptyState
              title="Nessuna clip ancora generata"
              description="Carica un video e avvia l'export di una clip da uno dei momenti individuati dall'AI."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {sortedClips.map((clip) => {
                const analysis = clip.clipCandidate?.analysisResult;
                return (
                  <li
                    key={clip.id}
                    className="flex flex-col gap-3 rounded-lg border border-surface-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-100">
                          {analysis?.suggestedTitle ?? formatLabel(clip.format)}
                        </p>
                        {analysis && (
                          <Badge variant={scoreTone(analysis.viralScore)}>{analysis.viralScore}/100</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatLabel(clip.format)}
                        {clip.durationSeconds ? ` · ${formatDuration(clip.durationSeconds)}` : ""} · creata il{" "}
                        {formatDateTime(clip.createdAt)}
                      </p>
                      {clip.status === "FAILED" && clip.errorMessage && (
                        <p className="mt-1 text-xs text-red-400">{clip.errorMessage}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={clip.status} />
                      {clip.status === "READY" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          isLoading={downloadingId === clip.id}
                          onClick={() => handleDownload(clip.id)}
                        >
                          Scarica
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Storico esportazioni ({sortedHistory.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedHistory.length === 0 ? (
            <EmptyState
              title="Nessuna esportazione ancora completata"
              description="Quando una clip viene esportata con successo, apparirà qui con dimensione e data."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-border text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4 font-medium">Formato</th>
                    <th className="py-2 pr-4 font-medium">Dimensione</th>
                    <th className="py-2 pr-4 font-medium">Esportata il</th>
                    <th className="py-2 pr-4 font-medium">Stato</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {sortedHistory.map((entry) => (
                    <tr key={entry.id} className="border-b border-surface-border/60 last:border-0">
                      <td className="py-2.5 pr-4 text-slate-200">{formatLabel(entry.format)}</td>
                      <td className="py-2.5 pr-4 text-slate-400">{formatBytes(entry.sizeBytes)}</td>
                      <td className="py-2.5 pr-4 text-slate-400">{formatDateTime(entry.exportedAt)}</td>
                      <td className="py-2.5 pr-4">
                        <StatusBadge status={entry.clip.status} />
                      </td>
                      <td className="py-2.5 text-right">
                        {entry.clip.status === "READY" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            isLoading={downloadingId === entry.clipId}
                            onClick={() => handleDownload(entry.clipId)}
                          >
                            Scarica
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
