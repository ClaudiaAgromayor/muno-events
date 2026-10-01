"""Eventbrite: páginas de búsqueda (window.__SERVER_DATA__) + endpoint de disponibilidad.

La API pública de Eventbrite ya no permite buscar eventos de terceros (desde 2020), pero:
- las páginas eventbrite.es/d/... llevan los resultados en JSON dentro del HTML, con hora
  real (antes solo sacábamos la fecha del ld+json);
- /api/v3/destination/events/ (lo usa la propia web, sin login) da `ticket_availability`:
  agotado, entradas disponibles, precio y lista de espera.

Ojo: Eventbrite bloquea las IPs de GitHub Actions (405). Por eso el workflow lo lanza
también desde otro sitio — ver README.
"""

from __future__ import annotations

import json
import os
import re

import httpx

from eventos_tech_madrid.common import compute_status, distance_km, event, request
from eventos_tech_madrid.sources import CITY, EVENTBRITE_MAX_PAGES, EVENTBRITE_SEARCHES

BASE = "https://www.eventbrite.es"

# Si están definidas, las peticiones pasan por la web de muno en Vercel
# (web/app/api/eventbrite-proxy), porque Eventbrite bloquea las IPs de GitHub.
PROXY_URL = os.environ.get("EVENTBRITE_PROXY_URL")
PROXY_SECRET = os.environ.get("SCRAPER_PROXY_SECRET")


def _get(c: httpx.Client, url: str, params: dict) -> httpx.Response:
    if PROXY_URL and PROXY_SECRET:
        full = str(httpx.URL(url, params=params))
        return request(c, "GET", PROXY_URL, params={"url": full}, headers={"x-proxy-secret": PROXY_SECRET})
    return request(c, "GET", url, params=params)


def _server_data(html: str) -> dict:
    m = re.search(r"window\.__SERVER_DATA__\s*=\s*", html)
    if not m:
        raise RuntimeError("no hay __SERVER_DATA__ (¿bloqueo o cambio de web?)")
    data, _ = json.JSONDecoder().raw_decode(html[m.end():])
    return data


def _search_page(c: httpx.Client, path: str, page: int) -> tuple[list[dict], bool]:
    html = _get(c, f"{BASE}/d/{path}/", {"page": page}).text
    sd = _server_data(html)
    # Según la versión de la página está en search_data.events o en
    # event_data.active_search.events — se buscan ambas.
    events = (
        ((sd.get("search_data") or {}).get("events"))
        or (((sd.get("event_data") or {}).get("active_search") or {}).get("events"))
        or {}
    )
    results = events.get("results") or []
    has_more = bool((events.get("pagination") or {}).get("continuation"))
    return results, has_more


def _availability(c: httpx.Client, ids: list[str]) -> dict[str, dict]:
    out = {}
    for i in range(0, len(ids), 40):
        chunk = ids[i : i + 40]
        r = _get(
            c, f"{BASE}/api/v3/destination/events/",
            {"event_ids": ",".join(chunk), "expand": "ticket_availability,primary_organizer", "page_size": 50},
        )
        for e in r.json().get("events", []):
            out[e["id"]] = e
    return out


def _to_event(r: dict, detail: dict | None) -> dict | None:
    venue = r.get("primary_venue") or {}
    addr = venue.get("address") or {}
    lat = float(addr["latitude"]) if addr.get("latitude") else None
    lng = float(addr["longitude"]) if addr.get("longitude") else None
    is_online = bool(r.get("is_online_event"))
    if is_online:
        return None  # Eventbrite tiene muchísimo online genérico; solo físico en la ciudad
    if lat is None or distance_km(lat, lng, CITY["lat"], CITY["lng"]) > CITY["radius_km"]:
        return None

    start = r.get("start_date")
    if not start:
        return None
    tz_start = f"{start}T{r.get('start_time') or '00:00'}:00"
    end = f"{r['end_date']}T{r.get('end_time') or '23:59'}:00" if r.get("end_date") else None

    ta = (detail or {}).get("ticket_availability") or {}
    org = (detail or {}).get("primary_organizer") or {}
    min_price = (ta.get("minimum_ticket_price") or {}).get("major_value")
    status = compute_status(
        cancelled=bool(r.get("is_cancelled")),
        sold_out=bool(ta.get("is_sold_out")),
        waitlist_open=bool(ta.get("waitlist_available")),
        closed=ta.get("has_available_tickets") is False and not ta.get("is_sold_out"),
    ) if ta else "unknown"

    image = (r.get("image") or {}).get("url")
    return event(
        source="eventbrite",
        source_id=r["id"],
        title=r["name"],
        # Eventbrite da hora local sin zona -> la marcamos como hora de Madrid explícitamente
        start_at=tz_start + "+02:00" if _is_summer(start) else tz_start + "+01:00",
        end_at=(end + ("+02:00" if _is_summer(r["end_date"]) else "+01:00")) if end else None,
        url=r.get("url"),
        description=(r.get("summary") or r.get("full_description") or "")[:5000] or None,
        image_url=image,
        organizer=org.get("name"),
        organizer_url=org.get("url"),
        venue_name=venue.get("name"),
        address=addr.get("localized_address_display") or addr.get("address_1"),
        lat=lat,
        lng=lng,
        is_free=ta.get("is_free") if ta else None,
        price_min=float(min_price) if min_price else None,
        currency=(ta.get("minimum_ticket_price") or {}).get("currency"),
        status=status,
        _hints=" ".join(t.get("display_name", "") for t in r.get("tags") or []),
    )


def _is_summer(date: str) -> bool:
    """Horario de verano en España: último domingo de marzo a último domingo de octubre."""
    from datetime import date as d, timedelta

    y, m, day = (int(x) for x in date[:10].split("-"))
    def last_sunday(month: int) -> d:
        x = d(y, month, 31)
        return x - timedelta(days=(x.weekday() + 1) % 7)
    return last_sunday(3) <= d(y, m, day) < last_sunday(10)


def scrape(c: httpx.Client) -> list[dict]:
    raw: dict[str, dict] = {}
    blocked = 0
    for path in EVENTBRITE_SEARCHES:
        n = 0
        for page in range(1, EVENTBRITE_MAX_PAGES + 1):
            try:
                results, has_more = _search_page(c, path, page)
            except httpx.HTTPStatusError as e:
                if e.response.status_code in (403, 405):
                    blocked += 1
                print(f"  eventbrite {path} p{page}: ERROR {e.response.status_code}")
                break
            for r in results:
                raw.setdefault(r["id"], r)
            n += len(results)
            if not has_more:
                break
        print(f"  eventbrite {path}: {n}")
    if blocked == len(EVENTBRITE_SEARCHES):
        raise RuntimeError("Eventbrite bloquea esta IP (405/403)")

    details = _availability(c, list(raw))
    events = [_to_event(r, details.get(r["id"])) for r in raw.values()]
    return [e for e in events if e]
