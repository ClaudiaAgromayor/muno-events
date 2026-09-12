"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/app/lib/supabase/client";

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoaded(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

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

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted">{name}</span>
      <button
        onClick={() => supabase.auth.signOut()}
        className="text-xs uppercase tracking-wider text-muted underline decoration-1 underline-offset-2 hover:text-foreground"
      >
        Salir
      </button>
    </div>
  );
}
