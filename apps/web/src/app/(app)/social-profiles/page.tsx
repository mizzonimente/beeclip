"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import { SOCIAL_PLATFORM_OPTIONS, PLATFORM_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";
import type {
  SocialProfile,
  SocialProfileTypeKey,
  SocialPlatformKey,
  ProfileConnectionTypeKey,
} from "@/lib/types";

const TYPE_OPTIONS: { value: SocialProfileTypeKey; label: string }[] = [
  { value: "OWN", label: "Il mio profilo" },
  { value: "REFERENCE", label: "Profilo di riferimento (concorrente/ispirazione)" },
];

const CONNECTION_OPTIONS: { value: ProfileConnectionTypeKey; label: string }[] = [
  { value: "MANUAL", label: "Manuale" },
  { value: "OAUTH", label: "OAuth" },
  { value: "LICENSED_PROVIDER", label: "Provider con licenza" },
];

export default function SocialProfilesPage() {
  const { data, loading, error, refetch } = useApiQuery(() => api.social.list(), []);
  const [showForm, setShowForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Tiene traccia dei profili per cui è stata appena richiesta un'analisi,
  // insieme al loro `lastAnalyzedAt` al momento della richiesta: non c'è un
  // endpoint di stato job dedicato, quindi eseguiamo polling leggero finché
  // quel valore non cambia (stesso pattern della pagina video).
  const [refreshing, setRefreshing] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (Object.keys(refreshing).length === 0) return;
    const interval = setInterval(() => refetch(), 5000);
    return () => clearInterval(interval);
  }, [refreshing, refetch]);

  useEffect(() => {
    if (!data) return;
    setRefreshing((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const next = { ...prev };
      let changed = false;
      for (const profile of data.profiles) {
        if (profile.id in next && next[profile.id] !== profile.lastAnalyzedAt) {
          delete next[profile.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [data]);

  async function handleRefresh(profile: SocialProfile) {
    setActionError(null);
    try {
      await api.social.refresh(profile.id);
      setRefreshing((prev) => ({ ...prev, [profile.id]: profile.lastAnalyzedAt }));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Impossibile avviare l'analisi.");
    }
  }

  async function handleRemove(profile: SocialProfile) {
    if (!window.confirm(`Rimuovere il profilo @${profile.handle}?`)) return;
    setActionError(null);
    try {
      await api.social.remove(profile.id);
      refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Rimozione non riuscita.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Profili social</h1>
          <p className="mt-1 text-sm text-slate-400">
            Analizza il tuo profilo e quelli di riferimento per generare clip coerenti con tono di voce, formati e
            hashtag che funzionano già nel tuo settore.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Annulla" : "Nuovo profilo"}</Button>
      </div>

      {actionError && <Alert variant="error">{actionError}</Alert>}

      {showForm && (
        <CreateProfileForm
          onCreated={() => {
            setShowForm(false);
            refetch();
          }}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error || !data ? (
        <Alert variant="error">{error ?? "Impossibile caricare i profili."}</Alert>
      ) : data.profiles.length === 0 ? (
        <EmptyState
          title="Nessun profilo collegato"
          description="Aggiungi il tuo profilo e qualche profilo di riferimento per generare contenuti coerenti con il tuo brand."
          action={<Button onClick={() => setShowForm(true)}>Nuovo profilo</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isRefreshing={profile.id in refreshing}
              onRefresh={() => handleRefresh(profile)}
              onRemove={() => handleRemove(profile)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileCard({
  profile,
  isRefreshing,
  onRefresh,
  onRemove,
}: {
  profile: SocialProfile;
  isRefreshing: boolean;
  onRefresh: () => void;
  onRemove: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>@{profile.handle}</CardTitle>
            <CardDescription>
              {PLATFORM_LABELS[profile.platform]} · {profile.type === "OWN" ? "Il mio profilo" : "Riferimento"}
            </CardDescription>
          </div>
          <Badge variant={profile.type === "OWN" ? "brand" : "neutral"}>
            {profile.type === "OWN" ? "Mio" : "Riferimento"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-slate-500">
          {profile.lastAnalyzedAt ? `Ultima analisi: ${formatDateTime(profile.lastAnalyzedAt)}` : "Non ancora analizzato"}
          {isRefreshing && " · analisi in corso…"}
        </p>

        {profile.toneOfVoice && (
          <p className="text-sm text-slate-300">
            <span className="text-slate-500">Tono di voce: </span>
            {profile.toneOfVoice}
          </p>
        )}

        {profile.visualStyle && (
          <p className="text-sm text-slate-300">
            <span className="text-slate-500">Stile visivo: </span>
            {profile.visualStyle}
          </p>
        )}

        {profile.postingFrequency && (
          <p className="text-sm text-slate-300">
            <span className="text-slate-500">Frequenza di pubblicazione: </span>
            {profile.postingFrequency}
          </p>
        )}

        {profile.avgEngagementRate != null && (
          <p className="text-sm text-slate-300">
            <span className="text-slate-500">Engagement medio: </span>
            {profile.avgEngagementRate.toFixed(1)}%
          </p>
        )}

        {profile.recurringFormats && profile.recurringFormats.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Formati ricorrenti</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {profile.recurringFormats.map((format) => (
                <Badge key={format} variant="neutral">
                  {format}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {profile.hashtagsUsed.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Hashtag usati</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {profile.hashtagsUsed.map((tag) => (
                <Badge key={tag} variant="brand">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {profile.bestPerformingContent && profile.bestPerformingContent.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Contenuti che hanno funzionato</p>
            <ul className="mt-1 flex flex-col gap-1.5">
              {profile.bestPerformingContent.map((entry, i) => (
                <li key={i} className="text-sm text-slate-300">
                  <span className="font-medium text-slate-100">{entry.title}</span> — {entry.reasonItWorked}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-1 flex gap-2">
          <Button size="sm" variant="secondary" isLoading={isRefreshing} onClick={onRefresh}>
            {profile.lastAnalyzedAt ? "Aggiorna analisi" : "Avvia analisi"}
          </Button>
          <Button size="sm" variant="danger" onClick={onRemove}>
            Rimuovi
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateProfileForm({ onCreated }: { onCreated: () => void }) {
  const [type, setType] = useState<SocialProfileTypeKey>("OWN");
  const [platform, setPlatform] = useState<SocialPlatformKey>("TIKTOK");
  const [handle, setHandle] = useState("");
  const [connectedVia, setConnectedVia] = useState<ProfileConnectionTypeKey>("MANUAL");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.social.create({ type, platform, handle, connectedVia });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Creazione non riuscita.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuovo profilo</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <Alert variant="error">{error}</Alert>}
          <Alert variant="info">
            L&apos;integrazione OAuth diretta con le piattaforme social non è ancora attiva in questa versione: i
            profili senza un provider con licenza configurato vengono analizzati con un modello euristico
            deterministico, utile per vedere subito il flusso completo ma non ancora basato su dati live della
            piattaforma.
          </Alert>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Tipo di profilo"
              options={TYPE_OPTIONS}
              value={type}
              onChange={(e) => setType(e.target.value as SocialProfileTypeKey)}
            />
            <Select
              label="Piattaforma"
              options={SOCIAL_PLATFORM_OPTIONS}
              value={platform}
              onChange={(e) => setPlatform(e.target.value as SocialPlatformKey)}
            />
          </div>
          <Input
            label="Handle / username"
            required
            placeholder="es. nome.profilo"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
          <Select
            label="Modalità di collegamento"
            options={CONNECTION_OPTIONS}
            value={connectedVia}
            onChange={(e) => setConnectedVia(e.target.value as ProfileConnectionTypeKey)}
          />
          <Button type="submit" isLoading={isSubmitting} className="self-start">
            Aggiungi profilo
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
