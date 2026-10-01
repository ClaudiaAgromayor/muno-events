// Tipos y utilidades de eventos compartidos por servidor y cliente.

export type EventStatus = "open" | "few_left" | "waitlist" | "sold_out" | "closed" | "cancelled" | "unknown";
export type EventKind = "meetup" | "conferencia" | "hackathon" | "networking" | "workshop" | "charla" | "otro";
export type EventSource = "luma" | "meetup" | "eventbrite" | "user" | "web";

export type MunoEvent = {
  id: string;
  city: string;
  source: EventSource;
  url: string | null;
  also_on: { source: EventSource; url: string }[];
  title: string;
  description: string | null;
  image_url: string | null;
  organizer: string | null;
  organizer_url: string | null;
  kind: EventKind;
  topics: string[];
  start_at: string;
  end_at: string | null;
  is_online: boolean;
  venue_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  is_free: boolean | null;
  price_min: number | null;
  currency: string | null;
  status: EventStatus;
  capacity: number | null;
  going_count: number | null;
  waitlist_count: number | null;
  language: string | null;
  featured: boolean;
  last_seen_at: string;
};

// Columnas que pide la lista (sin la descripción larga, para que la página pese poco)
export const LIST_COLUMNS =
  "id,city,source,url,also_on,title,image_url,organizer,kind,topics,start_at,end_at,is_online,venue_name,address,lat,lng,is_free,price_min,currency,status,capacity,going_count,waitlist_count,language,featured,last_seen_at";

export const KINDS: { id: EventKind; label: string; emoji: string }[] = [
  { id: "meetup", label: "Meetups", emoji: "🍕" },
  { id: "conferencia", label: "Conferencias", emoji: "🎤" },
  { id: "hackathon", label: "Hackathons", emoji: "⚡" },
  { id: "networking", label: "Networking", emoji: "🥂" },
  { id: "workshop", label: "Workshops", emoji: "🛠️" },
  { id: "charla", label: "Charlas", emoji: "💬" },
];

export const TOPICS: Record<string, string> = {
  ia: "IA",
  "ml-data": "ML & Data",
  dev: "Desarrollo",
  "cloud-devops": "Cloud & DevOps",
  startups: "Startups",
  "producto-ux": "Producto & UX",
  web3: "Web3",
  ciberseguridad: "Ciberseguridad",
  hardware: "Hardware & Quantum",
};

export function kindInfo(kind: EventKind) {
  return KINDS.find((k) => k.id === kind) ?? { id: "otro", label: "Evento", emoji: "✨" };
}

export const STATUS_INFO: Record<EventStatus, { label: string; tone: "ok" | "warn" | "bad" | "muted" } | null> = {
  open: { label: "Plazas libres", tone: "ok" },
  few_left: { label: "Últimas plazas", tone: "warn" },
  waitlist: { label: "Lista de espera", tone: "warn" },
  sold_out: { label: "Agotado", tone: "bad" },
  closed: { label: "Inscripción cerrada", tone: "bad" },
  cancelled: { label: "Cancelado", tone: "bad" },
  unknown: null,
};

/** ¿Puedes todavía conseguir sitio (aunque sea en lista de espera)? */
export function canJoin(status: EventStatus) {
  return status === "open" || status === "few_left" || status === "waitlist" || status === "unknown";
}

export const SOURCE_LABEL: Record<EventSource, string> = {
  luma: "Luma",
  meetup: "Meetup",
  eventbrite: "Eventbrite",
  user: "la web del evento",
  web: "la web del evento",
};

export function priceLabel(e: Pick<MunoEvent, "is_free" | "price_min" | "currency">): string | null {
  if (e.is_free) return "Gratis";
  if (e.price_min != null && e.price_min > 0) {
    const n = Number.isInteger(e.price_min) ? e.price_min : e.price_min.toFixed(2);
    return `Desde ${n} ${e.currency === "USD" ? "$" : "€"}`;
  }
  return null;
}

// ---------- Fechas (siempre en hora de Madrid, se renderice donde se renderice) ----------

const TZ = "Europe/Madrid";

function parts(iso: string) {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("es-ES", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    time: `${get("hour")}:${get("minute")}`,
    weekday: get("weekday").replace(".", ""),
  };
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const WEEKDAYS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Clave de día "YYYY-MM-DD" en hora de Madrid. */
export function dayKey(iso: string) {
  const p = parts(iso);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function timeLabel(iso: string) {
  return parts(iso).time;
}

export function shortDate(iso: string) {
  const p = parts(iso);
  return { day: p.day, month: MONTHS[p.month - 1], weekday: p.weekday, time: p.time };
}

/** "Hoy", "Mañana", "jueves 2 oct" — para cabeceras de día. */
export function dayLabel(key: string, now = new Date()) {
  const today = dayKey(now.toISOString());
  const tomorrow = dayKey(new Date(now.getTime() + 86400000).toISOString());
  const [y, m, d] = key.split("-").map(Number);
  const wd = WEEKDAYS_LONG[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  if (key === today) return { main: "Hoy", sub: wd };
  if (key === tomorrow) return { main: "Mañana", sub: wd };
  return { main: `${d} ${MONTHS[m - 1]}`, sub: wd };
}

export function longDate(iso: string) {
  const p = parts(iso);
  const wd = WEEKDAYS_LONG[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()];
  return `${wd.charAt(0).toUpperCase() + wd.slice(1)}, ${p.day} de ${MONTHS[p.month - 1]}`;
}

export function isPast(e: Pick<MunoEvent, "start_at" | "end_at">, now = new Date()) {
  return new Date(e.end_at ?? e.start_at).getTime() < now.getTime();
}

export function eventPath(id: string) {
  return `/e/${encodeURIComponent(id)}`;
}

/** Copia del evento que se guarda con cada "voy" (para Mis planes aunque el evento cambie). */
export function rsvpSnapshot(e: Pick<MunoEvent, "id" | "title" | "start_at" | "address" | "venue_name" | "url">) {
  return {
    event_id: e.id,
    event_name: e.title,
    event_start_at: e.start_at,
    event_address: e.venue_name ?? e.address,
    event_url: e.url,
  };
}

/** Las descripciones de Meetup vienen en markdown: lo pasamos a texto limpio legible. */
export function plainText(md: string) {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // imágenes
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1 ($2)") // links
    .replace(/^#{1,6}\s*/gm, "") // títulos
    .replace(/(\*\*|__)(.+?)\1/g, "$2") // negrita
    .replace(/^\s*[-*]\s+/gm, "• ") // listas
    .replace(/\\([*_#[\]()-])/g, "$1") // escapes
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
