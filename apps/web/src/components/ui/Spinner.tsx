import { cn } from "@/lib/utils";

const SIZE_CLASSES = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-10 w-10" } as const;

export function Spinner({
  size = "md",
  className,
}: {
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  return (
    <svg
      className={cn("animate-spin text-current", SIZE_CLASSES[size], className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-4a6 6 0 0 0-6-6V2z" />
    </svg>
  );
}
