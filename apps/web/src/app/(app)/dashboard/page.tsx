"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { formatDate, formatDuration, scoreTone } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error } = useApiQuery(() => api.dashboard.get(), []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return <Alert variant="error">{error ?? "Impossibile caricare la dashboard."}</Alert>;
  }

  const { projects, recentVideos, recentClips, ownProfile, trends, usage } = data;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Ciao, {user?.name?.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-slate-400">Ecco lo stato dei tuoi progetti e delle tue clip.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Progetti" value={projects.length} />
        <StatCard label="Video recenti" value={recentVideos.length} />
        <StatCard label="Clip generate (periodo)" value={usage?.clipsGenerated ?? 0} />
        <StatCard label="Minuti elaborati (periodo)" value={usage ? Math.round(usage.minutesProcessed) : 0} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Video recenti</CardTitle>
          </CardHeader>
          <CardContent>
            {recentVideos.length === 0 ? (
              <EmptyState
                title="Nessun video ancora"
                description="Carica il tuo primo video da un progetto per iniziare."
                action={
                  <Link href="/projects">
                    <Button size="sm">Vai ai progetti</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {recentVideos.map((video) => (
                  <li key={video.id}>
                    <Link
                      href={`/projects/${video.projectId}/videos/${video.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-surface-border px-3 py-2 transition-colors hover:border-brand-400/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-100">{video.originalFilename}</p>
                        <p className="text-xs text-slate-500">
                          {video.project?.title ?? "Progetto"} · {formatDuration(video.durationSeconds)}
                        </p>
                      </div>
                      <StatusBadge status={video.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clip recenti</CardTitle>
          </CardHeader>
          <CardContent>
            {recentClips.length === 0 ? (
              <EmptyState title="Nessuna clip ancora" description="Le clip generate dai tuoi video appariranno qui." />
            ) : (
              <ul className="flex flex-col gap-3">
                {recentClips.map((clip) => {
                  const score = clip.clipCandidate?.analysisResult?.viralScore;
                  return (
                    <li key={clip.id}>
                      <Link
                        href={`/projects/${clip.projectId}/clips`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-surface-border px-3 py-2 transition-colors hover:border-brand-400/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-100">
                            {clip.clipCandidate?.analysisResult?.suggestedTitle ?? clip.format}
                          </p>
                          <p className="text-xs text-slate-500">
                            {clip.format} · {formatDuration(clip.durationSeconds)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {typeof score === "number" && <Badge variant={scoreTone(score)}>{score}/100</Badge>}
                          <StatusBadge status={clip.status} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Il tuo profilo social</CardTitle>
          </CardHeader>
          <CardContent>
            {ownProfile ? (
              <div className="flex flex-col gap-2 text-sm">
                <p className="text-slate-300">
                  <span className="text-slate-500">Handle:</span> {ownProfile.handle} ({ownProfile.platform})
                </p>
                {ownProfile.toneOfVoice && <p className="text-slate-400">Tono di voce: {ownProfile.toneOfVoice}</p>}
                <p className="text-xs text-slate-500">
                  Ultima analisi: {ownProfile.lastAnalyzedAt ? formatDate(ownProfile.lastAnalyzedAt) : "in corso"}
                </p>
                <Link href="/social-profiles" className="text-sm font-medium text-brand-300 hover:text-brand-200">
                  Vedi dettagli →
                </Link>
              </div>
            ) : (
              <EmptyState
                title="Nessun profilo collegato"
                description="Collega il tuo profilo per generare clip coerenti col tuo brand."
                action={
                  <Link href="/social-profiles">
                    <Button size="sm">Collega profilo</Button>
                  </Link>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trend di oggi</CardTitle>
          </CardHeader>
          <CardContent>
            {trends.length === 0 ? (
              <EmptyState title="Nessun trend disponibile" description="I trend giornalieri appariranno qui." />
            ) : (
              <ul className="flex flex-col gap-3">
                {trends.slice(0, 3).map((trend) => (
                  <li key={trend.id} className="rounded-lg border border-surface-border px-3 py-2">
                    <p className="text-sm font-medium text-slate-100">{trend.platform}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {trend.emergingHashtags.slice(0, 4).join(" ") || "—"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/trends" className="mt-3 inline-block text-sm font-medium text-brand-300 hover:text-brand-200">
              Vedi tutti i trend →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-100">{value}</p>
      </CardContent>
    </Card>
  );
}
