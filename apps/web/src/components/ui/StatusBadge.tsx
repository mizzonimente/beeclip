// Mappa gli stati di Video e Clip (vedi packages/db/prisma/schema.prisma,
// enum VideoStatus/ClipStatus) su etichette in italiano e colori coerenti.
// Centralizzato qui per evitare che ogni pagina reinventi la propria mappa
// stato -> colore con il rischio di andare fuori sincrono con il backend.
import { Badge } from "./Badge";
import type { BadgeVariant } from "./Badge";
import type { ClipStatusKey, VideoStatusKey } from "@/lib/types";

type Status = VideoStatusKey | ClipStatusKey;

const STATUS_META: Record<Status, { label: string; variant: BadgeVariant; pulsing?: boolean }> = {
  UPLOADED: { label: "Caricato", variant: "neutral" },
  EXTRACTING_AUDIO: { label: "Estrazione audio", variant: "brand", pulsing: true },
  TRANSCRIBING: { label: "Trascrizione", variant: "brand", pulsing: true },
  ANALYZING: { label: "Analisi", variant: "brand", pulsing: true },
  RENDERING_CLIPS: { label: "Generazione clip", variant: "brand", pulsing: true },
  QUEUED: { label: "In coda", variant: "neutral" },
  RENDERING: { label: "Rendering", variant: "brand", pulsing: true },
  READY: { label: "Pronto", variant: "success" },
  FAILED: { label: "Errore", variant: "danger" },
};

export function StatusBadge({ status }: { status: Status }) {
  const meta = STATUS_META[status];
  return (
    <Badge variant={meta.variant}>
      {meta.pulsing && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {meta.label}
    </Badge>
  );
}
