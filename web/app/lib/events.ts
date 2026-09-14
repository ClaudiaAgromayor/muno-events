export type EventSource = "luma" | "meetup" | "eventbrite" | "manual";

export type EventExtra = {
  categories?: string[];
  is_free?: boolean;
  guest_count?: number;
  sold_out?: boolean;
  waitlist_active?: boolean;
  registration_deadline?: string | null;
  attendees?: number;
  max_tickets?: number;
  spots_left?: number | null;
  attendance_mode?: string;
};

export type MunoEvent = {
  id: string;
  source: EventSource;
  source_id: string;
  name: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  url: string | null;
  city: string | null;
  address: string | null;
  organizer: string | null;
  lat: number | null;
  lng: number | null;
  extra: EventExtra;
  found_on_platforms: EventSource[];
  duplicate_ids: string[];
};

const SOURCE_LABELS: Record<EventSource, string> = {
  luma: "Luma",
  meetup: "Meetup",
  eventbrite: "Eventbrite",
  manual: "Envío manual",
};

export function sourceLabel(source: EventSource): string {
  return SOURCE_LABELS[source];
}

export function spotsLabel(event: MunoEvent): string | null {
  const { source, extra } = event;

  if (source === "luma") {
    // sold_out=true no siempre significa que hay lista de espera -- Luma deja cerrar
    // la inscripcion del todo (waitlist_active=false), y ahi no tiene sentido decir
    // "lista de espera" porque no hay ninguna a la que apuntarse (verificado con datos
    // reales: Claude Community Madrid Launch Meetup tenia sold_out=true y
    // waitlist_active=false a la vez).
    if (extra.sold_out && extra.waitlist_active) return "Lista de espera";
    if (extra.sold_out && !extra.waitlist_active) return "Inscripción cerrada";
    if (extra.is_free === true || extra.is_free === false) return "Plazas abiertas";
    return null;
  }

  if (source === "meetup") {
    const spotsLeft = extra.spots_left;
    if (spotsLeft === null || spotsLeft === undefined) return null;
    if (spotsLeft <= 0) return "Sin plazas";
    return `Quedan ${spotsLeft} plazas`;
  }

  return null;
}

export function spotsUrgent(event: MunoEvent): boolean {
  const label = spotsLabel(event);
  return label === "Lista de espera" || label === "Sin plazas" || label === "Inscripción cerrada";
}

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export type EventDateParts = {
  year: number;
  month: number;
  day: number;
  weekday: string;
  monthLabel: string;
  /** "HH:MM" en hora de Madrid, o null si la fuente no da hora (p. ej. Eventbrite) */
  time: string | null;
};

/**
 * Las 4 fuentes representan start_at de forma distinta:
 * - Luma: ISO en UTC con "Z" (ej. "...T16:00:00.000Z") -> hay que convertir a hora de Madrid,
 *   si no, un evento de las 18:00 en Madrid se mostraria como si fuera a las 16:00.
 * - Meetup: ISO con offset explicito (ej. "+02:00") -> tambien se convierte, sin sorpresas.
 * - Eventbrite: solo fecha, sin hora (ej. "2026-10-01") -> no hay hora que mostrar, y no se
 *   inventa una pasando la fecha por un Date (eso la interpretaria como medianoche UTC y
 *   mostraria una hora falsa al convertir a Madrid).
 * - Envios manuales: fecha y hora sin zona (ej. "...T10:00:00") -> ya es hora de Madrid tal
 *   cual la escribio quien mando el evento, se usa literal sin pasar por conversion de zona.
 */
export function formatEventDate(startAt: string): EventDateParts {
  const hasExplicitTz = /Z$|[+-]\d{2}:\d{2}$/.test(startAt);
  const match = startAt.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);

  if (!match) {
    return { year: 0, month: 0, day: 0, weekday: "", monthLabel: "", time: null };
  }

  const [, yStr, moStr, dStr, hStr, minStr] = match;
  let year = Number(yStr);
  let month = Number(moStr);
  let day = Number(dStr);
  let time: string | null = hStr ? `${hStr}:${minStr}` : null;

  if (hasExplicitTz) {
    const date = new Date(startAt);
    const parts = new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
    year = Number(get("year"));
    month = Number(get("month"));
    day = Number(get("day"));
    time = `${get("hour")}:${get("minute")}`;
  }

  const weekdayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return { year, month, day, weekday: WEEKDAYS[weekdayIndex], monthLabel: MONTHS[month - 1], time };
}

/**
 * Algunos eventos de Luma traen una fecha limite de inscripcion fija (separada de si
 * hay plazas o no); muchos otros no la tienen (solo cierran al llenarse el aforo, sin
 * fecha programada). Solo se muestra cuando existe y todavia no ha pasado.
 */
export function registrationDeadlineLabel(event: MunoEvent): string | null {
  const deadline = event.extra.registration_deadline;
  if (!deadline) return null;
  const date = new Date(deadline);
  if (date.getTime() <= Date.now()) return null;
  const d = formatEventDate(deadline);
  return `Apúntate antes del ${d.day} ${d.monthLabel}`;
}

export type EventGroup = { label: string; events: MunoEvent[] };

/**
 * Agrupa los eventos por dia natural (no por semana): cada fecha con eventos
 * se convierte en una seccion, con "Hoy"/"Manana" para las dos mas cercanas y
 * "Mie 16 Sep" para el resto. Evita la lista plana de 66 filas seguidas.
 */
export function groupEventsByDay(events: MunoEvent[], now: Date = new Date()): EventGroup[] {
  const today = formatEventDate(now.toISOString());
  const todayUTC = Date.UTC(today.year, today.month - 1, today.day);

  const order: number[] = [];
  const buckets = new Map<number, { parts: EventDateParts; events: MunoEvent[] }>();

  for (const event of events) {
    if (!event.start_at) continue;
    const parts = formatEventDate(event.start_at);
    const dayUTC = Date.UTC(parts.year, parts.month - 1, parts.day);
    if (!buckets.has(dayUTC)) {
      buckets.set(dayUTC, { parts, events: [] });
      order.push(dayUTC);
    }
    buckets.get(dayUTC)!.events.push(event);
  }

  order.sort((a, b) => a - b);

  return order.map((dayUTC) => {
    const { parts, events: dayEvents } = buckets.get(dayUTC)!;
    const diffDays = Math.round((dayUTC - todayUTC) / 86400000);
    const label =
      diffDays === 0 ? "Hoy" : diffDays === 1 ? "Mañana" : `${parts.weekday} ${parts.day} ${parts.monthLabel}`;
    return { label, events: dayEvents };
  });
}
