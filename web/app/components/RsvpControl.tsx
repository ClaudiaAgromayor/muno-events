"use client";

import { useState } from "react";

export type RsvpSummary = {
  count: number;
  names: string[];
  isGoing: boolean;
};

export default function RsvpControl({
  summary,
  signedIn,
  full,
  onToggle,
}: {
  summary: RsvpSummary;
  signedIn: boolean;
  /** true si la fuente dice que no quedan plazas (Meetup spots_left<=0, Luma sold_out) */
  full: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Si no hay plazas segun la plataforma original, no dejamos marcar "voy" de nuevas --
  // pero si alguien ya lo habia marcado antes, le dejamos quitarselo sin problema.
  const blocked = full && !summary.isGoing;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        disabled={blocked}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }}
        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
          blocked
            ? "cursor-not-allowed border-line text-muted opacity-60"
            : summary.isGoing
              ? "border-ok bg-ok text-background"
              : "border-line text-muted hover:border-foreground hover:text-foreground"
        }`}
      >
        {blocked ? "Sin plazas" : summary.isGoing ? "Voy ✓" : signedIn ? "Voy" : "Voy (entrar)"}
      </button>

      {summary.count > 0 && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="text-[11px] text-muted underline decoration-1 underline-offset-2 hover:text-foreground"
        >
          {summary.count} {summary.count === 1 ? "va" : "van"}
        </button>
      )}

      {expanded && summary.count > 0 && (
        <div className="max-w-[180px] text-right text-[11px] text-muted">
          {summary.names.length > 0 ? summary.names.join(", ") : "Nadie ha mostrado su nombre"}
          {summary.names.length < summary.count &&
            ` (+${summary.count - summary.names.length} sin mostrar nombre)`}
        </div>
      )}
    </div>
  );
}
