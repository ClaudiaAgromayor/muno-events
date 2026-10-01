import "server-only";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { LIST_COLUMNS, type MunoEvent } from "@/app/lib/events";

// Cliente anónimo sin cookies: los eventos son públicos, y así la página se puede cachear
// (revalidate) en vez de renderizarse en cada visita.
function anon() {
  return createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
}

/**
 * Próximos eventos de la ciudad. Un evento del scraper que lleva >2 días sin verse en su
 * plataforma se considera borrado allí y no se enseña (los añadidos a mano no caducan).
 */
export async function getUpcomingEvents(city = "madrid"): Promise<MunoEvent[]> {
  const now = new Date();
  const stale = new Date(now.getTime() - 2 * 86400000).toISOString();
  const { data, error } = await anon()
    .from("events")
    .select(LIST_COLUMNS)
    .eq("city", city)
    .gte("start_at", new Date(now.getTime() - 3 * 3600000).toISOString())
    .or(`last_seen_at.gte.${stale},source.eq.user`)
    .order("start_at", { ascending: true })
    .limit(1000);
  if (error) {
    // Sin romper la portada (p. ej. si aún no se ha aplicado la migración 002)
    console.error("getUpcomingEvents:", error.message);
    return devFallback();
  }
  return (data ?? []) as unknown as MunoEvent[];
}

export async function getEvent(id: string): Promise<MunoEvent | null> {
  const { data, error } = await anon().from("events").select("*").eq("id", id).maybeSingle();
  if (error) return (await devFallback()).find((e) => e.id === id) ?? null;
  return (data as MunoEvent | null) ?? null;
}

/** Solo en `next dev`: si la tabla aún no existe, usa la copia local del último scrape. */
async function devFallback(): Promise<MunoEvent[]> {
  if (process.env.NODE_ENV !== "development") return [];
  try {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(`${process.cwd()}/../data/latest.json`, "utf-8");
    return (JSON.parse(raw) as MunoEvent[])
      .map((e) => ({ ...e, featured: false, also_on: e.also_on ?? [], topics: e.topics ?? [] }))
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
  } catch {
    return [];
  }
}

export async function getEventsByIds(ids: string[]): Promise<MunoEvent[]> {
  if (ids.length === 0) return [];
  const { data } = await anon().from("events").select(LIST_COLUMNS).in("id", ids);
  return (data ?? []) as unknown as MunoEvent[];
}

export async function getLastRun() {
  const { data } = await anon()
    .from("scrape_runs")
    .select("finished_at, ok, stats")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { finished_at: string; ok: boolean; stats: Record<string, { kept: number }> } | null;
}
