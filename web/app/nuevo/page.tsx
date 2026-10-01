"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Sparkles } from "lucide-react";
import { useSession } from "@/app/components/Session";
import { useToast } from "@/app/components/Toast";
import { Chip, Cover } from "@/app/components/ui";
import { KINDS, eventPath, type EventKind } from "@/app/lib/events";
import type { ImportedEvent } from "@/app/lib/importer";

/** "2026-10-08T19:00" (hora de Madrid) -> ISO con su offset real (+01:00 / +02:00). */
function madridToIso(local: string) {
  const guess = new Date(`${local}:00Z`);
  const tzName = new Intl.DateTimeFormat("en", { timeZone: "Europe/Madrid", timeZoneName: "longOffset" })
    .formatToParts(guess)
    .find((p) => p.type === "timeZoneName")?.value; // "GMT+02:00"
  return `${local}:00${tzName?.replace("GMT", "") || "+01:00"}`;
}

/** ISO -> "YYYY-MM-DDTHH:mm" en hora de Madrid, para <input type="datetime-local"> */
function isoToMadrid(iso: string | null) {
  if (!iso) return "";
  const p = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
  return p.replace(" ", "T");
}

type Form = {
  id: string;
  url: string;
  title: string;
  description: string;
  image_url: string;
  organizer: string;
  start: string;
  end: string;
  is_online: boolean;
  venue_name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  is_free: boolean;
  price_min: string;
  kind: EventKind;
  extra: Partial<ImportedEvent>;
};

const EMPTY: Form = {
  id: "",
  url: "",
  title: "",
  description: "",
  image_url: "",
  organizer: "",
  start: "",
  end: "",
  is_online: false,
  venue_name: "",
  address: "",
  lat: null,
  lng: null,
  is_free: true,
  price_min: "",
  kind: "meetup",
  extra: {},
};

export default function NuevoPage() {
  const { supabase, user, loaded } = useSession();
  const toast = useToast();
  const router = useRouter();
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loaded && !user) router.replace("/entrar?next=/nuevo");
  }, [loaded, user, router]);

  const read = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!link.trim()) return;
    setLoading(true);
    const r = await fetch("/api/import", { method: "POST", body: JSON.stringify({ url: link }) });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) {
      toast.error(`${data.error}. Puedes rellenarlo a mano.`);
      setForm({ ...EMPTY, url: link.trim() });
      return;
    }
    if (data.existing) {
      toast.success("¡Ese evento ya está en muno!");
      return router.push(eventPath(data.existing));
    }
    const ev = data.event as ImportedEvent;
    setForm({
      id: ev.id,
      url: ev.url,
      title: ev.title,
      description: ev.description ?? "",
      image_url: ev.image_url ?? "",
      organizer: ev.organizer ?? "",
      start: isoToMadrid(ev.start_at),
      end: isoToMadrid(ev.end_at),
      is_online: ev.is_online,
      venue_name: ev.venue_name ?? "",
      address: ev.address ?? "",
      lat: ev.lat,
      lng: ev.lng,
      is_free: ev.is_free ?? true,
      price_min: ev.price_min ? String(ev.price_min) : "",
      kind: ev.kind,
      extra: { status: ev.status, going_count: ev.going_count, capacity: ev.capacity },
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !user) return;
    if (!form.title.trim() || !form.start) return toast.error("Falta el nombre o la fecha");
    setSaving(true);
    const id = form.id || `user:${crypto.randomUUID()}`;
    const [source, ...rest] = id.split(":");
    const { error } = await supabase.from("events").insert({
      id,
      source: "user",
      source_id: rest.join(":") || id,
      url: form.url || null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url || null,
      organizer: form.organizer.trim() || null,
      kind: form.kind,
      start_at: madridToIso(form.start),
      end_at: form.end ? madridToIso(form.end) : null,
      is_online: form.is_online,
      venue_name: form.venue_name.trim() || null,
      address: form.address.trim() || null,
      lat: form.lat,
      lng: form.lng,
      is_free: form.is_free,
      price_min: form.is_free ? null : Number(form.price_min) || null,
      status: form.extra.status ?? "unknown",
      going_count: form.extra.going_count ?? null,
      capacity: form.extra.capacity ?? null,
      submitted_by: user.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(source === "user" ? "¡Evento publicado! 🎉" : "¡Añadido! Se mantendrá actualizado solo.");
    router.push(eventPath(id));
  };

  const input = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 outline-none focus:border-brand";
  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8">
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Añade un evento</h1>
      <p className="mt-2 text-muted">
        Pega el link y lo rellenamos por ti. Funciona con Luma, Meetup, Eventbrite, eventos de LinkedIn y casi cualquier
        web de evento.
      </p>

      <form onSubmit={read} className="mt-6 flex gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-2xl border border-line bg-surface px-4 focus-within:border-brand">
          <Link2 className="size-4 shrink-0 text-muted" />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://luma.com/…"
            className="w-full bg-transparent py-3 outline-none"
          />
        </label>
        <button
          disabled={loading}
          className="flex items-center gap-1.5 rounded-2xl bg-brand px-4 font-semibold text-white disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Leer
        </button>
      </form>
      {!form && (
        <button onClick={() => setForm({ ...EMPTY })} className="mt-3 text-sm font-medium text-brand">
          …o rellénalo a mano (p. ej. si lo viste en Instagram o en un grupo de WhatsApp)
        </button>
      )}

      {form && (
        <form onSubmit={save} className="mt-8 space-y-5">
          {form.image_url && <Cover src={form.image_url} title={form.title} className="aspect-[2/1] w-full rounded-2xl" />}
          {form.id && (
            <p className="rounded-xl bg-ok-soft px-3 py-2 text-sm font-medium text-ok">
              ✓ Leído de {form.id.split(":")[0]}. Las plazas y la lista de espera se actualizarán solas.
            </p>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Nombre del evento *</span>
            <input className={input} value={form.title} onChange={(e) => set({ title: e.target.value })} required />
          </label>

          <div>
            <span className="mb-2 block text-sm font-semibold">Tipo</span>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <Chip key={k.id} active={form.kind === k.id} onClick={() => set({ kind: k.id })}>
                  {k.emoji} {k.label.replace(/s$/, "")}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Empieza *</span>
              <input type="datetime-local" className={input} value={form.start} onChange={(e) => set({ start: e.target.value })} required />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Termina</span>
              <input type="datetime-local" className={input} value={form.end} onChange={(e) => set({ end: e.target.value })} />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={form.is_online} onChange={(e) => set({ is_online: e.target.checked })} />
            Es online
          </label>
          {!form.is_online && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Lugar</span>
                <input className={input} placeholder="Campus Google, IE Tower…" value={form.venue_name} onChange={(e) => set({ venue_name: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Dirección</span>
                <input className={input} value={form.address} onChange={(e) => set({ address: e.target.value })} />
              </label>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Organiza</span>
              <input className={input} value={form.organizer} onChange={(e) => set({ organizer: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Link para apuntarse</span>
              <input className={input} value={form.url} onChange={(e) => set({ url: e.target.value })} />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={form.is_free} onChange={(e) => set({ is_free: e.target.checked })} />
              Gratis
            </label>
            {!form.is_free && (
              <input
                className={`${input} w-32`}
                placeholder="Precio €"
                inputMode="decimal"
                value={form.price_min}
                onChange={(e) => set({ price_min: e.target.value })}
              />
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Descripción</span>
            <textarea rows={5} className={input} value={form.description} onChange={(e) => set({ description: e.target.value })} />
          </label>

          <button
            disabled={saving}
            className="w-full rounded-2xl bg-foreground py-3.5 font-semibold text-background disabled:opacity-60"
          >
            {saving ? "Publicando…" : "Publicar evento"}
          </button>
        </form>
      )}
    </main>
  );
}
