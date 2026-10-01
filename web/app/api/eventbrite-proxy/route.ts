import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

// Eventbrite bloquea las IPs de GitHub Actions (405). El scraper de Python
// (src/eventos_tech_madrid/scrapers/eventbrite.py) le pide las páginas a esta ruta, que
// las descarga desde Vercel. Solo deja pasar URLs de Eventbrite de búsqueda y de
// disponibilidad, y solo con el secreto compartido: no es un proxy abierto.
//
// GET /api/eventbrite-proxy?check=1 -> prueba sin secreto: ¿Vercel puede leer Eventbrite?

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const CHECK_URL = "https://www.eventbrite.es/d/spain--madrid/science-and-tech--events/";

function allowed(raw: string) {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" &&
      u.hostname === "www.eventbrite.es" &&
      (u.pathname.startsWith("/d/") || u.pathname === "/api/v3/destination/events/")
    );
  } catch {
    return false;
  }
}

function secretOk(given: string | null) {
  const expected = process.env.SCRAPER_PROXY_SECRET;
  if (!expected || !given) return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function fetchEventbrite(url: string) {
  return fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9" },
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
  });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  if (params.get("check")) {
    const r = await fetchEventbrite(CHECK_URL);
    const body = await r.text();
    return NextResponse.json({
      eventbrite_status: r.status,
      bytes: body.length,
      has_data: body.includes("__SERVER_DATA__"),
      verdict: r.ok && body.includes("__SERVER_DATA__") ? "Vercel SÍ puede leer Eventbrite ✅" : "Bloqueado también ❌",
    });
  }

  if (!secretOk(request.headers.get("x-proxy-secret"))) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const target = params.get("url");
  if (!target || !allowed(target)) {
    return NextResponse.json({ error: "URL no permitida" }, { status: 400 });
  }

  const r = await fetchEventbrite(target);
  return new NextResponse(await r.text(), {
    status: r.status,
    headers: { "Content-Type": r.headers.get("Content-Type") ?? "text/plain" },
  });
}
