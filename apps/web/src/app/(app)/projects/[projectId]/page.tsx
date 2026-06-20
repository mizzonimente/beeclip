"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ContentTypeKey } from "@clipmanager/shared";
import { api, ApiError } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import { CONTENT_TYPE_OPTIONS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatDuration } from "@/lib/utils";
import type { ProjectDetail } from "@/lib/types";

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const router = useRouter();
  const { data, loading, error, refetch } = useApiQuery(() => api.projects.get(projectId), [projectId]);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm("Eliminare definitivamente questo progetto e tutti i suoi video/clip?")) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.projects.remove(projectId);
      router.push("/projects");
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Eliminazione non riuscita.");
      setIsDeleting(false);
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
    return <Alert variant="error">{error ?? "Progetto non trovato."}</Alert>;
  }

  const { project } = data;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-100">{project.title}</h1>
            <Badge variant="brand">{CONTENT_TYPE_OPTIONS.find((o) => o.value === project.contentType)?.label}</Badge>
          </div>
          {project.description && <p className="mt-2 max-w-2xl text-sm text-slate-400">{project.description}</p>}
          <p className="mt-2 text-xs text-slate-500">Creato il {formatDate(project.createdAt)}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href={`/projects/${projectId}/upload`}>
            <Button>Carica video</Button>
          </Link>
          <Button variant="secondary" onClick={() => setIsEditing((v) => !v)}>
            {isEditing ? "Annulla" : "Modifica"}
          </Button>
          <Button variant="danger" isLoading={isDeleting} onClick={handleDelete}>
            Elimina
          </Button>
        </div>
      </div>

      {deleteError && <Alert variant="error">{deleteError}</Alert>}

      {isEditing && (
        <EditProjectForm
          projectId={projectId}
          project={project}
          onSaved={() => {
            setIsEditing(false);
            refetch();
          }}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Video ({project.videos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {project.videos.length === 0 ? (
            <EmptyState
              title="Nessun video in questo progetto"
              description="Carica il primo video per avviare trascrizione e generazione clip."
              action={
                <Link href={`/projects/${projectId}/upload`}>
                  <Button size="sm">Carica video</Button>
                </Link>
              }
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {project.videos.map((video) => (
                <li key={video.id}>
                  <Link
                    href={`/projects/${projectId}/videos/${video.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-surface-border px-4 py-3 transition-colors hover:border-brand-400/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-100">{video.originalFilename}</p>
                      <p className="text-xs text-slate-500">
                        {formatDuration(video.durationSeconds)} · {formatDate(video.createdAt)}
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

      {project.contentIdeas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Idee di contenuto suggerite</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {project.contentIdeas.map((idea) => (
                <li key={idea.id} className="rounded-lg border border-surface-border px-4 py-3">
                  <p className="text-sm font-medium text-slate-100">{idea.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{idea.description}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EditProjectForm({
  projectId,
  project,
  onSaved,
}: {
  projectId: string;
  project: ProjectDetail;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? "");
  const [industry, setIndustry] = useState(project.industry ?? "");
  const [contentGoal, setContentGoal] = useState(project.contentGoal ?? "");
  const [targetAudience, setTargetAudience] = useState(project.targetAudience ?? "");
  const [contentType, setContentType] = useState<ContentTypeKey>(project.contentType);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.projects.update(projectId, {
        title,
        description: description || undefined,
        industry: industry || undefined,
        contentGoal: contentGoal || undefined,
        targetAudience: targetAudience || undefined,
        contentType,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Salvataggio non riuscito.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modifica progetto</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <Alert variant="error">{error}</Alert>}
          <Input label="Titolo" required value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea label="Descrizione" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Tipo di contenuto"
              options={CONTENT_TYPE_OPTIONS}
              value={contentType}
              onChange={(e) => setContentType(e.target.value as ContentTypeKey)}
            />
            <Input label="Settore" value={industry} onChange={(e) => setIndustry(e.target.value)} />
          </div>
          <Input label="Obiettivo" value={contentGoal} onChange={(e) => setContentGoal(e.target.value)} />
          <Input
            label="Pubblico target"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
          />
          <Button type="submit" isLoading={isSubmitting} className="self-start">
            Salva modifiche
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
