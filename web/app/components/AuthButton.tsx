"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/app/lib/supabase/client";

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [showName, setShowName] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const supabase = createClient();

  const loadProfile = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase.from("profiles").select("show_name, linkedin_url").eq("id", userId).single();
      if (error) {
        alert(`Error cargando tu perfil: ${error.message}`);
        return;
      }
      setShowName(data?.show_name ?? false);
      setLinkedinUrl(data?.linkedin_url ?? "");
    },
    [supabase]
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoaded(true);
      if (data.user) loadProfile(data.user.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase, loadProfile]);

  if (!loaded) return null;

  if (!user) {
    return (
      <button
        onClick={() =>
          supabase.auth.signInWithOAuth({
            provider: "github",
            options: { redirectTo: `${window.location.origin}/auth/callback` },
          })
        }
        className="border border-foreground px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider transition-colors hover:bg-foreground hover:text-background"
      >
        Entrar con GitHub
      </button>
    );
  }

  const name = (user.user_metadata?.user_name as string) || user.email || "Tu cuenta";

  const toggleShowName = async () => {
    const next = !showName;
    setShowName(next); // optimista, se revierte si falla
    const { error } = await supabase.from("profiles").update({ show_name: next }).eq("id", user.id);
    if (error) {
      setShowName(!next);
      alert(`Error guardando el ajuste: ${error.message}`);
    }
  };

  const saveLinkedin = async () => {
    const { error } = await supabase.from("profiles").update({ linkedin_url: linkedinUrl || null }).eq("id", user.id);
    if (error) alert(`Error guardando LinkedIn: ${error.message}`);
  };

  return (
    <div className="relative flex items-center gap-4">
      <span className="font-mono text-[11px] tracking-tight text-muted">{name}</span>
      <a
        href="/mis-eventos"
        className="text-[11px] uppercase tracking-wider text-muted underline decoration-1 underline-offset-2 hover:text-foreground"
      >
        Mis eventos
      </a>
      <a
        href="/grupos"
        className="text-[11px] uppercase tracking-wider text-muted underline decoration-1 underline-offset-2 hover:text-foreground"
      >
        Grupos
      </a>
      <button
        onClick={() => setShowSettings((v) => !v)}
        className="text-[11px] uppercase tracking-wider text-muted underline decoration-1 underline-offset-2 hover:text-foreground"
      >
        Ajustes
      </button>
      <button
        onClick={() => supabase.auth.signOut()}
        className="text-[11px] uppercase tracking-wider text-muted underline decoration-1 underline-offset-2 hover:text-foreground"
      >
        Salir
      </button>

      {showSettings && (
        <div className="absolute right-0 top-full z-10 mt-2 flex w-64 flex-col gap-3 border border-foreground bg-background p-4 shadow-lg">
          <button
            onClick={toggleShowName}
            className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-foreground"
          >
            <span
              className={`flex h-3.5 w-3.5 items-center justify-center border ${
                showName ? "border-foreground bg-foreground text-background" : "border-line"
              }`}
            >
              {showName && <span className="text-[9px] leading-none">✓</span>}
            </span>
            Mostrar mi nombre a otros asistentes
          </button>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wider text-muted">
              LinkedIn (se muestra si coincides con alguien)
            </label>
            <div className="flex gap-1.5">
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className="flex-grow border border-line bg-transparent px-2 py-1 text-xs"
              />
              <button
                onClick={saveLinkedin}
                className="border border-foreground px-2 py-1 text-[11px] uppercase tracking-wider hover:bg-foreground hover:text-background"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
