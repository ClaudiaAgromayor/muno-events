"use client";

import { useState } from "react";

export type RsvpSummary = {
  count: number;
  names: string[];
  isGoing: boolean;
  /** Nombres de gente que va Y esta en alguno de tus grupos -- prueba social con gente conocida. */
  groupmates: string[];
  /** Nombres de gente que va Y con quien ya coincidiste (match mutuo) en un evento pasado. */
  knownFromBefore: string[];
};

type MyGroup = { id: string; name: string };

export default function RsvpControl({
  summary,
  signedIn,
  full,
  myGroups,
  onToggle,
  onGroupRsvp,
}: {
  summary: RsvpSummary;
  signedIn: boolean;
  /** true si la fuente dice que no quedan plazas (Meetup spots_left<=0, Luma sold_out) */
  full: boolean;
  myGroups: MyGroup[];
  onToggle: () => void;
  onGroupRsvp: (groupId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [stamped, setStamped] = useState(false);

  // Si no hay plazas segun la plataforma original, no dejamos marcar "voy" de nuevas --
  // pero si alguien ya lo habia marcado antes, le dejamos quitarselo sin problema.
  const blocked = full && !summary.isGoing;

  return (
    <div className="relative flex flex-col items-end gap-1">
      {stamped && (
        <span
          aria-hidden
          className="animate-stamp pointer-events-none absolute -top-2 right-0 -rotate-12 border-2 border-accent px-2 py-0.5 font-display text-sm italic text-accent"
        >
          ¡Apuntada!
        </span>
      )}

      <button
        disabled={blocked}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // El sello solo salta por el propio clic que marca "voy" (no al desmarcarlo,
          // ni al cargar la pagina si ya estabas apuntada -- eso NO es una accion nueva).
          if (!summary.isGoing) {
            setStamped(true);
            setTimeout(() => setStamped(false), 900);
          }
          onToggle();
        }}
        className={`flex items-center gap-1.5 border px-3 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors ${
          blocked
            ? "cursor-not-allowed border-line/60 text-muted/60"
            : summary.isGoing
              ? "border-ok bg-ok text-background"
              : "border-foreground text-foreground hover:bg-foreground hover:text-background"
        }`}
      >
        {summary.isGoing && <span aria-hidden>✓</span>}
        {blocked ? "Cerrado" : summary.isGoing ? "Voy" : signedIn ? "Voy" : "Voy · entrar"}
      </button>

      {signedIn && !blocked && myGroups.length > 0 && (
        <select
          defaultValue=""
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.target.value) onGroupRsvp(e.target.value);
            e.target.value = "";
          }}
          className="border border-line bg-transparent px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted hover:border-foreground"
        >
          <option value="" disabled>
            Vamos con...
          </option>
          {myGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      )}

      {summary.count > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1.5">
            {summary.names.slice(0, 3).map((name, i) => (
              <span
                key={`${name}-${i}`}
                style={{ zIndex: 3 - i }}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-background bg-foreground text-[10px] font-medium text-background"
              >
                {name.charAt(0).toUpperCase()}
              </span>
            ))}
            {summary.names.length > 3 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-background bg-muted text-[9px] font-medium text-background">
                +{summary.names.length - 3}
              </span>
            )}
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="flex items-center gap-1.5 font-mono text-[11px] tracking-tight text-muted underline decoration-dotted underline-offset-2 hover:text-foreground"
          >
            {/* Confirma visualmente que el contador es en vivo (Realtime), no una foto fija. */}
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-ok" />
            {String(summary.count).padStart(2, "0")} {summary.count === 1 ? "va" : "van"}
          </button>
        </div>
      )}

      {summary.groupmates.length > 0 && (
        <div className="max-w-[180px] text-right text-[11px] font-medium text-accent">
          {summary.groupmates.length === 1
            ? `Va ${summary.groupmates[0]} · tu grupo`
            : `Van ${summary.groupmates.length} de tu grupo`}
        </div>
      )}

      {summary.knownFromBefore.length > 0 && (
        <div className="max-w-[180px] text-right text-[11px] font-medium text-ok">
          {summary.knownFromBefore.length === 1
            ? `Va ${summary.knownFromBefore[0]} · coincidisteis antes`
            : `Van ${summary.knownFromBefore.length} con quien coincidiste antes`}
        </div>
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
