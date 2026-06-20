"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (password !== confirmPassword) {
      setError("Le password non coincidono.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register({ name, email, password });
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError("Registrazione non riuscita, riprova.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crea il tuo account</CardTitle>
        <CardDescription>Inizia a generare clip virali dai tuoi video in pochi minuti.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <Alert variant="error">{error}</Alert>}
          <Input
            label="Nome"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name?.[0]}
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email?.[0]}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            helperText="Almeno 8 caratteri."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password?.[0]}
          />
          <Input
            label="Conferma password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full">
            Crea account
          </Button>
        </form>
      </CardContent>
      <div className="px-5 pb-5 text-center text-sm text-slate-400">
        Hai già un account?{" "}
        <Link href="/login" className="font-medium text-brand-300 hover:text-brand-200">
          Accedi
        </Link>
      </div>
    </Card>
  );
}
