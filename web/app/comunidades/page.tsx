"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe2, Lock, Plus } from "lucide-react";
import { useSession } from "@/app/components/Session";
import { useToast } from "@/app/components/Toast";

export type Community = {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  is_public: boolean;
  owner_id: string;
  invite_code?: string;
  members?: number;
};

const EMOJIS = ["🚀", "🤖", "🧠", "💻", "📊", "⚡", "🦄", "👩‍💻", "🎓", "☕", "🍻", "🌍"];

export default function ComunidadesPage() {
  const { supabase, user, loaded } = useSession();
  const toast = useToast();
  const router = useRouter();
  const [mine, setMine] = useState<Community[]>([]);
  const [publicOnes, setPublicOnes] = useState<Community[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", emoji: "🚀", is_public: false });

  const withCounts = useCallback(
    async (list: Community[]) =>
      Promise.all(
        list.map(async (c) => {
          const { data } = await supabase.rpc("group_member_count", { p_group_id: c.id });
          return { ...c, members: (data as number) ?? 0 };
        })
      ),
    [supabase]
  );

  const fetchAll = useCallback(async () => {
    const cols = "id, name, description, emoji, is_public, owner_id";
    const { data: pub } = await supabase.from("groups").select(cols).eq("is_public", true).limit(50);
    let mineList: Community[] = [];
    if (user) {
      const { data: m } = await supabase.from("group_members").select(`groups(${cols})`).eq("user_id", user.id);
      mineList = ((m ?? []) as unknown as { groups: Community | null }[]).map((r) => r.groups).filter((g): g is Community => !!g);
    }
    const myIds = new Set(mineList.map((g) => g.id));
    return {
      mine: await withCounts(mineList),
      pub: await withCounts(((pub ?? []) as Community[]).filter((c) => !myIds.has(c.id))),
    };
  }, [supabase, user, withCounts]);

  useEffect(() => {
    if (!loaded) return;
    let alive = true;
    fetchAll().then((r) => {
      if (!alive) return;
      setMine(r.mine);
      setPublicOnes(r.pub);
    });
    return () => {
      alive = false;
    };
  }, [loaded, fetchAll]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return router.push("/entrar?next=/comunidades");
    if (!form.name.trim()) return;
    // El id se genera aquí: justo tras crearla aún no eres miembro, y la política de
    // lectura de groups lo exige, así que no se puede pedir de vuelta con .select().
    const id = crypto.randomUUID();
    const { error } = await supabase.from("groups").insert({
      id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      emoji: form.emoji,
      is_public: form.is_public,
      owner_id: user.id,
    });
    if (error) return toast.error(error.message);
    const { error: mErr } = await supabase.from("group_members").insert({ group_id: id, user_id: user.id });
    if (mErr) return toast.error(mErr.message);
    toast.success("¡Comunidad creada! Invita a tu gente 🎉");
    router.push(`/comunidades/${id}`);
  };

  const join = async (c: Community) => {
    if (!user) return router.push("/entrar?next=/comunidades");
    const { error } = await supabase.rpc("join_public_group", { p_group_id: c.id });
    if (error) return toast.error(error.message);
    toast.success(`Te has unido a ${c.name}`);
    router.push(`/comunidades/${c.id}`);
  };

  const input = "w-full rounded-xl border border-line bg-background px-3 py-2.5 outline-none focus:border-brand";

  const Card = ({ c, action }: { c: Community; action?: React.ReactNode }) => (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-2xl">{c.emoji ?? "🚀"}</span>
      <Link href={`/comunidades/${c.id}`} className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-semibold">
          {c.name}
          {c.is_public ? <Globe2 className="size-3.5 text-muted" /> : <Lock className="size-3.5 text-muted" />}
        </p>
        <p className="truncate text-sm text-muted">
          {c.members ?? 0} {c.members === 1 ? "miembro" : "miembros"}
          {c.description ? ` · ${c.description}` : ""}
        </p>
      </Link>
      {action}
    </div>
  );

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Comunidades</h1>
          <p className="mt-1 text-muted">Tu gente para ir juntos a eventos: amigos, clase, equipo, o una comunidad abierta.</p>
        </div>
        <button
          onClick={() => setCreating((c) => !c)}
          className="flex shrink-0 items-center gap-1 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
        >
          <Plus className="size-4" /> Crear
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="mt-6 space-y-4 rounded-2xl border border-line bg-surface p-4">
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((em) => (
              <button
                type="button"
                key={em}
                onClick={() => setForm({ ...form, emoji: em })}
                className={`size-10 rounded-xl text-xl ${form.emoji === em ? "bg-brand-soft ring-2 ring-brand" : "bg-surface-2"}`}
              >
                {em}
              </button>
            ))}
          </div>
          <input className={input} placeholder="Nombre (p. ej. «Máster IA ICAI», «Women in ML Madrid»)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={input} placeholder="Descripción corta (opcional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: false, icon: <Lock className="size-4" />, t: "Privada", d: "Solo con link de invitación" },
              { v: true, icon: <Globe2 className="size-4" />, t: "Abierta", d: "Cualquiera puede unirse" },
            ].map((o) => (
              <button
                type="button"
                key={String(o.v)}
                onClick={() => setForm({ ...form, is_public: o.v })}
                className={`rounded-xl border p-3 text-left ${form.is_public === o.v ? "border-brand bg-brand-soft" : "border-line"}`}
              >
                <span className="flex items-center gap-1.5 font-semibold">
                  {o.icon} {o.t}
                </span>
                <span className="text-xs text-muted">{o.d}</span>
              </button>
            ))}
          </div>
          <button className="w-full rounded-xl bg-brand py-3 font-semibold text-white">Crear comunidad</button>
        </form>
      )}

      {user && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-bold">Las tuyas</h2>
          {mine.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
              Aún no estás en ninguna. Crea una con tus amigos o únete a una abierta.
            </p>
          ) : (
            <div className="space-y-2">
              {mine.map((c) => (
                <Card key={c.id} c={c} />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 font-display text-lg font-bold">Comunidades abiertas</h2>
        {publicOnes.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay ninguna. ¡Crea la primera!</p>
        ) : (
          <div className="space-y-2">
            {publicOnes.map((c) => (
              <Card
                key={c.id}
                c={c}
                action={
                  <button onClick={() => join(c)} className="rounded-full bg-brand px-3.5 py-1.5 text-sm font-semibold text-white">
                    Unirme
                  </button>
                }
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
