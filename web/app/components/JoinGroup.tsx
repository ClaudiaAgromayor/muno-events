"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/app/lib/supabase/client";

export default function JoinGroup({ inviteCode }: { inviteCode: string }) {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "joining" | "joined" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoaded(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    supabase.rpc("get_group_name", { p_invite_code: inviteCode }).then(({ data, error }) => {
      if (error) {
        setErrorMsg(error.message);
        setStatus("error");
        return;
      }
      setGroupName(data);
    });
  }, [supabase, inviteCode]);

  const join = async () => {
    if (!user) {
      await supabase.auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo: `${window.location.origin}/grupos/unirse/${inviteCode}` },
      });
      return;
    }
    setStatus("joining");
    const { error } = await supabase.rpc("join_group", { p_invite_code: inviteCode });
    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
      return;
    }
    setStatus("joined");
  };

  if (!loaded || groupName === null) return null;

  if (!groupName) {
    return <p className="text-sm text-muted">Este link de invitación no es válido.</p>;
  }

  if (status === "joined") {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="font-display text-2xl">Ya eres parte de &quot;{groupName}&quot;</p>
        <a
          href="/grupos"
          className="border border-foreground px-4 py-1.5 text-[11px] uppercase tracking-wider hover:bg-foreground hover:text-background"
        >
          Ver mis grupos
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-display text-2xl">Te han invitado a &quot;{groupName}&quot;</p>
      {status === "error" && <p className="text-xs text-accent">{errorMsg}</p>}
      <button
        onClick={join}
        disabled={status === "joining"}
        className="border border-foreground px-4 py-1.5 text-[11px] uppercase tracking-wider hover:bg-foreground hover:text-background"
      >
        {!user ? "Entrar con GitHub y unirme" : status === "joining" ? "Uniéndote..." : "Unirme al grupo"}
      </button>
    </div>
  );
}
