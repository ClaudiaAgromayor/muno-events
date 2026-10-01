"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { useSession } from "@/app/components/Session";
import { Cover, StatusBadge } from "@/app/components/ui";
import { LIST_COLUMNS, eventPath, isPast, shortDate, type MunoEvent } from "@/app/lib/events";

type Plan = {
  event_id: string;
  status: "going" | "interested";
  event_name: string | null;
  event_start_at: string | null;
  event: MunoEvent | null;
};

export default function PlanesPage() {
  const { supabase, user, loaded } = useSession();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[] | null>(null);

  useEffect(() => {
    if (loaded && !user) router.replace("/entrar?next=/planes");
  }, [loaded, user, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: rows } = await supabase
        .from("rsvps")
        .select("event_id, status, event_name, event_start_at")
        .eq("user_id", user.id);
      const ids = (rows ?? []).map((r) => r.event_id);
      const { data: evs } = ids.length
        ? await supabase.from("events").select(LIST_COLUMNS).in("id", ids)
        : { data: [] };
      const byId = new Map(((evs ?? []) as unknown as MunoEvent[]).map((e) => [e.id, e]));
      setPlans(((rows ?? []) as Omit<Plan, "event">[]).map((r) => ({ ...r, event: byId.get(r.event_id) ?? null })));
    })();
  }, [supabase, user]);

  if (!user) return null;

  const start = (p: Plan) => p.event?.start_at ?? p.event_start_at ?? "";
  const upcoming = (plans ?? [])
    .filter((p) => !isPast({ start_at: start(p), end_at: p.event?.end_at ?? null }))
    .sort((a, b) => start(a).localeCompare(start(b)));
  const past = (plans ?? [])
    .filter((p) => p.status === "going" && isPast({ start_at: start(p), end_at: p.event?.end_at ?? null }))
    .sort((a, b) => start(b).localeCompare(start(a)));

  const Row = ({ p, pastRow }: { p: Plan; pastRow?: boolean }) => {
    const d = start(p) ? shortDate(start(p)) : null;
    return (
      <Link
        href={eventPath(p.event_id)}
        className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition hover:border-foreground/25"
      >
        <Cover src={p.event?.image_url ?? null} title={p.event?.title ?? p.event_name ?? ""} className="size-16 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          {d && (
            <p className="text-xs font-semibold text-brand uppercase">
              {d.weekday} {d.day} {d.month} · {d.time}
            </p>
          )}
          <p className="truncate font-semibold">{p.event?.title ?? p.event_name}</p>
          <div className="mt-1 flex items-center gap-2">
            {pastRow ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-brand">
                <Camera className="size-3.5" /> Sube tus fotos
              </span>
            ) : (
              <>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    p.status === "going" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"
                  }`}
                >
                  {p.status === "going" ? "✓ Voy" : "★ Me interesa"}
                </span>
                {p.event && p.event.status !== "open" && <StatusBadge status={p.event.status} />}
              </>
            )}
          </div>
        </div>
      </Link>
    );
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8">
      <h1 className="font-display text-3xl font-extrabold">Mis planes</h1>

      <section className="mt-6">
        <h2 className="mb-3 font-display text-lg font-bold">Próximos</h2>
        {plans === null ? (
          <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />
        ) : upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-8 text-center">
            <p className="text-3xl">🗓️</p>
            <p className="mt-2 font-semibold">Aún no tienes planes</p>
            <Link href="/" className="mt-2 inline-block text-sm font-medium text-brand">
              Descubrir eventos →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((p) => (
              <Row key={p.event_id} p={p} />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-1 font-display text-lg font-bold">Eventos a los que fuiste · {past.length}</h2>
          <p className="mb-3 text-sm text-muted">Sube fotos y mira quién más estuvo.</p>
          <div className="space-y-2">
            {past.map((p) => (
              <Row key={p.event_id} p={p} pastRow />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
