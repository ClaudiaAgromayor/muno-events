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

  return (
    <div className="flex items-center gap-4">
      <span className="font-mono text-[11px] tracking-tight text-muted">{name}</span>
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
        Mostrar mi nombre
      </button>
      <button
        onClick={() => supabase.auth.signOut()}
        className="text-[11px] uppercase tracking-wider text-muted underline decoration-1 underline-offset-2 hover:text-foreground"
      >
        Salir
      </button>
    </div>
  );
}
