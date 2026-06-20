"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import { PLATFORM_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import type { BadgeVariant } from "@/components/ui/Badge";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { TrendSnapshot } from "@/lib/types";

// `source` arriva già dal backend (apps/worker/src/processors/trendRefresh.ts):
// "MOCK" quando nessun provider con licenza è configurato, "LICENSED_PROVIDER"
// quando i dati vengono da un servizio esterno autorizzato, "CURATED" per
// snapshot inserite manualmente. Le etichettiamo sempre in modo esplicito per
// non far passare dati di anteprima come se fossero dati di piattaforma reali.
const SOURCE_LABELS: Record<TrendSnapshot["source"], string> = {
  MOCK: "Anteprima (dati mock)",
  LICENSED_PROVIDER: "Provider con licenza",
  CURATED: "Curato manualmente",
};

const SOURCE_VARIANTS: Record<TrendSnapshot["source"], BadgeVariant> = {
  MOCK: "warning",
  LICENSED_PROVIDER: "success",
  CURATED: "brand",
};

export default function TrendsPage() {
  const { data, loading, error, refetch } = useApiQuery(() => api.trends.list(), []);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  // Nessun endpoint di stato job dedicato: dopo aver accodato l'aggiornamento
  // facciamo polling finché non compare uno snapshot creato dopo il trigger.
  const [triggeredAt, setTriggeredAt] = useState<number | null>(null);

  useEffect(() => {
    if (triggeredAt === null) return;
    const interval = setInterval(() => refetch(), 5000);
    return () => clearInterval(interval);
  }, [triggeredAt, refetch]);

  useEffect(() => {
    if (triggeredAt === null || !data) return;
    const hasFreshSnapshot = data.snapshots.some((s) => new Date(s.createdAt).getTime() >= triggeredAt);
    if (hasFreshSnapshot) {
      setTriggeredAt(null);
      setIsRefreshing(false);
    }
  }, [data, triggeredAt]);

  async function handleRefresh() {
    setRefreshError(null);
    setIsRefreshing(true);
    try {
      await api.trends.refresh();
      setTriggeredAt(Date.now());
    } catch (err) {
      setRefreshError(err instanceof ApiError ? err.message : "Impossibile avviare l'aggiornamento.");
      setIsRefreshing(false);
    }
  }

  const sortedSnapshots = data
    ? [...data.snapshots].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Trend giornalieri</h1>
          <p className="mt-1 text-sm text-slate-400">
            Suoni, hashtag, formati virali e nicchie in crescita per piattaforma, con idee di contenuto pronte da
            collegare ai tuoi progetti.
          </p>
        </div>
        <Button variant="secondary" isLoading={isRefreshing} onClick={handleRefresh}>
          Aggiorna trend
        </Button>
      </div>

      {refreshError && <Alert variant="error">{refreshError}</Alert>}
      {isRefreshing && <Alert variant="info">Aggiornamento in corso, può richiedere qualche secondo…</Alert>}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error || !data ? (
        <Alert variant="error">{error ?? "Impossibile caricare i trend."}</Alert>
      ) : sortedSnapshots.length === 0 ? (
        <EmptyState
          title="Nessun trend disponibile"
          description="Avvia il primo aggiornamento per generare la fotografia giornaliera delle tendenze."
          action={<Button onClick={handleRefresh}>Aggiorna trend</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {sortedSnapshots.map((snapshot) => (
            <TrendCard key={snapshot.id} snapshot={snapshot} />
          ))}
        </div>
      )}
    </div>
  );
}

function TrendCard({ snapshot }: { snapshot: TrendSnapshot }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{PLATFORM_LABELS[snapshot.platform]}</CardTitle>
            <CardDescription>{formatDate(snapshot.date)}</CardDescription>
          </div>
          <Badge variant={SOURCE_VARIANTS[snapshot.source]}>{SOURCE_LABELS[snapshot.source]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {snapshot.trendingSounds.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Suoni in tendenza</p>
            <ul className="mt-1 flex flex-col gap-1">
              {snapshot.trendingSounds.map((sound) => (
                <li key={sound.name} className="flex items-center justify-between text-sm text-slate-300">
                  <span>{sound.name}</span>
                  <span className="text-xs text-emerald-400">+{sound.usageGrowthPct}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {snapshot.emergingHashtags.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Hashtag emergenti</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {snapshot.emergingHashtags.map((tag) => (
                <Badge key={tag} variant="brand">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {snapshot.viralFormats.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Formati virali</p>
            <ul className="mt-1 flex flex-col gap-1.5">
              {snapshot.viralFormats.map((format) => (
                <li key={format.name} className="text-sm text-slate-300">
                  <span className="font-medium text-slate-100">{format.name}</span> — {format.description}
                </li>
              ))}
            </ul>
          </div>
        )}

        {snapshot.growingNiches.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Nicchie in crescita</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {snapshot.growingNiches.map((niche) => (
                <Badge key={niche} variant="neutral">
                  {niche}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {snapshot.contentIdeas.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Idee di contenuto</p>
            <ul className="mt-1 flex flex-col gap-1.5">
              {snapshot.contentIdeas.map((idea) => (
                <li key={idea.id} className="text-sm text-slate-300">
                  <span className="font-medium text-slate-100">{idea.title}</span> — {idea.description}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-slate-500">Generato il {formatDateTime(snapshot.createdAt)}</p>
      </CardContent>
    </Card>
  );
}
