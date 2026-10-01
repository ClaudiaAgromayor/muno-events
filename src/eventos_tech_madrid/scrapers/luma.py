"""Luma: usa la API interna de la web (api2.luma.com), pública y paginada.

La API oficial de Luma exige Luma Plus; esta es la misma que usa luma.com/discover en el
navegador, sin login. Da directamente `registration_availability` ("open" / "waitlist" /
...) y `ticket_info` (agotado, plazas restantes, casi lleno), así que el estado de plazas
sale de la propia plataforma, no de adivinar.
"""

from __future__ import annotations

import time

import httpx

from eventos_tech_madrid.common import compute_status, distance_km, event, request
from eventos_tech_madrid.sources import CITY, LUMA_CALENDARS, LUMA_DISCOVER_SLUGS

API = "https://api2.luma.com"


def _paginate(c: httpx.Client, path: str, params: dict, max_pages: int = 20) -> list[dict]:
    entries, cursor = [], None
    for _ in range(max_pages):
        p = dict(params, pagination_limit=50)
        if cursor:
            p["pagination_cursor"] = cursor
        data = request(c, "GET", API + path, params=p).json()
        entries += data.get("entries", [])
        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")
    return entries


def _doc_to_text(node) -> str:
    """description_mirror es un árbol ProseMirror -> texto plano."""
    if not isinstance(node, dict):
        return ""
    if node.get("type") == "text":
        return node.get("text", "")
    text = "".join(_doc_to_text(ch) for ch in node.get("content", []))
    if node.get("type") in {"paragraph", "heading", "list_item", "hard_break"}:
        text += "\n"
    return text


def _status(entry: dict) -> str:
    ev = entry["event"]
    ti = entry.get("ticket_info") or {}
    avail = entry.get("registration_availability")
    waitlist_open = bool(entry.get("waitlist_active")) or ev.get("waitlist_status") == "active"
    if avail == "waitlist":
        return "waitlist"
    return compute_status(
        cancelled=avail == "cancelled",
        closed=avail in ("closed", "ended", "not_open"),
        sold_out=bool(ti.get("is_sold_out")) or avail == "sold_out",
        waitlist_open=waitlist_open,
        spots_left=ti.get("spots_remaining"),
        capacity=None,
        near_capacity=bool(ti.get("is_near_capacity")),
    )


def _to_event(entry: dict, trusted: bool) -> dict | None:
    ev = entry["event"]
    geo = ev.get("geo_address_info") or {}
    coord = ev.get("coordinate") or geo.get("place_coordinate") or {}
    lat, lng = coord.get("latitude"), coord.get("longitude")
    is_online = ev.get("location_type") == "online"
    city = (geo.get("city") or "").lower()

    if not is_online:
        near = lat is not None and distance_km(lat, lng, CITY["lat"], CITY["lng"]) <= CITY["radius_km"]
        if not near and CITY["slug"] not in city:
            return None  # evento físico en otra ciudad (p. ej. calendarios globales)
    elif not trusted:
        return None  # online de búsquedas genéricas: no es "de Madrid"

    ti = entry.get("ticket_info") or {}
    cal = entry.get("calendar") or {}
    localized = (geo.get("localized") or {}).get("es") or {}
    return event(
        source="luma",
        source_id=ev["api_id"],
        title=ev["name"],
        start_at=ev["start_at"],
        end_at=ev.get("end_at"),
        url=f"https://luma.com/{ev['url']}",
        trusted=trusted,
        image_url=ev.get("cover_url"),
        organizer=cal.get("name") or ", ".join(h.get("name", "") for h in (entry.get("hosts") or [])[:2]) or None,
        organizer_url=f"https://luma.com/{cal['slug']}" if cal.get("slug") else None,
        is_online=is_online,
        venue_name=geo.get("address"),
        address=localized.get("full_address") or geo.get("full_address") or geo.get("short_address"),
        lat=lat,
        lng=lng,
        is_free=ti.get("is_free"),
        price_min=(ti.get("price") or {}).get("cents", 0) / 100 if isinstance(ti.get("price"), dict) else None,
        status=_status(entry),
        going_count=entry.get("guest_count"),
        _luma_url_slug=ev["url"],
    )


def _add_details(c: httpx.Client, events: list[dict]) -> None:
    """Descripción y categorías vienen solo en el detalle de cada evento."""
    for ev in events:
        try:
            d = request(c, "GET", API + "/event/get", params={"event_api_id": ev["source_id"]}).json()
            ev["description"] = _doc_to_text(d.get("description_mirror") or {}).strip()[:5000] or None
            ev["_hints"] = " ".join(cat.get("name", "") for cat in d.get("categories") or [])
        except Exception as e:  # noqa: BLE001 — un detalle que falla no tumba el resto
            print(f"    luma detalle falló para {ev['title'][:40]}: {e}")
        time.sleep(0.25)


def scrape(c: httpx.Client) -> list[dict]:
    found: dict[str, dict] = {}

    for slug in LUMA_DISCOVER_SLUGS:
        entries = _paginate(
            c, "/discover/get-paginated-events",
            {"latitude": CITY["lat"], "longitude": CITY["lng"], "slug": slug},
        )
        print(f"  luma discover/{slug}: {len(entries)}")
        for e in entries:
            ev = _to_event(e, trusted=False)
            if ev:
                found.setdefault(ev["id"], ev)

    for cal_slug in LUMA_CALENDARS:
        try:
            info = request(c, "GET", API + "/url", params={"url": cal_slug}).json()
            data = info.get("data") or {}
            if info.get("kind") == "discover-place":
                pid = data["place"]["api_id"]
                entries = _paginate(c, "/discover/get-paginated-events", {"discover_place_api_id": pid})
                trusted = False  # "luma.com/madrid" es de todo, no solo tech
            else:
                cal_id = data["calendar"]["api_id"]
                entries = _paginate(c, "/calendar/get-items", {"calendar_api_id": cal_id, "period": "future"})
                trusted = True
            print(f"  luma calendario {cal_slug}: {len(entries)}")
            for e in entries:
                ev = _to_event(e, trusted=trusted)
                if ev:
                    if trusted and ev["id"] in found:
                        found[ev["id"]]["_trusted"] = True
                    found.setdefault(ev["id"], ev)
        except Exception as e:  # noqa: BLE001
            print(f"  luma calendario {cal_slug}: ERROR {e}")

    events = list(found.values())
    _add_details(c, events)
    return events
