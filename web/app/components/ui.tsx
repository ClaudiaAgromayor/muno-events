// Piezas visuales pequeñas reutilizadas en toda la app.
import Image from "next/image";
import { STATUS_INFO, type EventStatus } from "@/app/lib/events";

export function StatusBadge({ status, size = "sm" }: { status: EventStatus; size?: "sm" | "lg" }) {
  const info = STATUS_INFO[status];
  if (!info) return null;
  const tone = {
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    bad: "bg-bad-soft text-bad",
    muted: "bg-surface-2 text-muted",
  }[info.tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${tone} ${
        size === "lg" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-[11px]"
      }`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {info.label}
    </span>
  );
}

export function Avatar({
  name,
  url,
  size = 28,
  className = "",
}: {
  name: string | null;
  url?: string | null;
  size?: number;
  className?: string;
}) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const hue = [...(name || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return url ? (
    <Image
      src={url}
      alt={name ?? ""}
      width={size}
      height={size}
      unoptimized
      className={`shrink-0 rounded-full object-cover ring-2 ring-surface ${className}`}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-surface ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42, background: `oklch(0.62 0.15 ${hue})` }}
      title={name ?? undefined}
    >
      {initial}
    </span>
  );
}

export function AvatarStack({
  people,
  extra = 0,
  size = 24,
}: {
  people: { name: string | null; url?: string | null }[];
  extra?: number;
  size?: number;
}) {
  if (people.length === 0 && extra <= 0) return null;
  return (
    <span className="flex items-center">
      {people.slice(0, 4).map((p, i) => (
        <Avatar key={i} name={p.name} url={p.url} size={size} className={i ? "-ml-2" : ""} />
      ))}
      {extra > 0 && (
        <span
          className="-ml-2 inline-flex items-center justify-center rounded-full bg-surface-2 px-1.5 text-[10px] font-semibold text-muted ring-2 ring-surface"
          style={{ height: size, minWidth: size }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

/** Portada de evento con degradado de respaldo si no hay imagen. */
export function Cover({ src, title, className = "" }: { src: string | null; title: string; className?: string }) {
  const hue = [...title].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className={`relative overflow-hidden bg-surface-2 ${className}`}
      style={
        src
          ? undefined
          : { background: `linear-gradient(135deg, oklch(0.7 0.16 ${hue}), oklch(0.55 0.2 ${(hue + 60) % 360}))` }
      }
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- imágenes de muchos CDNs externos
        <img src={src} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center p-3 text-center text-sm font-bold text-white/90">
          {title.slice(0, 40)}
        </span>
      )}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-line bg-surface text-foreground hover:border-foreground/40"
      }`}
    >
      {children}
    </button>
  );
}
