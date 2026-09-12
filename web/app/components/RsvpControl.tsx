"use client";

export type RsvpSummary = {
  count: number;
  names: string[];
  isGoing: boolean;
};

export default function RsvpControl({
  summary,
  signedIn,
  onToggle,
}: {
  summary: RsvpSummary;
  signedIn: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }}
        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
          summary.isGoing
            ? "border-ok bg-ok text-background"
            : "border-line text-muted hover:border-foreground hover:text-foreground"
        }`}
      >
        {summary.isGoing ? "Voy ✓" : signedIn ? "Voy" : "Voy (entrar)"}
      </button>
      {summary.count > 0 && (
        <span className="text-[11px] text-muted">
          {summary.count} {summary.count === 1 ? "va" : "van"}
          {summary.names.length > 0 && ` · ${summary.names.slice(0, 2).join(", ")}`}
        </span>
      )}
    </div>
  );
}
