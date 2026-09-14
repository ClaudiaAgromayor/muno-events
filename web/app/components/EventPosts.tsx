"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/app/lib/supabase/client";
import { useToast } from "@/app/components/Toast";

type Post = {
  id: string;
  user_id: string;
  kind: "nota" | "foto" | "documento" | "video";
  text_content: string | null;
  storage_path: string | null;
  created_at: string;
  url?: string; // se rellena aparte, el bucket es privado
};

function kindFromMime(mime: string): Post["kind"] {
  if (mime.startsWith("image/")) return "foto";
  if (mime.startsWith("video/")) return "video";
  return "documento";
}

export default function EventPosts({ eventId, user }: { eventId: string; user: User }) {
  const supabase = createClient();
  const toast = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("posts")
      .select("id, user_id, kind, text_content, storage_path, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error(`Error cargando publicaciones: ${error.message}`);
      return;
    }
    const withUrls = await Promise.all(
      (data ?? []).map(async (p) => {
        if (!p.storage_path) return p as Post;
        const { data: signed } = await supabase.storage.from("event-posts").createSignedUrl(p.storage_path, 3600);
        return { ...p, url: signed?.signedUrl } as Post;
      })
    );
    setPosts(withUrls);
  }, [supabase, eventId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const submitNote = async () => {
    if (!note.trim()) return;
    const text = note.trim();
    // Optimista: la nota aparece en la lista al instante, con un id temporal que se
    // sustituye por el real en cuanto responde el servidor (o se quita si falla).
    const tempId = `temp-${Date.now()}`;
    setPosts((prev) => [
      ...prev,
      { id: tempId, user_id: user.id, kind: "nota", text_content: text, storage_path: null, created_at: new Date().toISOString() },
    ]);
    setNote("");
    const { error } = await supabase
      .from("posts")
      .insert({ event_id: eventId, user_id: user.id, kind: "nota", text_content: text });
    if (error) {
      setPosts((prev) => prev.filter((p) => p.id !== tempId));
      toast.error(`Error al publicar la nota: ${error.message}`);
      return;
    }
    toast.success("Nota publicada");
    load(); // sustituye la nota temporal por la real (con su id definitivo)
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    const path = `${eventId}/${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("event-posts").upload(path, file);
    if (uploadError) {
      toast.error(`Error subiendo el archivo: ${uploadError.message}`);
      setUploading(false);
      return;
    }
    const { error: insertError } = await supabase
      .from("posts")
      .insert({ event_id: eventId, user_id: user.id, kind: kindFromMime(file.type), storage_path: path });
    setUploading(false);
    if (insertError) {
      toast.error(`Error guardando la publicacion: ${insertError.message}`);
      return;
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.success("Subido");
    load();
  };

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
      <p className="text-xs uppercase tracking-wider text-muted">Fotos, notas y documentos</p>

      {posts.length === 0 && <p className="text-xs text-muted">Silencio absoluto — sé la primera en dejar algo.</p>}

      {posts.map((post) => (
        <div key={post.id} className="text-sm">
          {post.kind === "nota" && <p>{post.text_content}</p>}
          {post.kind === "foto" && post.url && (
            <a href={post.url} target="_blank" rel="noopener noreferrer">
              <img src={post.url} alt="" className="max-h-48 rounded-sm" />
            </a>
          )}
          {post.kind === "video" && post.url && (
            <video src={post.url} controls className="max-h-48" />
          )}
          {post.kind === "documento" && post.url && (
            <a href={post.url} target="_blank" rel="noopener noreferrer" className="underline">
              Ver documento
            </a>
          )}
        </div>
      ))}

      <div className="flex flex-col gap-2 pt-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Escribe una nota sobre el evento..."
            className="flex-grow border border-line bg-transparent px-2 py-1 text-sm"
          />
          <button
            onClick={submitNote}
            className="border border-foreground px-3 py-1 text-[11px] uppercase tracking-wider hover:bg-foreground hover:text-background"
          >
            Publicar
          </button>
        </div>
        <label className="text-[11px] uppercase tracking-wider text-muted underline decoration-1 underline-offset-2 hover:text-foreground w-fit cursor-pointer">
          {uploading ? "Subiendo..." : "+ Subir foto, video o documento"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,.pdf,.doc,.docx"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file);
            }}
          />
        </label>
      </div>
    </div>
  );
}
