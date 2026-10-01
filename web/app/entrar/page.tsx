"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { useSession } from "@/app/components/Session";
import { useToast } from "@/app/components/Toast";

type Provider = "google" | "github" | "linkedin_oidc";

const PROVIDERS: { id: Provider; label: string; icon: React.ReactNode }[] = [
  {
    id: "google",
    label: "Continuar con Google",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5">
        <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.4-.2-2.1H12v4h6c-.1 1-.8 2.5-2.3 3.5v2.9h3.7c2.1-2 3.2-4.9 3.2-8.3z" />
        <path fill="#34A853" d="M12 23c3 0 5.6-1 7.4-2.7l-3.7-2.9c-1 .7-2.3 1.2-3.7 1.2-2.9 0-5.3-1.9-6.2-4.6H2v3c1.8 3.6 5.6 6 10 6z" />
        <path fill="#FBBC05" d="M5.8 14c-.2-.7-.4-1.4-.4-2s.1-1.4.4-2V7H2C1.4 8.6 1 10.2 1 12s.4 3.4 1 5l3.8-3z" />
        <path fill="#EA4335" d="M12 5.4c1.6 0 2.8.7 3.5 1.3l2.6-2.5C16.6 2.8 14.5 2 12 2 7.6 2 3.8 4.4 2 8l3.8 3c.9-2.7 3.3-4.6 6.2-4.6z" />
      </svg>
    ),
  },
  {
    id: "linkedin_oidc",
    label: "Continuar con LinkedIn",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="#0A66C2">
        <path d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.3V9h3.4v1.6h.1c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2zM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zM7.1 20.5H3.5V9h3.6v11.5zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7C24 .8 23.2 0 22.2 0z" />
      </svg>
    ),
  },
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
