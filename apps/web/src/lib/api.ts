// Client API tipizzato per apps/api. Centralizza: base URL, header
// Authorization, parsing errori Fastify/Zod, e il refresh automatico del
// token di accesso scaduto (vedi apps/api/src/plugins/auth.ts — access
// token con vita di 15 minuti, refresh token 30 giorni).
import type {
  RegisterInput,
  LoginInput,
  CreateProjectInput,
  ClipGenerationConfig,
  CreateSocialProfileInput,
  ExportClipInput,
  ContentTypeKey,
  CreateVideoFromDriveLinkInput,
} from "@clipmanager/shared";
import type {
  AuthUser,
  Project,
  ProjectDetail,
  Video,
  VideoDetail,
  Clip,
  ExportHistoryEntry,
  SocialProfile,
  TrendSnapshot,
  DashboardData,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const ACCESS_TOKEN_KEY = "cmai_access_token";
const REFRESH_TOKEN_KEY = "cmai_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: { accessToken: string; refreshToken?: string }): void {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  if (tokens.refreshToken) window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string[] | undefined>;
  constructor(message: string, status: number, fieldErrors?: Record<string, string[] | undefined>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Le route Fastify restituiscono `{ error: string }` per errori semplici, o
 * `{ error: Record<string, string[]> }` quando `error` è
 * `zodError.flatten().fieldErrors` (es. apps/api/src/routes/auth.ts).
 * Normalizziamo entrambi i casi in un messaggio leggibile + i fieldErrors
 * grezzi, così i form possono evidenziare il campo specifico.
 */
function extractError(body: unknown, fallback: string): { message: string; fieldErrors?: Record<string, string[] | undefined> } {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error: unknown }).error;
    if (typeof err === "string") return { message: err };
    if (err && typeof err === "object") {
      const fieldErrors = err as Record<string, string[] | undefined>;
      const firstField = Object.values(fieldErrors).find((v) => v && v.length > 0);
      return { message: firstField?.[0] ?? fallback, fieldErrors };
    }
  }
  return { message: fallback };
}

let refreshPromise: Promise<string | null> | null = null;

/** Un solo refresh in volo alla volta: se più richieste vanno in 401 in
 *  parallelo, condividono la stessa Promise invece di bombardare
 *  /auth/refresh (e invalidare a vicenda lo stesso refresh token). */
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return null;
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          clearTokens();
          return null;
        }
        const data = (await res.json()) as { accessToken: string };
        setTokens({ accessToken: data.accessToken });
        return data.accessToken;
      } catch {
        return null;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | undefined>;
  /** Per /auth/login, /auth/register: nessun token da allegare ancora. */
  skipAuth?: boolean;
  /** Uso interno: evita un loop infinito di refresh dopo un retry. */
  _isRetry?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, skipAuth, _isRetry } = opts;

  const url = new URL(`${API_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const accessToken = getAccessToken();
  if (!skipAuth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401 && !skipAuth && !_isRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) return request<T>(path, { ...opts, _isRetry: true });
    clearTokens();
    throw new ApiError("Sessione scaduta, accedi di nuovo", 401);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const json: unknown = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const { message, fieldErrors } = extractError(json, `Richiesta fallita (${res.status})`);
    throw new ApiError(message, res.status, fieldErrors);
  }

  return json as T;
}

/**
 * Upload con progress reale: `fetch` non espone un evento di progresso in
 * upload supportato in modo uniforme, quindi per questa unica richiesta
 * usiamo `XMLHttpRequest` invece del wrapper `request()` sopra. Non passa
 * dal retry-on-401 automatico (un upload di un video grande è comunque
 * un'operazione "una tantum" avviata a sessione attiva da pochi minuti).
 */
function uploadVideo(params: {
  projectId: string;
  file: File;
  contentType?: ContentTypeKey;
  generationConfig?: ClipGenerationConfig;
  onProgress?: (pct: number) => void;
}): Promise<{ video: Video }> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_URL}/videos`);
    url.searchParams.set("projectId", params.projectId);
    if (params.contentType) url.searchParams.set("contentType", params.contentType);
    if (params.generationConfig) url.searchParams.set("generationConfig", JSON.stringify(params.generationConfig));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url.toString());
    const token = getAccessToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    const formData = new FormData();
    formData.append("file", params.file);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && params.onProgress) {
        params.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as { video: Video });
        return;
      }
      let message = `Upload fallito (${xhr.status})`;
      try {
        const body = JSON.parse(xhr.responseText);
        message = extractError(body, message).message;
      } catch {
        // risposta non-JSON (es. timeout proxy): mantiene il messaggio generico
      }
      reject(new ApiError(message, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("Errore di rete durante l'upload", 0));
    xhr.send(formData);
  });
}

export const api = {
  auth: {
    register: (data: RegisterInput) =>
      request<{ user: AuthUser; accessToken: string; refreshToken: string }>("/auth/register", {
        method: "POST",
        body: data,
        skipAuth: true,
      }),
    login: (data: LoginInput) =>
      request<{ user: AuthUser; accessToken: string; refreshToken: string }>("/auth/login", {
        method: "POST",
        body: data,
        skipAuth: true,
      }),
    me: () => request<{ user: AuthUser }>("/auth/me"),
  },
  projects: {
    list: () => request<{ projects: Project[] }>("/projects"),
    create: (data: CreateProjectInput) => request<{ project: Project }>("/projects", { method: "POST", body: data }),
    get: (id: string) => request<{ project: ProjectDetail }>(`/projects/${id}`),
    update: (id: string, data: Partial<CreateProjectInput>) =>
      request<{ project: Project }>(`/projects/${id}`, { method: "PATCH", body: data }),
    remove: (id: string) => request<void>(`/projects/${id}`, { method: "DELETE" }),
  },
  videos: {
    upload: uploadVideo,
    createFromDriveLink: (data: CreateVideoFromDriveLinkInput) =>
      request<{ video: Video }>("/videos/from-drive-link", { method: "POST", body: data }),
    get: (id: string) => request<{ video: VideoDetail }>(`/videos/${id}`),
    listByProject: (projectId: string) => request<{ videos: Video[] }>(`/projects/${projectId}/videos`),
  },
  clips: {
    listByProject: (projectId: string) => request<{ clips: Clip[] }>(`/projects/${projectId}/clips`),
    getDownloadUrl: (clipId: string) => request<{ url: string; expiresInSeconds: number }>(`/clips/${clipId}/download-url`),
    exportCandidate: (candidateId: string, data: ExportClipInput) =>
      request<{ clip: Clip }>(`/clip-candidates/${candidateId}/export`, { method: "POST", body: data }),
    exportHistory: (projectId: string) => request<{ history: ExportHistoryEntry[] }>(`/projects/${projectId}/export-history`),
  },
  social: {
    list: () => request<{ profiles: SocialProfile[] }>("/social-profiles"),
    create: (data: CreateSocialProfileInput) => request<{ profile: SocialProfile }>("/social-profiles", { method: "POST", body: data }),
    refresh: (id: string) => request<{ queued: boolean; jobId: string }>(`/social-profiles/${id}/refresh`, { method: "POST" }),
    remove: (id: string) => request<void>(`/social-profiles/${id}`, { method: "DELETE" }),
  },
  trends: {
    list: () => request<{ snapshots: TrendSnapshot[] }>("/trends"),
    refresh: () => request<{ queued: boolean; jobId: string }>("/trends/refresh", { method: "POST" }),
  },
  dashboard: {
    get: () => request<DashboardData>("/dashboard"),
  },
};
