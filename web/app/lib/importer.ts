import "server-only";
import type { EventKind, EventStatus } from "@/app/lib/events";

// Extrae los datos de un evento a partir de un link pegado por una persona.
// Mismas fuentes que el scraper de Python (src/eventos_tech_madrid/scrapers), pero de
// un solo evento y al momento.

export type ImportedEvent = {
  id: string; // "luma:evt-x" / "meetup:123" / "eventbrite:123" / null si genérico
  platform: "luma" | "meetup" | "eventbrite" | "web";
  url: string;
  title: string;
  description: string | null;
  image_url: string | null;
  organizer: string | null;
  start_at: string | null;
  end_at: string | null;
  is_online: boolean;
  venue_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  is_free: boolean | null;
  price_min: number | null;
  status: EventStatus;
  going_count: number | null;
  capacity: number | null;
  kind: EventKind;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

async function get(url: string, init?: RequestInit) {
  const r = await fetch(url, {
    ...init,
    headers: { "User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`${new URL(url).host} respondió ${r.status}`);
  return r;
}

export function guessKind(text: string): EventKind {
  const t = text.toLowerCase();
  if (/hackat(h)?[oó]n|buildathon|build ?day|game jam|\bctf\b/.test(t)) return "hackathon";
  if (/summit|congreso|conference|conferencia|forum|festival|cumbre|jornadas/.test(t)) return "conferencia";
  if (/workshop|taller|bootcamp|hands[- ]on|masterclass|curso|training/.test(t)) return "workshop";
  if (/networking|brunch|beers|cervezas|drinks|afterwork|dinner|cena|breakfast|desayuno|mixer/.test(t)) return "networking";
  if (/charla|talk|webinar|ponencia|mesa redonda|panel|keynote/.test(t)) return "charla";
  return "meetup";
}

function docToText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (n.type === "text") return n.text ?? "";
  const inner = (n.content ?? []).map(docToText).join("");
  return ["paragraph", "heading", "list_item"].includes(n.type ?? "") ? inner + "\n" : inner;
}

function spotsStatus(o: {
  soldOut?: boolean;
  waitlist?: boolean;
  closed?: boolean;
  capacity?: number | null;
  going?: number | null;
}): EventStatus {
  const left = o.capacity && o.going != null ? o.capacity - o.going : null;
  if (o.soldOut || (left != null && left <= 0)) return o.waitlist ? "waitlist" : "sold_out";
  if (o.closed) return "closed";
  if (left != null && o.capacity && (left <= 3 || left / o.capacity <= 0.15)) return "few_left";
  return "open";
}

// ---------------- Luma ----------------
async function fromLuma(url: URL): Promise<ImportedEvent> {
  const slug = url.pathname.split("/").filter(Boolean).pop();
  const info = await (await get(`https://api2.luma.com/url?url=${encodeURIComponent(slug ?? "")}`)).json();
  if (info.kind !== "event") throw new Error("Ese link de Luma no es un evento (¿es un calendario?)");
  const d = info.data;
  const ev = d.event;
  const geo = ev.geo_address_info ?? {};
  const coord = ev.coordinate ?? geo.place_coordinate ?? {};
  const ti = d.ticket_info ?? {};
  const avail = d.registration_availability;
  const title = ev.name as string;
  const description = docToText(d.description_mirror).trim() || null;
  return {
    id: `luma:${ev.api_id}`,
    platform: "luma",
    url: `https://luma.com/${ev.url}`,
    title,
    description,
    image_url: ev.cover_url ?? null,
    organizer: d.calendar?.name ?? d.hosts?.[0]?.name ?? null,
    start_at: ev.start_at,
    end_at: ev.end_at ?? null,
    is_online: ev.location_type === "online",
    venue_name: geo.address ?? null,
    address: geo.full_address ?? geo.short_address ?? null,
    lat: coord.latitude ?? null,
    lng: coord.longitude ?? null,
    is_free: ti.is_free ?? null,
    price_min: null,
    status:
      avail === "waitlist"
        ? "waitlist"
        : spotsStatus({ soldOut: ti.is_sold_out, waitlist: d.waitlist_active, closed: avail === "closed" }),
    going_count: d.guest_count ?? null,
    capacity: null,
    kind: guessKind(`${title} ${description ?? ""}`),
  };
}

// ---------------- Meetup ----------------
async function fromMeetup(url: URL): Promise<ImportedEvent> {
  const id = url.pathname.match(/events\/(\d+)/)?.[1];
  if (!id) throw new Error("No encuentro el número de evento en el link de Meetup");
  const query = `query($id: ID!){ event(id:$id){ id title description dateTime endTime eventUrl eventType maxTickets status
    going{totalCount} rsvpSettings{rsvpsClosed} feeSettings{amount} featuredEventPhoto{highResUrl}
    venue{name address city lat lon} group{name} } }`;
  const r = await get("https://www.meetup.com/gql2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id } }),
  });
  const n = (await r.json()).data?.event;
  if (!n) throw new Error("Meetup no devolvió el evento");
  const capacity = n.maxTickets || null;
  const going = n.going?.totalCount ?? null;
  const closed = !!n.rsvpSettings?.rsvpsClosed;
  return {
    id: `meetup:${n.id}`,
    platform: "meetup",
    url: n.eventUrl,
    title: n.title,
    description: n.description ?? null,
    image_url: n.featuredEventPhoto?.highResUrl ?? null,
    organizer: n.group?.name ?? null,
    start_at: n.dateTime,
    end_at: n.endTime ?? null,
    is_online: n.eventType === "ONLINE",
    venue_name: n.venue?.name ?? null,
    address: n.venue?.address || null,
    lat: n.venue?.lat ?? null,
    lng: n.venue?.lon ?? null,
    is_free: !n.feeSettings?.amount,
    price_min: n.feeSettings?.amount ?? null,
    status: n.status === "CANCELLED" ? "cancelled" : spotsStatus({ capacity, going, closed, waitlist: !closed }),
    going_count: going,
    capacity,
    kind: guessKind(`${n.title} ${n.description ?? ""}`),
  };
}

// ---------------- Eventbrite ----------------
async function fromEventbrite(url: URL): Promise<ImportedEvent> {
  const id = url.pathname.match(/(\d{8,})/)?.[1];
  if (!id) throw new Error("No encuentro el número de evento en el link de Eventbrite");
  const r = await get(
    `https://www.eventbrite.es/api/v3/destination/events/?event_ids=${id}&expand=ticket_availability,primary_venue,primary_organizer,image`
  );
  const e = (await r.json()).events?.[0];
  if (!e) throw new Error("Eventbrite no devolvió el evento");
  const ta = e.ticket_availability ?? {};
  const addr = e.primary_venue?.address ?? {};
  const tz = (d: string) => {
    const m = Number(d.slice(5, 7));
    return m >= 4 && m <= 10 ? "+02:00" : "+01:00"; // aproximación CET/CEST
  };
  return {
    id: `eventbrite:${e.id}`,
    platform: "eventbrite",
    url: e.url,
    title: e.name,
    description: e.summary ?? null,
    image_url: e.image?.url ?? null,
    organizer: e.primary_organizer?.name ?? null,
    start_at: `${e.start_date}T${e.start_time ?? "00:00"}:00${tz(e.start_date)}`,
    end_at: e.end_date ? `${e.end_date}T${e.end_time ?? "23:59"}:00${tz(e.end_date)}` : null,
    is_online: !!e.is_online_event,
    venue_name: e.primary_venue?.name ?? null,
    address: addr.localized_address_display ?? null,
    lat: addr.latitude ? Number(addr.latitude) : null,
    lng: addr.longitude ? Number(addr.longitude) : null,
    is_free: ta.is_free ?? null,
    price_min: ta.minimum_ticket_price?.major_value ? Number(ta.minimum_ticket_price.major_value) : null,
    status: e.is_cancelled ? "cancelled" : spotsStatus({ soldOut: ta.is_sold_out, waitlist: ta.waitlist_available }),
    going_count: null,
    capacity: null,
    kind: guessKind(`${e.name} ${e.summary ?? ""}`),
  };
}

// ---------------- Cualquier otra web (LinkedIn, Instagram, webs propias…) ----------------
function meta(html: string, prop: string) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
  const m = html.match(re) ?? html.match(re2);
  return m ? decode(m[1]) : null;
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function findLdEvent(html: string): Record<string, unknown> | null {
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const items = Array.isArray(data) ? data : data["@graph"] ?? [data];
      for (const it of items) {
        const t = it?.["@type"];
        if (typeof t === "string" ? /Event$/.test(t) : Array.isArray(t) && t.some((x: string) => /Event$/.test(x)))
          return it;
      }
    } catch {}
  }
  return null;
}

async function fromWeb(url: URL): Promise<ImportedEvent> {
  const html = await (await get(url.toString())).text();
  const ld = findLdEvent(html) as Record<string, any> | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  const loc = ld?.location ?? {};
  const addr = loc.address ?? {};
  const title = (ld?.name as string) ?? meta(html, "og:title") ?? html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "";
  const description = (ld?.description as string) ?? meta(html, "og:description") ?? meta(html, "description");
  const image = ld?.image ? (Array.isArray(ld.image) ? ld.image[0] : ld.image.url ?? ld.image) : meta(html, "og:image");
  const offers = Array.isArray(ld?.offers) ? ld.offers[0] : ld?.offers;
  return {
    id: "",
    platform: "web",
    url: url.toString(),
    title: decode(title).trim(),
    description: description ? decode(description) : null,
    image_url: typeof image === "string" ? image : null,
    organizer: ld?.organizer?.name ?? meta(html, "og:site_name"),
    start_at: ld?.startDate ?? null,
    end_at: ld?.endDate ?? null,
    is_online: /Online/i.test(String(ld?.eventAttendanceMode ?? "")),
    venue_name: loc.name ?? null,
    address: typeof addr === "string" ? addr : [addr.streetAddress, addr.addressLocality].filter(Boolean).join(", ") || null,
    lat: loc.geo?.latitude ? Number(loc.geo.latitude) : null,
    lng: loc.geo?.longitude ? Number(loc.geo.longitude) : null,
    is_free: offers ? Number(offers.price) === 0 : null,
    price_min: offers?.price ? Number(offers.price) : null,
    status: /SoldOut/i.test(String(offers?.availability ?? "")) ? "sold_out" : "unknown",
    going_count: null,
    capacity: null,
    kind: guessKind(`${title} ${description ?? ""}`),
  };
}

export async function importEvent(raw: string): Promise<ImportedEvent> {
  let url: URL;
  try {
    url = new URL(raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    throw new Error("Eso no parece un link");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Solo links http(s)");
  const host = url.hostname.replace(/^www\./, "");
  // No seguimos links a la red interna (evita usar el importador para escanear servidores)
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) || host.endsWith(".internal"))
    throw new Error("Link no permitido");

  if (host === "lu.ma" || host === "luma.com") return fromLuma(url);
  if (host.endsWith("meetup.com")) return fromMeetup(url);
  if (host.includes("eventbrite.")) return fromEventbrite(url);
  return fromWeb(url);
}
