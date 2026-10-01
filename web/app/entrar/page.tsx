"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { useSession } from "@/app/components/Session";
import { useToast } from "@/app/components/Toast";
import GoogleButton from "@/app/entrar/GoogleButton";

type Provider = "google" | "github";

const PROVIDERS: { id: Provider; label: string; icon: React.ReactNode }[] = [
  {
    id: "github",
    label: "Continuar con GitHub",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
        <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.1 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5z" />
      </svg>
    ),
  },
];

function Login() {
  const { supabase, user } = useSession();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const oauth = async (provider: Provider) => {
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo() } });
    if (error) toast.error(error.message);
  };

  const magic = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
    if (error) return toast.error(error.message);
    setSent(true);
  };

  if (user) {
    return (
      <p className="text-center">
        Ya has entrado. <a href={next} className="font-semibold text-brand">Continuar →</a>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <GoogleButton onDone={() => router.replace(next)} />
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          onClick={() => oauth(p.id)}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 font-semibold transition hover:border-foreground/40"
        >
          {p.icon}
          {p.label}
        </button>
      ))}
      <button onClick={() => oauth("google")} className="block w-full text-center text-xs text-muted hover:text-foreground">
        ¿No te aparece el botón de Google? Entra con Google por aquí
      </button>
      <div className="flex items-center gap-3 py-2 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />o con tu email<span className="h-px flex-1 bg-line" />
      </div>
      {sent ? (
        <p className="rounded-2xl bg-ok-soft p-4 text-center text-sm font-medium text-ok">
          📬 Te hemos enviado un enlace a <b>{email}</b>. Ábrelo desde este dispositivo para entrar.
        </p>
      ) : (
        <form onSubmit={magic} className="flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="min-w-0 flex-1 rounded-2xl border border-line bg-surface px-4 py-3 outline-none focus:border-brand"
          />
          <button className="flex items-center gap-1.5 rounded-2xl bg-foreground px-4 font-semibold text-background">
            <Mail className="size-4" /> Enviar
          </button>
        </form>
      )}
    </div>
  );
}

export default function EntrarPage() {
  return (
    <main className="mx-auto max-w-sm px-4 pt-14">
      <h1 className="text-center font-display text-3xl font-extrabold">Entra en muno</h1>
      <p className="mt-2 mb-8 text-center text-muted">
        Para apuntarte, ir con tu comunidad y subir fotos de los eventos.
      </p>
      <Suspense>
        <Login />
      </Suspense>
      <p className="mt-6 text-center text-xs text-muted">
        Tu nombre está oculto para los demás hasta que tú lo actives en tu perfil.
      </p>
    </main>
  );
}
