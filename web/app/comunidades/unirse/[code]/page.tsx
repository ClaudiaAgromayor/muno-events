"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/app/components/Session";
import { useToast } from "@/app/components/Toast";

export default function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { supabase, user, loaded } = useSession();
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!loaded) return;
    if (!user) {
      router.replace(`/entrar?next=/comunidades/unirse/${code}`);
      return;
    }
    supabase.rpc("get_group_name", { p_invite_code: code }).then(({ data }) => setName((data as string) ?? null));
  }, [loaded, user, supabase, code, router]);

  const join = async () => {
    const { data, error } = await supabase.rpc("join_group", { p_invite_code: code });
    if (error) return toast.error(error.message);
    toast.success(`¡Bienvenida a ${name}! 🎉`);
    router.push(`/comunidades/${data}`);
  };

  return (
    <main className="mx-auto max-w-sm px-4 pt-20 text-center">
      {name === undefined ? (
        <div className="mx-auto h-24 animate-pulse rounded-2xl bg-surface-2" />
      ) : name === null ? (
        <>
          <p className="text-4xl">🤔</p>
          <p className="mt-2 font-semibold">Este link de invitación no es válido</p>
        </>
      ) : (
        <>
          <p className="text-5xl">💌</p>
          <h1 className="mt-4 font-display text-2xl font-extrabold">Te han invitado a «{name}»</h1>
          <p className="mt-2 text-muted">Veréis a qué eventos va cada uno y podréis apuntaros juntos.</p>
          <button onClick={join} className="mt-6 w-full rounded-2xl bg-brand py-3.5 font-semibold text-white">
            Unirme
          </button>
        </>
      )}
    </main>
  );
}
