"use client";

import { useState } from "react";

export type RsvpSummary = {
  count: number;
  names: string[];
  isGoing: boolean;
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
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="font-mono text-[11px] tracking-tight text-muted underline decoration-dotted underline-offset-2 hover:text-foreground"
        >
          {String(summary.count).padStart(2, "0")} {summary.count === 1 ? "va" : "van"}
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
