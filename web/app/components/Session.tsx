"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/app/lib/supabase/client";

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  linkedin_url: string | null;
  show_name: boolean;
};

type SessionValue = {
  supabase: SupabaseClient;
  user: User | null;
  profile: Profile | null;
  loaded: boolean;
  refreshProfile: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadProfile = useCallback(
    async (u: User | null) => {
      if (!u) return setProfile(null);
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, headline, linkedin_url, show_name")
        .eq("id", u.id)
        .maybeSingle();
      setProfile((data as Profile) ?? null);
    },
    [supabase]
  );

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      await loadProfile(data.user);
      setLoaded(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user ?? null);
      loadProfile(s?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, loadProfile]);

  const value = useMemo(
    () => ({ supabase, user, profile, loaded, refreshProfile: () => loadProfile(user) }),
    [supabase, user, profile, loaded, loadProfile]
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession fuera de SessionProvider");
  return ctx;
}

/** Nombre corto para mostrar de un usuario logueado. */
export function displayName(user: User | null, profile: Profile | null) {
  return (
    profile?.display_name ||
    (user?.user_metadata?.full_name as string) ||
    (user?.user_metadata?.user_name as string) ||
    user?.email?.split("@")[0] ||
    "Tú"
  );
}
