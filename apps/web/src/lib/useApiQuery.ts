"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "./api";

interface QueryState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Fetch client-side minimale per dati legati al token in localStorage (vedi
 * lib/api.ts) e quindi non risolvibili in un Server Component. `deps` si
 * comporta come in useEffect: la query viene rieseguita quando cambiano.
 * `refetch()` forza un nuovo giro (utile dopo una mutazione, es. creazione
 * progetto, o per il polling dello stato di video/clip).
 */
export function useApiQuery<T>(
  fn: () => Promise<T>,
  deps: ReadonlyArray<unknown> = [],
): QueryState<T> & { refetch: () => void } {
  const [state, setState] = useState<QueryState<T>>({ data: null, error: null, loading: true });
  const [version, setVersion] = useState(0);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : "Si è verificato un errore imprevisto.";
        setState({ data: null, error: message, loading: false });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  return { ...state, refetch };
}
