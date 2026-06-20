"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
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

export default function ProjectsPage() {
  const { data, loading, error, refetch } = useApiQuery(() => api.projects.list(), []);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Progetti</h1>
          <p className="mt-1 text-sm text-slate-400">Organizza i video per cliente, canale o campagna.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Annulla" : "Nuovo progetto"}</Button>
      </div>

      {showForm && (
        <CreateProjectForm
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
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : !data || data.projects.length === 0 ? (
        <EmptyState
          title="Nessun progetto"
          description="Crea il tuo primo progetto per iniziare a caricare video."
          action={<Button onClick={() => setShowForm(true)}>Nuovo progetto</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="h-full transition-colors hover:border-brand-400/50">
                <CardHeader>
                  <CardTitle>{project.title}</CardTitle>
                  {project.description && (
                    <p className="line-clamp-2 text-sm text-slate-400">{project.description}</p>
                  )}
                </CardHeader>
                <CardContent className="flex items-center justify-between text-xs text-slate-500">
                  <span>{CONTENT_TYPE_OPTIONS.find((o) => o.value === project.contentType)?.label}</span>
                  <span>
                    {project._count?.videos ?? 0} video · {project._count?.clips ?? 0} clip
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateProjectForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [contentGoal, setContentGoal] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [contentType, setContentType] = useState<ContentTypeKey>("CREATOR");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.projects.create({
        title,
        description: description || undefined,
        industry: industry || undefined,
        contentGoal: contentGoal || undefined,
        targetAudience: targetAudience || undefined,
        contentType,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Creazione non riuscita, riprova.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuovo progetto</CardTitle>
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
            Crea progetto
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
