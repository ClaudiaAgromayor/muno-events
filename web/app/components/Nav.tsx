"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarHeart, Compass, Plus, Users } from "lucide-react";
import { Avatar } from "@/app/components/ui";
import { displayName, useSession } from "@/app/components/Session";

const TABS = [
  { href: "/", label: "Descubrir", icon: Compass },
  { href: "/comunidades", label: "Comunidades", icon: Users },
  { href: "/nuevo", label: "Añadir", icon: Plus, primary: true },
  { href: "/planes", label: "Mis planes", icon: CalendarHeart },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export function TopBar() {
  const path = usePathname();
  const { user, profile, loaded } = useSession();
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="font-display text-2xl font-extrabold tracking-tight">
          muno<span className="text-brand">.</span>
        </Link>
        <span className="hidden rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted sm:inline">
          📍 Madrid
        </span>
        <nav className="ml-auto hidden items-center gap-1 sm:flex">
          {TABS.filter((t) => !t.primary).map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                isActive(path, t.href) ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          ))}
          <Link
            href="/nuevo"
            className="ml-2 inline-flex items-center gap-1 rounded-full bg-foreground px-3.5 py-1.5 text-sm font-semibold text-background transition hover:opacity-90"
          >
            <Plus className="size-4" /> Añadir evento
          </Link>
        </nav>
        <div className="ml-auto sm:ml-2">
          {loaded &&
            (user ? (
              <Link href="/perfil" aria-label="Tu perfil">
                <Avatar name={displayName(user, profile)} url={profile?.avatar_url} size={32} />
              </Link>
            ) : (
              <Link
                href={`/entrar?next=${encodeURIComponent(path)}`}
                className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Entrar
              </Link>
            ))}
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
      <div className="grid grid-cols-4">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = isActive(path, t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                active ? "text-brand" : "text-muted"
              }`}
            >
              {t.primary ? (
                <span className="flex size-7 items-center justify-center rounded-full bg-foreground text-background">
                  <Icon className="size-4" />
                </span>
              ) : (
                <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} />
              )}
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
