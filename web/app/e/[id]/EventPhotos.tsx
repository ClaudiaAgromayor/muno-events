"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Lock, Globe2 } from "lucide-react";
import { useSession } from "@/app/components/Session";
import { useToast } from "@/app/components/Toast";
import type { MunoEvent } from "@/app/lib/events";

type Post = {
  id: string;
  user_id: string;
  kind: "nota" | "foto" | "documento" | "video";
  text_content: string | null;
  storage_path: string | null;
  is_public: boolean;
  url?: string;
  profiles: { display_name: string | null } | null;
};

function kindFromMime(mime: string): Post["kind"] {
  if (mime.startsWith("image/")) return "foto";
  if (mime.startsWith("video/")) return "video";
  return "documento";
}

/**
 * Fotos y notas después del evento. Por defecto solo las ven quienes también fueron
 * (RLS: posts visibles si tienes rsvp al mismo evento); se pueden marcar como públicas.
 */
export default function EventPhotos({ event, attended }: { event: MunoEvent; attended: boolean }) {
  const { supabase, user } = useSession();
  const toast = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [note, setNote] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchPosts = useCallback(async () => {
    const { data } = await supabase
      .from("posts")
      .select("id, user_id, kind, text_content, storage_path, is_public, profiles(display_name)")
      .eq("event_id", event.id)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as unknown as Post[];
    const paths = rows.filter((p) => p.storage_path).map((p) => p.storage_path!);
    if (paths.length) {
      const { data: signed } = await supabase.storage.from("event-posts").createSignedUrls(paths, 3600);
      const map = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
      rows.forEach((p) => p.storage_path && (p.url = map.get(p.storage_path) ?? undefined));
    }
    return rows;
  }, [supabase, event.id]);

  const load = useCallback(() => fetchPosts().then(setPosts), [fetchPosts]);

  useEffect(() => {
    let alive = true;
    fetchPosts().then((p) => alive && setPosts(p));
    return () => {
      alive = false;
    };
  }, [fetchPosts, attended]);

  const upload = async (files: FileList) => {
    if (!user) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${event.id}/${user.id}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from("event-posts").upload(path, file);
      if (error) {
        toast.error(`No se pudo subir ${file.name}: ${error.message}`);
        continue;
      }
      await supabase
        .from("posts")
        .insert({ event_id: event.id, user_id: user.id, kind: kindFromMime(file.type), storage_path: path, is_public: isPublic });
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    toast.success("¡Subido! 📸");
    load();
  };

  const postNote = async () => {
    if (!user || !note.trim()) return;
    const { error } = await supabase
      .from("posts")
      .insert({ event_id: event.id, user_id: user.id, kind: "nota", text_content: note.trim(), is_public: isPublic });
    if (error) return toast.error(error.message);
    setNote("");
    load();
  };

  const photos = posts.filter((p) => (p.kind === "foto" || p.kind === "video") && p.url);
  const notes = posts.filter((p) => p.kind === "nota" || p.kind === "documento");

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-display text-lg font-bold">📸 Fotos y recuerdos</h2>

      {photos.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {photos.map((p) =>
            p.kind === "foto" ? (
              <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="relative aspect-square overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal */}
                <img src={p.url} alt="" className="size-full object-cover transition hover:scale-105" />
              </a>
            ) : (
              <video key={p.id} src={p.url} controls className="aspect-square rounded-lg object-cover" />
            )
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">
          {attended ? "Todavía no hay fotos. ¡Sé la primera persona en subir una!" : "Aún no hay fotos públicas."}
        </p>
      )}

      {notes.length > 0 && (
        <ul className="mt-4 space-y-2">
          {notes.map((p) => (
            <li key={p.id} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
              {p.text_content ?? (
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand">
                  📎 Documento
                </a>
              )}
              {p.profiles?.display_name && <span className="text-muted"> — {p.profiles.display_name}</span>}
            </li>
          ))}
        </ul>
      )}

      {attended ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <div className="flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && postNote()}
              placeholder="¿Qué tal estuvo? Slides, contactos, aprendizajes…"
              className="flex-1 rounded-xl border border-line bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button onClick={postNote} className="rounded-xl bg-foreground px-3 text-sm font-semibold text-background">
              Publicar
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-brand px-3 py-2 text-sm font-semibold text-brand hover:bg-brand-soft">
              <ImagePlus className="size-4" />
              {busy ? "Subiendo…" : "Subir fotos"}
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf"
                className="hidden"
                disabled={busy}
                onChange={(e) => e.target.files && upload(e.target.files)}
              />
            </label>
            <button
              onClick={() => setIsPublic(!isPublic)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted"
            >
              {isPublic ? <Globe2 className="size-3.5" /> : <Lock className="size-3.5" />}
              {isPublic ? "Visible para todos" : "Solo para quien fue"}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted">Marca «Yo fui» para subir tus fotos y ver las de los demás asistentes.</p>
      )}
    </section>
  );
}
