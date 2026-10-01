"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { displayName, useSession, type Profile } from "@/app/components/Session";
import { useToast } from "@/app/components/Toast";
import { Avatar } from "@/app/components/ui";

export default function PerfilPage() {
  const { user, profile, loaded } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loaded && !user) router.replace("/entrar?next=/perfil");
  }, [loaded, user, router]);

  if (!user) return null;
  // key: el formulario se reinicia con los datos cuando llega (o cambia) el perfil
  return <ProfileForm key={profile?.id ?? "none"} profile={profile} />;
}

function ProfileForm({ profile }: { profile: Profile | null }) {
  const { supabase, user, refreshProfile } = useSession();
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState({
    display_name: profile?.display_name ?? "",
    headline: profile?.headline ?? "",
    linkedin_url: profile?.linkedin_url ?? "",
    show_name: profile?.show_name ?? false,
  });
  if (!user) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name.trim() || null,
        headline: form.headline.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
        show_name: form.show_name,
      })
      .eq("id", user.id);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Perfil guardado");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const input = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 outline-none focus:border-brand";

  return (
    <main className="mx-auto max-w-lg px-4 pt-8">
      <div className="flex items-center gap-4">
        <Avatar name={displayName(user, profile)} url={profile?.avatar_url} size={64} />
        <div>
          <h1 className="font-display text-2xl font-extrabold">{displayName(user, profile)}</h1>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
      </div>

      <form onSubmit={save} className="mt-8 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Nombre</span>
          <input className={input} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">A qué te dedicas</span>
          <input
            className={input}
            placeholder="ML Engineer @ Startup, estudiante de ICAI…"
            value={form.headline}
            onChange={(e) => setForm({ ...form, headline: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">LinkedIn</span>
          <input
            className={input}
            placeholder="https://linkedin.com/in/…"
            value={form.linkedin_url}
            onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
          />
        </label>
        <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-[var(--brand)]"
            checked={form.show_name}
            onChange={(e) => setForm({ ...form, show_name: e.target.checked })}
          />
          <span>
            <span className="block font-semibold">Mostrar mi nombre a otros asistentes</span>
            <span className="text-sm text-muted">
              Si está desactivado, cuentas en «X van» pero sin nombre. Dentro de tus comunidades siempre se te ve.
            </span>
          </span>
        </label>
        <button className="w-full rounded-2xl bg-foreground py-3 font-semibold text-background">Guardar</button>
      </form>

      <button onClick={signOut} className="mt-6 flex items-center gap-2 text-sm font-medium text-muted hover:text-bad">
        <LogOut className="size-4" /> Cerrar sesión
      </button>
    </main>
  );
}
