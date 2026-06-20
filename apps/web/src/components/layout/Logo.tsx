import { cn } from "@/lib/utils";

// Marchio BeeClip centralizzato qui invece che duplicato in (auth)/layout,
// Sidebar, Topbar e landing page: un solo punto da aggiornare se il logo
// cambia. Accenno "ape" tenuto sobrio — celletta a nido d'ape con monogramma
// "B", non una mascotte cartoonesca.
const SIZE = {
  sm: { icon: "h-7 w-7", text: "text-sm" },
  md: { icon: "h-8 w-8", text: "text-sm" },
  lg: { icon: "h-9 w-9", text: "text-base" },
} as const;

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-8 w-8", className)} aria-hidden="true">
      {/* ali, sobrie e trasparenti */}
      <ellipse cx="11" cy="11" rx="7" ry="5" fill="currentColor" className="text-brand-200/25" transform="rotate(-25 11 11)" />
      <ellipse cx="29" cy="11" rx="7" ry="5" fill="currentColor" className="text-brand-200/25" transform="rotate(25 29 11)" />
      {/* cella a nido d'ape */}
      <path
        d="M20 2.5 33.79 10.25V25.75L20 33.5 6.21 25.75V10.25Z"
        fill="currentColor"
        className="text-brand-500"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1"
      />
      <text
        x="20"
        y="23.5"
        textAnchor="middle"
        fontSize="15"
        fontWeight="800"
        fontFamily="system-ui, sans-serif"
        fill="#0a0a08"
      >
        B
      </text>
    </svg>
  );
}

export function Logo({
  size = "md",
  className,
  textClassName,
}: {
  size?: keyof typeof SIZE;
  className?: string;
  textClassName?: string;
}) {
  const s = SIZE[size];
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark className={s.icon} />
      <span className={cn("font-semibold text-slate-100", s.text, textClassName)}>BeeClip</span>
    </span>
  );
}
