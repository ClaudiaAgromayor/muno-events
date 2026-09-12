import fs from "fs";
import path from "path";
import type { MunoEvent } from "@/app/lib/events";

/** Lee data/processed/events.json. Solo se importa desde Server Components. */
export function getEvents(): MunoEvent[] {
  const filePath = path.join(process.cwd(), "..", "data", "processed", "events.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const events = JSON.parse(raw) as MunoEvent[];

  return events
    .filter((e) => e.start_at)
    .sort((a, b) => (a.start_at! < b.start_at! ? -1 : 1));
}
