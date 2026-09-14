"use client";

import type { MunoEvent } from "@/app/lib/events";
import { buildShareCardBlob } from "@/app/lib/shareCard";
import { useToast } from "@/app/components/Toast";

export default function ShareEvent({ event }: { event: MunoEvent }) {
  const toast = useToast();

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // El enlace pasa por nuestro propio dominio (que ya hace de redirector a la
    // plataforma real en /ir/[id]) en vez de la url directa de Luma/Meetup/etc, para que
    // quien reciba el link vea primero "muno" antes de saltar al sitio de siempre.
    const shareUrl = `${window.location.origin}/ir/${encodeURIComponent(event.id)}`;

    try {
      const blob = await buildShareCardBlob(event);
      const file = new File([blob], "muno-evento.png", { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: event.name, text: `${event.name} · vía muno`, url: shareUrl });
        return;
      }

      // Sin Web Share API con ficheros (la mayoria de escritorio): se descarga la
      // tarjeta y se copia el enlace, para pegarlo donde se quiera compartir.
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = "muno-evento.png";
      a.click();
      URL.revokeObjectURL(objectUrl);
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Tarjeta descargada y enlace copiado");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error("No se pudo preparar la tarjeta para compartir");
    }
  };

  return (
    <button
      onClick={handleShare}
      className="text-[11px] uppercase tracking-wider text-muted underline decoration-dotted underline-offset-2 hover:text-foreground"
    >
      Compartir
    </button>
  );
}
