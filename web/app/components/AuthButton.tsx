"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/app/lib/supabase/client";

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [showName, setShowName] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const supabase = createClient();

  const loadProfile = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase.from("profiles").select("show_name").eq("id", userId).single();
      if (error) {
        alert(`Error cargando tu perfil: ${error.message}`);
        return;
      }
      setShowName(data?.show_name ?? false);
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
        className="rounded-full border border-foreground px-4 py-1.5 text-xs uppercase tracking-wider transition-colors hover:bg-foreground hover:text-background"
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

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted">{name}</span>
      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
        <input type="checkbox" checked={showName} onChange={toggleShowName} className="cursor-pointer" />
        Mostrar mi nombre a otros asistentes
      </label>
      <button
        onClick={() => supabase.auth.signOut()}
        className="text-xs uppercase tracking-wider text-muted underline decoration-1 underline-offset-2 hover:text-foreground"
      >
        Salir
      </button>
    </div>
  );
}
