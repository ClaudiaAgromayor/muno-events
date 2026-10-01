"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useSession } from "@/app/components/Session";
import { useToast } from "@/app/components/Toast";

// El Client ID de OAuth es público por diseño (Google lo ve cualquiera en el navegador).
// El secreto NO va aquí: solo está en Supabase.
const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ??
  "524564193002-vcjeebuqcmpvvorp9b00gbit24e9em5s.apps.googleusercontent.com";

type CredentialResponse = { credential: string };
type GoogleId = {
  initialize: (o: Record<string, unknown>) => void;
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Botón oficial "Iniciar sesión con Google" (Google Identity Services). A diferencia del
 * OAuth por redirección, Google muestra muno-events.vercel.app y no el dominio de Supabase:
 * Google nos da un ID token y se lo pasamos a Supabase con signInWithIdToken.
 * El nonce evita que un token robado se pueda reutilizar: Google firma el hash y Supabase
 * comprueba que corresponde al valor original.
 */
export default function GoogleButton({ onDone }: { onDone: () => void }) {
  const { supabase } = useSession();
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);

  const init = useCallback(async () => {
    const gis = window.google?.accounts.id;
    if (!gis || !ref.current) return;
    const rawNonce = crypto.randomUUID() + crypto.randomUUID();
    const hashedNonce = await sha256Hex(rawNonce);

    gis.initialize({
      client_id: GOOGLE_CLIENT_ID,
      nonce: hashedNonce,
      use_fedcm_for_prompt: true,
      callback: async ({ credential }: CredentialResponse) => {
        const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: credential, nonce: rawNonce });
        if (error) return toast.error(error.message);
        onDone();
      },
    });
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    gis.renderButton(ref.current, {
      type: "standard",
      theme: dark ? "filled_black" : "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      logo_alignment: "center",
      locale: "es",
      width: Math.min(ref.current.offsetWidth || 360, 400),
    });
  }, [supabase, toast, onDone]);

  useEffect(() => {
    if (scriptReady) init();
  }, [scriptReady, init]);

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setScriptReady(true)} />
      <div ref={ref} className="flex min-h-11 w-full justify-center" />
    </>
  );
}
