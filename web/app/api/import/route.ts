import { NextResponse } from "next/server";
import { importEvent } from "@/app/lib/importer";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request) {
  // Solo para gente logueada: evita que cualquiera use el servidor como proxy de scraping
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return NextResponse.json({ error: "Entra para añadir eventos" }, { status: 401 });

  const { url } = (await request.json().catch(() => ({}))) as { url?: string };
  if (!url) return NextResponse.json({ error: "Falta el link" }, { status: 400 });

  try {
    const event = await importEvent(url);
    let existing: string | null = null;
    if (event.id) {
      const { data: row } = await supabase.from("events").select("id").eq("id", event.id).maybeSingle();
      existing = row?.id ?? null;
    }
    return NextResponse.json({ event, existing });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo leer el link" }, { status: 422 });
  }
}
